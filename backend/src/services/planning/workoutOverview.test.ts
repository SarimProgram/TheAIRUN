import assert from 'node:assert/strict';
import test from 'node:test';
import { completedWorkoutDays, projectWorkoutOverview, type OverviewPlan } from './workoutOverview';

const plan = (sessions: any[], weeks = 2) => ({ id: 'plan', weekStartedAt: new Date('2026-11-01T15:00:00Z'), availableDays: [],
    weeklyPlans: Array.from({ length: weeks }, (_, index) => ({ id: `week-${index}`, week: index + 1, dailyTargets: [],
        weekDailys: { trainingSchedule: { version: 1, customizationCompleted: true, sessions } } })) } as unknown as OverviewPlan);
const fallback = () => [];

test('all saved activity scenarios resolve the assigned type and lesson, without inventing gym content', () => {
    for (const preference of ['home', 'strength', 'gym']) {
        const result = projectWorkoutOverview(plan([{ dayOfWeek: 0, activity: 'WORKOUT', workoutPreference: preference,
            ...(preference === 'home' ? { workoutId: 'glute-bridge-challenge' } : {}) }]), '2026-11-02', 'Australia/Sydney', fallback);
        assert.equal(result.weeklyTarget, 1);
        assert.equal(result.todaySession?.workoutPreference, preference);
        if (preference === 'gym') assert.equal(result.todaySession?.workoutId, undefined);
        else assert.ok(result.todaySession?.workoutId);
        if (preference === 'home') assert.equal(result.todaySession?.workoutId, 'glute-bridge-challenge');
    }
    const result = projectWorkoutOverview(plan([{ dayOfWeek: 0, activity: 'RUN' }, { dayOfWeek: 2, activity: 'WALK' },
        { dayOfWeek: 4, activity: 'WORKOUT', workoutPreference: 'gym' }]), '2026-11-04', 'Australia/Sydney', () => [
        { dayOfWeek: 0, dayType: 'RUN', runType: 'Interval Run', runKm: 5 }, { dayOfWeek: 2, dayType: 'RUN', runType: 'Power Walk', runKm: 3 }]);
    assert.equal(result.weeklyTarget, 3);
    assert.equal(result.todaySession?.activity, 'WALK');
    assert.equal(result.todaySession?.distanceKm, 3);
    assert.equal(result.scheduled[0].runType, 'Interval Run');
    assert.equal(result.nextSession?.workoutPreference, 'gym');
});

test('recovery, Sunday rollover, later weeks, missing plans and end of plan', () => {
    const p = plan([{ dayOfWeek: 0, activity: 'RUN' }]);
    const sunday = projectWorkoutOverview(p, '2026-11-08', 'Australia/Sydney', fallback);
    assert.equal(sunday.todaySession, null);
    assert.equal(sunday.nextSession?.dayKey, '2026-11-09');
    assert.equal(sunday.nextSession?.week, 2);
    const monday = projectWorkoutOverview(p, '2026-11-09', 'Australia/Sydney', fallback);
    assert.equal(monday.weekStart, '2026-11-09');
    assert.equal(monday.todaySession?.week, 2);
    const ended = projectWorkoutOverview(p, '2026-11-16', 'Australia/Sydney', fallback);
    assert.equal(ended.ended, true); assert.equal(ended.weeklyTarget, 0); assert.equal(ended.nextSession, null);
    assert.equal(projectWorkoutOverview(null, '2026-11-02', 'UTC', fallback).hasPlan, false);
    assert.equal(projectWorkoutOverview(p, '2026-11-01', 'Australia/Sydney', fallback).weeklyTarget, 0);
});

test('legacy plans use persisted daily targets or the existing fallback projector', () => {
    const p = plan([]); p.weeklyPlans[0].weekDailys = {};
    let calls = 0;
    const result = projectWorkoutOverview(p, '2026-11-02', 'Australia/Sydney', () => { calls++; return [
        { dayOfWeek: 0, dayType: 'RUN', runType: 'Run–Walk', runKm: 4 },
        { dayOfWeek: 1, dayType: 'STEP', runType: null, runKm: 0 },
        { dayOfWeek: 2, dayType: 'RECOVERY', runType: null, runKm: 0 }]; });
    assert.ok(calls); assert.equal(result.weeklyTarget, 1); assert.equal(result.todaySession?.distanceKm, 4);
    assert.equal(result.todaySession?.workoutId, undefined);
});

test('completion unions photos, finished lessons and run targets once per scheduled day', () => {
    const scheduled = projectWorkoutOverview(plan([{ dayOfWeek: 0, activity: 'WORKOUT', workoutPreference: 'home' },
        { dayOfWeek: 1, activity: 'WORKOUT', workoutPreference: 'gym' }, { dayOfWeek: 2, activity: 'RUN' },
        { dayOfWeek: 3, activity: 'WALK' }, { dayOfWeek: 4, activity: 'WORKOUT', workoutPreference: 'strength' }]),
        '2026-11-06', 'Australia/Sydney', () => [{ dayOfWeek: 2, dayType: 'RUN', runType: 'Easy Run', runKm: 3 },
            { dayOfWeek: 3, dayType: 'RUN', runType: 'Walk', runKm: 2 }]).scheduled;
    const workouts = [
        { dayKey: '2026-11-02', type: 'OTHER', clientId: 'guided:plan:2026-11-02', endedAt: new Date(), distanceKm: 0 },
        { dayKey: '2026-11-03', type: 'GYM', clientId: 'manual', endedAt: new Date(), distanceKm: 0 },
        { dayKey: '2026-11-04', type: 'INTERVAL', clientId: 'run', endedAt: new Date(), distanceKm: 3 },
        { dayKey: '2026-11-05', type: 'WALK', clientId: 'walk', endedAt: new Date(), distanceKm: 1 },
        { dayKey: '2026-11-06', type: 'OTHER', clientId: 'guided:plan:2026-11-06', endedAt: null, distanceKm: 0 },
    ];
    assert.deepEqual(completedWorkoutDays(scheduled, '2026-11-06', ['2026-11-02', '2026-11-02', '2026-11-07'], workouts, []), ['2026-11-02', '2026-11-04']);
    assert.deepEqual(completedWorkoutDays(scheduled, '2026-11-06', ['2026-11-03'], [], [{ dayKey: '2026-11-05', runStatus: 'COMPLETED' }]), ['2026-11-03', '2026-11-05']);
    assert.deepEqual(completedWorkoutDays(scheduled, '2026-11-02', ['2026-11-03'], [], []), []);
});
