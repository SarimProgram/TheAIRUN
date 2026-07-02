import { RunGenerator } from "../types";

function round(value: number) {
    return Math.round(value * 10) / 10;
}

export const goalPracticeRunGenerator: RunGenerator = (
    targetKm: number,
) => {
    const distanceKm = Math.max(1, round(targetKm));

    return [
        {
            type: "run",
            label: "Goal Practice Run",
            distanceKm,
            target: {
                effort: "Steady",
            },
        },
    ];
};
