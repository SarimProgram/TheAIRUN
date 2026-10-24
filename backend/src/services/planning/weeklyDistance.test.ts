import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGeneratedWeeklyDistances } from "./weeklyDistance";

function week(runKm: number, runs: Array<{ runType: string; sessions: number; targetKm: number | null }>) {
    return {
        Week: 1,
        "Run km/week": runKm,
        "Week Dailys": { stepDays: 4, runDays: 3, recoveryDays: 0, runs },
    };
}

test("gives walk-only sessions a positive weekly distance when AI returns zero", () => {
    const [normalized] = normalizeGeneratedWeeklyDistances([
        week(0, [{ runType: "Power Walk", sessions: 3, targetKm: null }]),
    ]);

    assert.equal(normalized["Run km/week"], 6);
});

test("preserves a sufficient weekly distance returned by AI", () => {
    const [normalized] = normalizeGeneratedWeeklyDistances([
        week(12, [{ runType: "Power Walk", sessions: 3, targetKm: null }]),
    ]);

    assert.equal(normalized["Run km/week"], 12);
});

test("covers fixed targets and supplies distance for remaining sessions", () => {
    const [normalized] = normalizeGeneratedWeeklyDistances([
        week(0, [
            { runType: "Walk", sessions: 1, targetKm: 2.5 },
            { runType: "Easy Run", sessions: 1, targetKm: null },
        ]),
    ]);

    assert.equal(normalized["Run km/week"], 5.5);
});

test("allows zero distance when no walk or run sessions are scheduled", () => {
    const original = week(0, []);
    const [normalized] = normalizeGeneratedWeeklyDistances([original]);

    assert.equal(normalized["Run km/week"], 0);
});
