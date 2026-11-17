export type CoupleChallengeType = 'FIRST_TO_100K' | 'MOST_STEPS_WEEK';
export type CoupleChallengeStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

export type CoupleMember = { id: string; name: string; steps: number };
export type CoupleView = { id: string; name: string; members: CoupleMember[]; totalSteps: number };

export type CoupleChallenge = {
  id: string;
  type: CoupleChallengeType;
  typeLabel: string;
  status: CoupleChallengeStatus;
  prize: string;
  target: number | null;
  direction: 'sent' | 'received';
  createdAt: string;
  acceptedAt: string | null;
  startDayKey: string | null;
  endDayKey: string | null;
  endsAt: string | null;
  completedAt: string | null;
  isTie: boolean;
  winner: 'you' | 'them' | null;
  yourCouple: CoupleView;
  theirCouple: CoupleView;
};

export type EarnedMedal = {
  id: string;
  prize: string;
  typeLabel: string;
  opponentName: string;
  completedAt: string;
};

export type CoupleChallengeState = {
  couple: (CoupleView & { code: string }) | null;
  active: CoupleChallenge | null;
  latestResult: CoupleChallenge | null;
  incoming: CoupleChallenge[];
  sent: CoupleChallenge[];
  medals?: EarnedMedal[];
};

export const CHALLENGE_TYPE_LABELS: Record<CoupleChallengeType, string> = {
  FIRST_TO_100K: 'First to 100,000 steps',
  MOST_STEPS_WEEK: 'Most steps this week',
};

export const COUPLE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const normalizeCoupleCode = (input: string) => input.replace(/[\s-]/g, '').toUpperCase();

// Dev-only stand-in for the /couple-challenges API, so the flow can be exercised
// without a linked partner or a second real couple. State lives for the app session.
const SIM_CODE = 'DEVK7Q';
const TARGET = 100_000;

let sent: CoupleChallenge | null = null;
let incoming: CoupleChallenge | null = null;
let active: CoupleChallenge | null = null;
let latestResult: CoupleChallenge | null = null;
let medals: EarnedMedal[] = [];
let sequence = 0;

const couple = (id: string, names: [string, string]): CoupleView => ({
  id,
  name: names.join(' & '),
  members: names.map((name, index) => ({ id: `${id}-${index}`, name, steps: 0 })),
  totalSteps: 0,
});

const yourCouple = (yourName: string) => couple('sim-you', [yourName, 'Partner']);
const theirCouple = () => couple('sim-them', ['Jo', 'Kim']);

function weekEnd(now: Date) {
  const end = new Date(now);
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  end.setHours(23, 59, 59, 999);
  return end;
}

function makeChallenge(yourName: string, type: CoupleChallengeType, prize: string, direction: 'sent' | 'received'): CoupleChallenge {
  sequence += 1;
  return {
    id: `sim-${sequence}`,
    type,
    typeLabel: CHALLENGE_TYPE_LABELS[type],
    status: 'PENDING',
    prize,
    target: type === 'FIRST_TO_100K' ? TARGET : null,
    direction,
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    startDayKey: null,
    endDayKey: null,
    endsAt: null,
    completedAt: null,
    isTie: false,
    winner: null,
    yourCouple: yourCouple(yourName),
    theirCouple: theirCouple(),
  };
}

function start(challenge: CoupleChallenge): CoupleChallenge {
  const now = new Date();
  return {
    ...challenge,
    status: 'ACTIVE',
    acceptedAt: now.toISOString(),
    endsAt: challenge.type === 'MOST_STEPS_WEEK' ? weekEnd(now).toISOString() : null,
  };
}

function finish(challenge: CoupleChallenge): CoupleChallenge {
  const you = challenge.yourCouple.totalSteps;
  const them = challenge.theirCouple.totalSteps;
  const done: CoupleChallenge = {
    ...challenge,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    isTie: you === them,
    winner: you === them ? null : you > them ? 'you' : 'them',
  };
  if (done.winner === 'you') {
    medals = [{ id: done.id, prize: done.prize, typeLabel: done.typeLabel, opponentName: done.theirCouple.name, completedAt: done.completedAt! }, ...medals];
  }
  return done;
}

const withSteps = (view: CoupleView, add: () => number): CoupleView => {
  const members = view.members.map(member => ({ ...member, steps: member.steps + add() }));
  return { ...view, members, totalSteps: members.reduce((sum, member) => sum + member.steps, 0) };
};

export const coupleChallengeSim = {
  state(yourName: string): CoupleChallengeState {
    return {
      couple: { ...yourCouple(yourName), code: SIM_CODE },
      active,
      latestResult: active ? null : latestResult,
      incoming: incoming ? [incoming] : [],
      sent: sent ? [sent] : [],
      medals,
    };
  },
  lookup(code: string): CoupleView {
    if (!COUPLE_CODE_PATTERN.test(code)) throw new Error('Couple codes are 6 letters and numbers.');
    if (code === SIM_CODE) throw new Error("That's your own couple code.");
    return theirCouple();
  },
  invite(yourName: string, code: string, type: CoupleChallengeType, prize: string) {
    this.lookup(code);
    if (active) throw new Error('One of your couples already has a challenge running.');
    if (sent) throw new Error('You already have an invite waiting. Cancel it to send a new one.');
    sent = makeChallenge(yourName, type, prize, 'sent');
  },
  receiveInvite(yourName: string) {
    incoming = makeChallenge(yourName, 'FIRST_TO_100K', 'the Rose Gold medal', 'received');
  },
  accept(id: string) {
    if (incoming?.id !== id) throw new Error('This invite is no longer open.');
    if (active) throw new Error('One of your couples already has a challenge running.');
    active = start(incoming);
    incoming = null;
    latestResult = null;
  },
  decline(id: string) {
    if (incoming?.id === id) incoming = null;
  },
  cancel(id: string) {
    if (sent?.id === id) sent = null;
  },
  theyAccept() {
    if (!sent || active) return;
    active = start(sent);
    sent = null;
    latestResult = null;
  },
  addSteps() {
    if (!active) return;
    const random = () => 2_000 + Math.round(Math.random() * 9_000);
    active = { ...active, yourCouple: withSteps(active.yourCouple, random), theirCouple: withSteps(active.theirCouple, random) };
    if (active.target && Math.max(active.yourCouple.totalSteps, active.theirCouple.totalSteps) >= active.target) {
      latestResult = finish(active);
      active = null;
    }
  },
  addWins(count: number) {
    const now = Date.now();
    const added = Array.from({ length: count }, (_, index) => {
      sequence += 1;
      return { id: `sim-win-${sequence}`, prize: 'the Gold medal', typeLabel: CHALLENGE_TYPE_LABELS.FIRST_TO_100K, opponentName: 'Jo & Kim', completedAt: new Date(now - (count - index) * 86_400_000).toISOString() };
    });
    medals = [...added.reverse(), ...medals];
  },
  finishNow() {
    if (!active) return;
    latestResult = finish(active);
    active = null;
  },
  reset() {
    sent = incoming = active = latestResult = null;
    medals = [];
  },
};
