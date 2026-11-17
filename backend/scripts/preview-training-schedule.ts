import assert from 'node:assert/strict';
import { buildTrainingSchedule } from '../src/services/planning/trainingSchedule';

// Run the actual scheduling code without calling AI or writing to a user's plan.
const input = {
    goalType: 'weightloss',
    weightKg: 85,
    heightCm: 175,
    ageYears: 35,
    runExperience: 'beginner',
    trainingStyle: 'workout, runOnly',
    workoutDaysPerWeek: 3,
    workoutPreference: 'gym',
    availableDays: [0, 2, 4],
};
const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const schedule = buildTrainingSchedule(input);
const week = names.map((day, dayOfWeek) => {
    const session = schedule.sessions.find(session => session.dayOfWeek === dayOfWeek);
    return { day, activity: !session ? 'Recovery' : session.activity === 'WORKOUT'
        ? session.workoutPreference === 'gym' ? 'GYM' : `${session.workoutPreference} workout`
        : session.activity === 'RUN' ? 'Running' : 'Walking' };
});
assert.equal(schedule.sessions.length, 3);
assert.equal(week.filter(day => day.activity === 'GYM').length, 2);
assert.equal(week.filter(day => day.activity === 'Running').length, 1);
assert.equal(week.filter(day => day.activity === 'Recovery').length, 4);

console.log(JSON.stringify({
    mode: 'Actual local schedule allocator; no live AI call or database writes',
    input,
    output: { schedule, week, trainingDays: 3, gymDays: 2, runningDays: 1, recoveryDays: 4 },
    checks: 'passed',
}, null, 2));
