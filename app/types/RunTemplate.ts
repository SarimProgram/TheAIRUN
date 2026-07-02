// app/types/RunTemplate.ts

export type RunType = 'easy' | 'long' | 'interval' | 'interval_walk' | 'walk' | 'freeform' | 'power_walk' | 'long_walk' | 'goal_practice';

export interface PaceZone {
    label: string;           // "Fat Burn", "Cardio", etc.
    minPaceSecPerKm: number; // Lower bound (faster pace)
    maxPaceSecPerKm: number; // Upper bound (slower pace)
    color: string;
}

export interface SessionAim {
    icon: 'brain' | 'flame' | 'heart' | 'zap' | 'target';
    text: string;
}

export interface HUDConfig {
    showPaceBar: boolean;
    showZoneIndicator: boolean;
    showCalories: boolean;
    showHeartRate: boolean;
    showCues: boolean;
}

export interface RunTemplate {
    id: RunType;
    title: string;           // "EASY RUN", "LONG RUN", etc.
    sessionAims: SessionAim[];

    // Distance configuration
    distanceMode: 'fixed' | 'user' | 'schedule';
    defaultDistanceKm: number;

    // Pace zones for the pace bar (left to right)
    paceZones: PaceZone[];
    targetZoneIndex: number; // Which zone is the "ideal" zone

    // Audio/visual cues shown during run
    cues: string[];

    // HUD widget visibility
    hud: HUDConfig;

    // Result screen config
    goalText: string;

    // Theme colors
    primaryColor: string;
    secondaryColor: string;

    // Phase configuration for phase text overlay (optional)
    phases?: {
        label: string;      // "WARM UP", "RUN", "SLOW DOWN"
        color: string;
        durationPercent: number; // Percentage of total run (0-100)
    }[];

    // Custom pace range label for display (e.g., "12:30–10:45 / km")
    paceRangeLabel?: string;
}

export interface RunSessionParams {
    templateId: RunType;
    targetDistanceKm?: number;  // Override from schedule or user input
    weekContext?: string;       // "Week 1 • Foundation"
    runType?: string;           // "Easy Run" from daily target
}
