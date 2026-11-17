import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTrainingSchedule, buildTrainingSchedule, readTrainingSchedule } from './trainingSchedule';

const base = { goalType: 'weightloss', weightKg: 85, heightCm: 175, ageYears: 35, availableDays: [0, 2, 4] };

test('all activity combinations respect the exact total and keep one activity per day', () => {
    for (const trainingStyle of ['workout', 'runOnly', 'walkOnly', 'workout, runOnly', 'workout, walkOnly', 'runOnly, walkOnly', 'workout, runOnly, walkOnly']) {
        for (let count = 1; count <= 7; count++) {
            const schedule = buildTrainingSchedule({ ...base, trainingStyle, workoutDaysPerWeek: count, workoutPreference: 'gym' });
            assert.equal(schedule.sessions.length, count);
            assert.equal(new Set(schedule.sessions.map(session => session.dayOfWeek)).size, count);
            const row = applyTrainingSchedule({ 'Run km/week': 21, 'Week Dailys': { runs: [{ runType: 'Easy Run', sessions: 7, targetKm: 3 }] } }, schedule);
            const wd = row['Week Dailys'];
            assert.equal(wd.runDays + wd.workoutDays, count);
            assert.equal(wd.recoveryDays + wd.runDays + wd.workoutDays, 7);
            assert.equal(wd.runs.reduce((sum: number, run: any) => sum + run.sessions, 0), wd.runDays);
            assert.equal(row['Run km/week'], Math.round(wd.runs.reduce((sum: number, run: any) => sum + run.targetKm, 0) * 10) / 10);
        }
    }
});

test('three running days means three runs and four recovery days', () => {
    const schedule = buildTrainingSchedule({ ...base, trainingStyle: 'runOnly', workoutDaysPerWeek: 3 });
    assert.deepEqual(schedule.sessions.map(session => session.dayOfWeek), [0, 2, 4]);
    assert.ok(schedule.sessions.every(session => session.activity === 'RUN'));
    const row = applyTrainingSchedule({ 'Run km/week': 15, 'Week Dailys': { runs: [{ runType: 'Walk', sessions: 5, targetKm: 3 }] } }, schedule);
    assert.equal(row['Week Dailys'].recoveryDays, 4);
    assert.ok(row['Week Dailys'].runs.every((run: any) => run.runType === 'Easy Run'));
});

test('workout-only plans never contain supporting cardio, for all workout preferences', () => {
    for (const workoutPreference of ['gym', 'home', 'strength']) {
        const schedule = buildTrainingSchedule({ ...base, trainingStyle: 'workout', workoutDaysPerWeek: 3, workoutPreference });
        const row = applyTrainingSchedule({ 'Run km/week': 10, 'Week Dailys': { runDays: 2, runs: [{ runType: 'Walk', sessions: 2, targetKm: 5 }] } }, schedule);
        assert.equal(row['Run km/week'], 0);
        assert.deepEqual(row['Week Dailys'].runs, []);
        assert.ok(schedule.sessions.every(session => session.workoutPreference === workoutPreference));
    }
});

test('mixed split responds to goal and lower-impact preferences without adding unselected activities', () => {
    const mixed = { ...base, trainingStyle: 'workout, runOnly, walkOnly', workoutDaysPerWeek: 4 };
    assert.equal(buildTrainingSchedule(mixed).sessions.filter(session => session.activity === 'WORKOUT').length, 2);
    assert.equal(buildTrainingSchedule({ ...mixed, goalType: 'running' }).sessions.filter(session => session.activity === 'RUN').length, 2);
    const lowImpact = buildTrainingSchedule({ ...mixed, workoutDaysPerWeek: 2, weightKg: 110 });
    assert.deepEqual(lowImpact.sessions.map(session => session.activity), ['WORKOUT', 'WALK']);
    assert.ok(buildTrainingSchedule({ ...mixed, trainingStyle: 'runOnly', weightKg: 110 }).sessions.every(session => session.activity === 'RUN'));
});

test('schedules round-trip, reject duplicate days and leave legacy metadata unversioned', () => {
    const schedule = buildTrainingSchedule({ ...base, trainingStyle: 'workout' });
    assert.deepEqual(readTrainingSchedule({ trainingSchedule: schedule }), schedule);
    assert.equal(readTrainingSchedule({ runDays: 3, runs: [] }), null);
    assert.equal(readTrainingSchedule({ trainingSchedule: { ...schedule, sessions: [schedule.sessions[0], schedule.sessions[0]] } }), null);
});

test('home recommendations use animated library IDs, vary by session, and preserve explicit choices', () => {
    const schedule = buildTrainingSchedule({ ...base, trainingStyle: 'workout', workoutDaysPerWeek: 3, workoutPreference: 'home' });
    const first = applyTrainingSchedule({ Week: 1, 'Run km/week': 0, 'Week Dailys': { runs: [] } }, schedule)['Week Dailys'].trainingSchedule;
    assert.deepEqual(first.sessions.map((session: any) => session.workoutId), ['partner-squats', 'jumping-jacks-together', 'couple-push-up-challenge']);
    const second = applyTrainingSchedule({ Week: 2, 'Run km/week': 0, 'Week Dailys': { runs: [] } }, schedule)['Week Dailys'].trainingSchedule;
    assert.notDeepEqual(first.sessions, second.sessions);
    assert.deepEqual(readTrainingSchedule({ trainingSchedule: first }), first);
    assert.deepEqual(applyTrainingSchedule({ Week: 2 }, first)['Week Dailys'].trainingSchedule, first);
});
