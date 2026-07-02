// app/lib/cues/index.ts

import { EASY_RUN_CUES } from './easy';
import { INTERVAL_RUN_CUES } from './interval';
import { RunType } from '@/types/RunTemplate';

export const ALL_CUES: Record<RunType, string[]> = {
    easy: EASY_RUN_CUES,
    interval: INTERVAL_RUN_CUES,
    interval_walk: [
        "Stay tall and use the arms to help your fast walk pace.",
        "Recovery block: breathe, reset, and get ready for the next fast walk.",
        "Quick feet, relaxed shoulders, controlled rhythm.",
        "Keep the stride smooth. Fast does not mean tense.",
    ],
    long: [
        "Settle into a rhythm you can maintain for a long time.",
        "Check your posture. Head up, core engaged.",
        "Hydration check! Remember to sip if you have water.",
        "The halfway point is just a mental milestone. You've got this.",
    ],
    walk: [
        "Enjoy the movement. Feel your muscles working.",
        "Take in your surroundings. This is your time.",
        "Keep a brisk pace to keep the heart rate slightly elevated.",
    ],
    freeform: [
        "Today is your day. Choose the pace that feels right.",
        "Listen to your body. Push if you want, rest if you need.",
    ],
    power_walk: [
        "Walk a little faster than normal and stay relaxed.",
        "Swing your arms and let them help your pace.",
        "Stand tall and keep your steps quick and smooth.",
        "This pace should feel brisk, but still in control.",
        "Keep moving well. No need to rush.",
    ],
    long_walk: [
        "Settle into a steady walking rhythm you can maintain.",
        "Relax your shoulders and keep your stride smooth.",
        "Long walk focus: posture tall, arms swinging naturally.",
        "Stay consistent. This session builds endurance step by step.",
        "Finish strong, but keep it low impact and controlled.",
    ],
    goal_practice: [
        "Settle in early. This run is about control across the full distance.",
        "Hold a pace you can defend all the way to the finish.",
        "Stay smooth, stay patient, and practise how you want to race.",
    ],
};

export function getCuesForRun(type: RunType): string[] {
    return ALL_CUES[type] || ALL_CUES['freeform'];
}
