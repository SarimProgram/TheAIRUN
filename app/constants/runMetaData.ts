import type { RunType } from '@/types/RunTemplate';

export type RunInfoDetail = {
  title: string;
  description: string;
  benefits: string[];
  expertOpinions: string[];
  phases: Array<{
    name: string;
    duration: string;
  }>;
  tips: string[];
  intensity: 'Low' | 'Moderate' | 'High' | 'Very High';
  color: string;
};

export type RunMeta = {
  aliases: string[];
  templateId: RunType;
  launchMode: 'standard' | 'interval';
  details: RunInfoDetail;
};

export const RUN_META_MAP: Record<string, RunMeta> = {
  'Long Run': {
    aliases: ['long run'],
    templateId: 'long',
    launchMode: 'standard',
    details: {
      title: 'Long Run',
      description: 'A long and easy run. You keep a steady pace and do not sprint.',
      benefits: ['Builds stamina for longer distance', 'Makes your heart stronger', 'Helps your body use fat as fuel'],
      expertOpinions: ['Coaches say long runs are the key session for endurance.', 'Sports trainers say easy long pace helps lower injury risk.'],
      phases: [
        { name: 'Warm Up', duration: '10%' },
        { name: 'Endurance Run', duration: '80%' },
        { name: 'Cool Down', duration: '10%' },
      ],
      tips: ['Keep your heart rate in Zone 2', 'Focus on time on legs, not speed', 'Hydrate every 20-30 minutes'],
      intensity: 'Moderate',
      color: '#FF6B6B',
    },
  },
  'Easy Run': {
    aliases: ['easy run', 'easy'],
    templateId: 'easy',
    launchMode: 'standard',
    details: {
      title: 'Easy Run',
      description: 'A light run at a comfortable pace. You should be able to talk while running.',
      benefits: ['Helps recovery between hard days', 'Builds your running base', 'Adds distance with low stress'],
      expertOpinions: ['Running coaches say most weekly runs should be easy.', 'Experts say easy effort helps you train more consistently.'],
      phases: [
        { name: 'Warm Up', duration: '15%' },
        { name: 'Easy Run', duration: '70%' },
        { name: 'Cool Down', duration: '15%' },
      ],
      tips: ['You should be able to speak in full sentences', 'Focus on smooth, easy breathing', 'Ignore the pace on your watch'],
      intensity: 'Low',
      color: '#00B894',
    },
  },
  'Interval Run': {
    aliases: ['interval run', 'intervals', 'interval'],
    templateId: 'interval',
    launchMode: 'interval',
    details: {
      title: 'Interval Run',
      description: 'A run with short fast parts and short recovery parts. You repeat this pattern.',
      benefits: ['Improves speed', 'Improves heart and lung fitness', 'Burns more calories in less time'],
      expertOpinions: ['Coaches say intervals improve speed faster than only easy runs.', 'Experts suggest good warm-up before fast repeats.'],
      phases: [
        { name: 'Warm Up', duration: '20%' },
        { name: 'Work + Recovery Repeats', duration: '60%' },
        { name: 'Cool Down', duration: '20%' },
      ],
      tips: ['Warm up thoroughly for 15-20 mins', 'Hit your target paces precisely', 'Focus on form when tired'],
      intensity: 'Very High',
      color: '#6366F1',
    },
  },
  'Interval Walk': {
    aliases: ['interval walk', 'walk intervals', 'interval walking'],
    templateId: 'interval_walk',
    launchMode: 'interval',
    details: {
      title: 'Interval Walk',
      description: 'A guided walking workout that alternates fast-walk blocks with easy recovery walk blocks.',
      benefits: ['Builds walking fitness without running impact', 'Improves pace control and walking mechanics', 'Adds structure to recovery-focused cardio'],
      expertOpinions: ['Coaches use walk intervals to build fitness safely when impact needs to stay low.', 'Walking specialists recommend posture and arm drive to make brisk intervals more effective.'],
      phases: [
        { name: 'Warm Up Walk', duration: '15%' },
        { name: 'Fast Walk + Recovery Walk', duration: '70%' },
        { name: 'Cool Down Walk', duration: '15%' },
      ],
      tips: ['Stay tall and let the arms help set rhythm', 'Keep the fast walk quick but controlled', 'Use the recovery walk to reset your breathing'],
      intensity: 'Moderate',
      color: '#14B8A6',
    },
  },
  'Tempo Run': {
    aliases: ['tempo run', 'tempo'],
    templateId: 'easy',
    launchMode: 'standard',
    details: {
      title: 'Tempo Run',
      description: 'A steady run at a strong but controlled pace. Harder than easy run, but not full sprint.',
      benefits: ['Improves ability to hold faster pace', 'Builds race stamina', 'Improves pace control'],
      expertOpinions: ['Coaches call tempo work one of the best workouts for race pace.', 'Experts say rhythm and control are more important than all-out speed.'],
      phases: [
        { name: 'Warm Up', duration: '20%' },
        { name: 'Tempo Effort', duration: '60%' },
        { name: 'Cool Down', duration: '20%' },
      ],
      tips: ['Pace should be about 25-30 secs slower than 5K pace', 'Maintain a steady, rhythmic effort', 'Finish feeling tired but not exhausted'],
      intensity: 'High',
      color: '#F59E0B',
    },
  },
  'Power Walk': {
    aliases: ['power walk'],
    templateId: 'power_walk',
    launchMode: 'standard',
    details: {
      title: 'Power Walk',
      description: 'A fast walk with good posture and active arms. It is harder than normal walking.',
      benefits: ['Improves heart fitness with low impact', 'Good calorie burn without running stress', 'Builds daily movement habit'],
      expertOpinions: ['Physio experts often recommend power walking for low-impact cardio.', 'Coaches say arm swing and posture make power walk more effective.'],
      phases: [
        { name: 'Warm Up', duration: '15%' },
        { name: 'Power Walk', duration: '70%' },
        { name: 'Cool Down', duration: '15%' },
      ],
      tips: ['Swing your arms naturally to maintain rhythm', 'Keep your posture tall and core lightly engaged', 'Use a pace where breathing is elevated but controlled'],
      intensity: 'Moderate',
      color: '#8B5CF6',
    },
  },
  'Long Walk': {
    aliases: ['long walk'],
    templateId: 'long_walk',
    launchMode: 'standard',
    details: {
      title: 'Long Walk',
      description: 'A longer walk at a steady and comfortable pace. Focus on time and consistency.',
      benefits: ['Builds endurance with very low impact', 'Helps recovery and daily fitness', 'Increases weekly activity safely'],
      expertOpinions: ['Health experts say long walks are great for consistent cardio.', 'Coaches use long walks on recovery days to keep volume up.'],
      phases: [
        { name: 'Warm Up', duration: '10%' },
        { name: 'Steady Long Walk', duration: '80%' },
        { name: 'Cool Down', duration: '10%' },
      ],
      tips: ['Start easy and settle into a repeatable rhythm', 'Keep stride smooth instead of overstriding', 'Hydrate on longer sessions and wear comfortable shoes'],
      intensity: 'Low',
      color: '#10B981',
    },
  },
  'Goal Practice Run': {
    aliases: ['goal practice run', 'goal practice', 'race practice', 'mock run'],
    templateId: 'goal_practice',
    launchMode: 'standard',
    details: {
      title: 'Goal Practice Run',
      description: 'A simple goal-distance rehearsal. Run the full planned distance with steady control from start to finish.',
      benefits: ['Practises the exact goal distance', 'Builds confidence before race day', 'Helps you judge pacing under real fatigue'],
      expertOpinions: ['Coaches use distance rehearsal to reduce surprises on race day.', 'The best practice session is controlled and repeatable, not reckless.'],
      phases: [
        { name: 'Practice Run', duration: '100%' },
      ],
      tips: ['Start controlled instead of chasing pace early', 'Lock into a rhythm you can hold to the end', 'Treat this like rehearsal, not an all-out test'],
      intensity: 'High',
      color: '#F97316',
    },
  },
};

function normalize(text: string | null | undefined): string {
  return (text || '').trim().toLowerCase();
}

export function getRunMeta(runType: string | null | undefined): RunMeta {
  const input = normalize(runType);
  const fallback = RUN_META_MAP['Easy Run'];

  if (!input) return fallback;

  const found = Object.values(RUN_META_MAP).find((meta) =>
    meta.aliases.some((alias) => input.includes(alias) || alias.includes(input))
  );

  return found || fallback;
}

export function getRunInfo(runType: string | null | undefined): RunInfoDetail {
  return getRunMeta(runType).details;
}
