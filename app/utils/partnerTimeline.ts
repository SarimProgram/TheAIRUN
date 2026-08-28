import type { DaySchedule } from './planProjection';

export type PartnerDaySummary = {
    dayKey: string;
    dayIndex: number;
    steps: number;
    stepsTarget: number;
    distanceKm: number;
    runKmTarget: number;
    exerciseMinutes: number;
    runStatus: string | null;
    waterMl: number;
    consumedCalories: number;
    calorieTarget: number;
    activeCalories: number;
    isToday: boolean;
    isFuture: boolean;
};

export type PartnerPointsHistoryEntry = {
    dayKey: string;
    awardedAt: string;
    category: string;
    categoryLabel: string;
    earnedPoints: number;
};

export type ScheduledPartnerRun = {
    id: string;
    scheduledTime: string;
    distanceKm: number;
    status: string;
    isSender: boolean;
    partnerName: string;
};

export type TimelineChatMessage = {
    id: string;
    fromUserId: string;
    fromName: string;
    content: string;
    createdAt: string;
};

export type TimelineActor = 'you' | 'partner';

export type TimelineEventKind =
    | 'planned_run'
    | 'activity'
    | 'milestone'
    | 'points'
    | 'run_together'
    | 'wager'
    | 'alert'
    | 'note';

export type PartnerTimelineEvent = {
    id: string;
    dayKey: string;
    kind: TimelineEventKind;
    actor: TimelineActor;
    sortAt: string;
    timeLabel?: string;
    title: string;
    subtitle?: string;
    tone: 'default' | 'success' | 'warning' | 'info';
};

type WagerCard = {
    weekStart?: string;
    weekEnd?: string;
    title?: string;
    status?: string;
};

type MyTodaySummary = {
    steps: number;
    stepsTarget?: number;
    distanceKm: number;
    runKmTarget: number;
    exerciseMinutes: number;
};

function formatTimeLabel(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dayKeyFromDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function sortAtFromDayKey(dayKey: string, hour = 12) {
    return `${dayKey}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

export function buildWeekDayShell(weekStart?: string): PartnerDaySummary[] {
    if (!weekStart) return [];
    const todayDayKey = dayKeyFromDate(new Date());
    const [year, month, day] = weekStart.split('-').map(Number);
    if (!year || !month || !day) return [];

    const start = new Date(year, month - 1, day);
    return Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(start);
        date.setDate(start.getDate() + dayIndex);
        const dayKey = dayKeyFromDate(date);
        return {
            dayKey,
            dayIndex,
            steps: 0,
            stepsTarget: 8000,
            distanceKm: 0,
            runKmTarget: 0,
            exerciseMinutes: 0,
            runStatus: null,
            waterMl: 0,
            consumedCalories: 0,
            calorieTarget: 2000,
            activeCalories: 0,
            isToday: dayKey === todayDayKey,
            isFuture: dayKey > todayDayKey,
        };
    });
}

export function formatTimelineDayLabel(dayKey: string, isToday: boolean) {
    const [year, month, day] = dayKey.split('-').map(Number);
    if (!year || !month || !day) return dayKey;
    const date = new Date(year, month - 1, day);
    const label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    return isToday ? `Today · ${label}` : label;
}

export function formatWeekRangeLabel(weekStart?: string, weekEnd?: string) {
    if (!weekStart || !weekEnd) return 'This week';
    const start = new Date(`${weekStart}T12:00:00`);
    const end = new Date(`${weekEnd}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'This week';
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}`;
}

export function buildTimelineDaysFromKeys(
    dayKeys: string[],
    baseDays: PartnerDaySummary[] = [],
): PartnerDaySummary[] {
    const todayDayKey = dayKeyFromDate(new Date());
    const baseByKey = new Map(baseDays.map((day) => [day.dayKey, day]));
    const uniqueKeys = [...new Set(dayKeys.filter(Boolean))].sort();

    return uniqueKeys.map((dayKey, dayIndex) => {
        const existing = baseByKey.get(dayKey);
        if (existing) return existing;

        const [year, month, day] = dayKey.split('-').map(Number);
        if (!year || !month || !day) {
            return {
                dayKey,
                dayIndex,
                steps: 0,
                stepsTarget: 8000,
                distanceKm: 0,
                runKmTarget: 0,
                exerciseMinutes: 0,
                runStatus: null,
                waterMl: 0,
                consumedCalories: 0,
                calorieTarget: 2000,
                activeCalories: 0,
                isToday: dayKey === todayDayKey,
                isFuture: dayKey > todayDayKey,
            };
        }

        return {
            dayKey,
            dayIndex,
            steps: 0,
            stepsTarget: 8000,
            distanceKm: 0,
            runKmTarget: 0,
            exerciseMinutes: 0,
            runStatus: null,
            waterMl: 0,
            consumedCalories: 0,
            calorieTarget: 2000,
            activeCalories: 0,
            isToday: dayKey === todayDayKey,
            isFuture: dayKey > todayDayKey,
        };
    });
}

export function collectTimelineDayKeys(params: {
    baseDays: PartnerDaySummary[];
    pointsHistory?: PartnerPointsHistoryEntry[];
    myPointsHistory?: PartnerPointsHistoryEntry[];
    chatMessages?: TimelineChatMessage[];
    scheduledRuns?: ScheduledPartnerRun[];
}): string[] {
    const keys = new Set(params.baseDays.map((day) => day.dayKey));

    for (const entry of params.pointsHistory ?? []) {
        keys.add(entry.dayKey);
    }
    for (const entry of params.myPointsHistory ?? []) {
        keys.add(entry.dayKey);
    }
    for (const message of params.chatMessages ?? []) {
        keys.add(dayKeyFromDate(new Date(message.createdAt)));
    }
    for (const run of params.scheduledRuns ?? []) {
        keys.add(dayKeyFromDate(new Date(run.scheduledTime)));
    }

    return [...keys];
}

export function buildPartnerTimelineEvents(params: {
    partnerName: string;
    days: PartnerDaySummary[];
    plannedDays: DaySchedule[];
    pointsHistory: PartnerPointsHistoryEntry[];
    myPointsHistory?: PartnerPointsHistoryEntry[];
    scheduledRuns: ScheduledPartnerRun[];
    chatMessages?: TimelineChatMessage[];
    currentUserId?: string | null;
    myTodaySummary?: MyTodaySummary | null;
    activeWager?: WagerCard | null;
    showCaloriesWarning?: boolean;
    partnerCaloriesOverTarget?: number;
    partnerNeedsWaterNudge?: boolean;
    waterNudgeSent?: boolean;
}): Map<string, PartnerTimelineEvent[]> {
    const {
        partnerName,
        days,
        plannedDays,
        pointsHistory,
        myPointsHistory = [],
        scheduledRuns,
        chatMessages = [],
        currentUserId,
        myTodaySummary,
        activeWager,
        showCaloriesWarning,
        partnerCaloriesOverTarget = 0,
        partnerNeedsWaterNudge,
        waterNudgeSent,
    } = params;

    const eventsByDay = new Map<string, PartnerTimelineEvent[]>();
    const weekDayKeys = new Set(days.map((day) => day.dayKey));

    const pushEvent = (dayKey: string, event: PartnerTimelineEvent) => {
        if (!weekDayKeys.has(dayKey)) return;
        const existing = eventsByDay.get(dayKey) ?? [];
        existing.push(event);
        eventsByDay.set(dayKey, existing);
    };

    for (const day of days) {
        const planned = plannedDays[day.dayIndex];
        if (planned?.type === 'RUN' && planned.runType) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-planned-run`,
                dayKey: day.dayKey,
                kind: 'planned_run',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 8),
                title: planned.runType,
                subtitle: `${planned.targetKm} km scheduled`,
                tone: day.isFuture ? 'info' : 'default',
            });
        }

        if (!day.isFuture && day.stepsTarget > 0 && day.steps >= day.stepsTarget) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-steps-milestone`,
                dayKey: day.dayKey,
                kind: 'milestone',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 18),
                title: `${day.steps.toLocaleString()} steps reached`,
                subtitle: `${partnerName} hit the daily step goal`,
                tone: 'success',
            });
        } else if (!day.isFuture && day.steps >= 5000 && day.steps < day.stepsTarget) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-steps-progress`,
                dayKey: day.dayKey,
                kind: 'milestone',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 16),
                title: `${day.steps.toLocaleString()} steps logged`,
                subtitle: `${(day.stepsTarget - day.steps).toLocaleString()} to goal`,
                tone: 'default',
            });
        }

        if (!day.isFuture && (day.steps > 0 || day.distanceKm > 0 || day.exerciseMinutes > 0)) {
            const parts: string[] = [];
            if (day.steps > 0 && day.steps < day.stepsTarget) {
                parts.push(`${day.steps.toLocaleString()} steps`);
            }
            if (day.distanceKm > 0) {
                parts.push(`${day.distanceKm.toFixed(1)} km`);
            }
            if (day.exerciseMinutes > 0) {
                parts.push(`${day.exerciseMinutes} min active`);
            }

            if (parts.length > 0) {
                const hitRunTarget = day.runKmTarget > 0 && day.distanceKm >= day.runKmTarget;
                pushEvent(day.dayKey, {
                    id: `${day.dayKey}-activity`,
                    dayKey: day.dayKey,
                    kind: 'activity',
                    actor: 'partner',
                    sortAt: sortAtFromDayKey(day.dayKey, 17),
                    title: day.isToday ? `${partnerName} today` : `${partnerName} logged activity`,
                    subtitle: parts.join(' · '),
                    tone: hitRunTarget || day.runStatus === 'COMPLETED' ? 'success' : 'default',
                });
            }
        } else if (day.isToday && day.stepsTarget > 0) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-activity-today`,
                dayKey: day.dayKey,
                kind: 'activity',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 12),
                title: `${partnerName} today`,
                subtitle: `${day.steps.toLocaleString()} / ${day.stepsTarget.toLocaleString()} steps`,
                tone: day.steps >= day.stepsTarget ? 'success' : 'default',
            });
        }

        if (!day.isFuture && day.runKmTarget > 0 && day.distanceKm < day.runKmTarget && day.runStatus === 'MISSED') {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-missed-run`,
                dayKey: day.dayKey,
                kind: 'alert',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 20),
                title: 'Run target missed',
                subtitle: `${day.distanceKm.toFixed(1)} / ${day.runKmTarget.toFixed(1)} km`,
                tone: 'warning',
            });
        }

        if (day.isToday && showCaloriesWarning) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-calories-alert`,
                dayKey: day.dayKey,
                kind: 'alert',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 14),
                title: 'Calories over target',
                subtitle: `+${Math.round(partnerCaloriesOverTarget)} kcal above goal`,
                tone: 'warning',
            });
        }

        if (day.isToday && partnerNeedsWaterNudge) {
            pushEvent(day.dayKey, {
                id: `${day.dayKey}-water-alert`,
                dayKey: day.dayKey,
                kind: 'alert',
                actor: 'partner',
                sortAt: sortAtFromDayKey(day.dayKey, 13),
                title: waterNudgeSent ? 'Hydration nudge sent' : 'Low hydration',
                subtitle: waterNudgeSent ? 'Waiting on your partner to drink up' : 'No water logged in 2+ hours',
                tone: waterNudgeSent ? 'success' : 'info',
            });
        }
    }

    const todayDay = days.find((day) => day.isToday);
    if (todayDay && myTodaySummary) {
        const stepsTarget = myTodaySummary.stepsTarget ?? todayDay.stepsTarget;
        if (myTodaySummary.steps >= stepsTarget && stepsTarget > 0) {
            pushEvent(todayDay.dayKey, {
                id: `${todayDay.dayKey}-my-steps-milestone`,
                dayKey: todayDay.dayKey,
                kind: 'milestone',
                actor: 'you',
                sortAt: sortAtFromDayKey(todayDay.dayKey, 18),
                title: `${myTodaySummary.steps.toLocaleString()} steps reached`,
                subtitle: 'You hit your daily step goal',
                tone: 'success',
            });
        } else if (myTodaySummary.steps > 0 || myTodaySummary.distanceKm > 0 || myTodaySummary.exerciseMinutes > 0) {
            const parts: string[] = [];
            if (myTodaySummary.steps > 0) parts.push(`${myTodaySummary.steps.toLocaleString()} steps`);
            if (myTodaySummary.distanceKm > 0) parts.push(`${myTodaySummary.distanceKm.toFixed(1)} km`);
            if (myTodaySummary.exerciseMinutes > 0) parts.push(`${myTodaySummary.exerciseMinutes} min`);
            pushEvent(todayDay.dayKey, {
                id: `${todayDay.dayKey}-my-activity`,
                dayKey: todayDay.dayKey,
                kind: 'activity',
                actor: 'you',
                sortAt: sortAtFromDayKey(todayDay.dayKey, 17),
                title: 'You today',
                subtitle: parts.join(' · '),
                tone: 'default',
            });
        }
    }

    for (const entry of pointsHistory) {
        if (!weekDayKeys.has(entry.dayKey)) continue;
        pushEvent(entry.dayKey, {
            id: `${entry.dayKey}-partner-${entry.category}-${entry.awardedAt}`,
            dayKey: entry.dayKey,
            kind: 'points',
            actor: 'partner',
            sortAt: entry.awardedAt,
            timeLabel: formatTimeLabel(entry.awardedAt),
            title: entry.categoryLabel,
            subtitle: `+${entry.earnedPoints} points collected`,
            tone: 'success',
        });
    }

    for (const entry of myPointsHistory) {
        if (!weekDayKeys.has(entry.dayKey)) continue;
        pushEvent(entry.dayKey, {
            id: `${entry.dayKey}-my-${entry.category}-${entry.awardedAt}`,
            dayKey: entry.dayKey,
            kind: 'points',
            actor: 'you',
            sortAt: entry.awardedAt,
            timeLabel: formatTimeLabel(entry.awardedAt),
            title: entry.categoryLabel,
            subtitle: `+${entry.earnedPoints} points collected`,
            tone: 'success',
        });
    }

    for (const run of scheduledRuns) {
        const dayKey = dayKeyFromDate(new Date(run.scheduledTime));
        if (!weekDayKeys.has(dayKey)) continue;
        const statusLabel =
            run.status === 'PENDING'
                ? run.isSender
                    ? 'Waiting for partner'
                    : 'Invite pending'
                : run.status === 'ACCEPTED'
                    ? 'Run together confirmed'
                    : run.status.toLowerCase();

        pushEvent(dayKey, {
            id: `run-together-${run.id}`,
            dayKey,
            kind: 'run_together',
            actor: run.isSender ? 'you' : 'partner',
            sortAt: run.scheduledTime,
            timeLabel: formatTimeLabel(run.scheduledTime),
            title: run.isSender ? 'You scheduled a run' : `${run.partnerName} invited you`,
            subtitle: `${run.distanceKm.toFixed(1)} km · ${statusLabel}`,
            tone: run.status === 'ACCEPTED' ? 'success' : 'info',
        });
    }

    if (activeWager?.weekStart && weekDayKeys.has(activeWager.weekStart)) {
        pushEvent(activeWager.weekStart, {
            id: `wager-start-${activeWager.weekStart}`,
            dayKey: activeWager.weekStart,
            kind: 'wager',
            actor: 'partner',
            sortAt: sortAtFromDayKey(activeWager.weekStart, 9),
            title: activeWager.title || 'Weekly wager',
            subtitle:
                activeWager.status === 'ACTIVE'
                    ? 'Wager week in progress'
                    : activeWager.status === 'PENDING'
                        ? 'Wager waiting to start'
                        : 'Wager week',
            tone: 'info',
        });
    }

    for (const message of chatMessages) {
        const dayKey = dayKeyFromDate(new Date(message.createdAt));
        if (!weekDayKeys.has(dayKey)) continue;
        if (message.content.startsWith('[DRAW]')) continue;

        const isYou = currentUserId ? message.fromUserId === currentUserId : false;
        pushEvent(dayKey, {
            id: `note-${message.id}`,
            dayKey,
            kind: 'note',
            actor: isYou ? 'you' : 'partner',
            sortAt: message.createdAt,
            timeLabel: formatTimeLabel(message.createdAt),
            title: isYou ? 'You posted' : `${message.fromName || partnerName} posted`,
            subtitle: message.content,
            tone: 'default',
        });
    }

    for (const [, events] of eventsByDay) {
        events.sort((a, b) => {
            const timeDiff = new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            const kindOrder: Record<TimelineEventKind, number> = {
                wager: 0,
                planned_run: 1,
                run_together: 2,
                milestone: 3,
                activity: 4,
                points: 5,
                note: 6,
                alert: 7,
            };
            return kindOrder[a.kind] - kindOrder[b.kind];
        });
    }

    return eventsByDay;
}

export function flattenTimelineEvents(
    eventsByDay: Map<string, PartnerTimelineEvent[]>,
    days: PartnerDaySummary[],
    filterDayKey?: string | null
): PartnerTimelineEvent[] {
    const orderedDays = filterDayKey
        ? days.filter((day) => day.dayKey === filterDayKey)
        : days;

    const flattened: PartnerTimelineEvent[] = [];
    for (const day of orderedDays) {
        const events = eventsByDay.get(day.dayKey) ?? [];
        flattened.push(...events);
    }
    return flattened;
}
