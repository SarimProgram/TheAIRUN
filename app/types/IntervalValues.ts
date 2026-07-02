export type SegmentType = 'warmup' | 'run' | 'walk' | 'cooldown';

export interface IntervalSegment {
    id: string;
    type: SegmentType;
    durationSec: number;
    label: string;
    targetPace?: string; // e.g. "5:00 - 5:30"
    targetDistanceKm?: number;
    advanceBy?: 'time' | 'distance';
    color: string;
}

export const INTERVAL_COLORS = {
    warmup: '#94A3B8', // Slate 400
    run: '#EF4444',    // Red 500 (High intensity)
    walk: '#3B82F6',   // Blue 500 (Recovery)
    cooldown: '#10B981' // Emerald 500
};

export const MOCK_INTERVAL_SESSION: IntervalSegment[] = [
    { id: '1', type: 'warmup', durationSec: 300, label: 'Warm Up', targetDistanceKm: 0.6, advanceBy: 'time', color: INTERVAL_COLORS.warmup },
    { id: '2', type: 'run', durationSec: 60, label: 'Fast Run', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.run },
    { id: '3', type: 'walk', durationSec: 90, label: 'Recover', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.walk },
    { id: '4', type: 'run', durationSec: 60, label: 'Fast Run', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.run },
    { id: '5', type: 'walk', durationSec: 90, label: 'Recover', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.walk },
    { id: '6', type: 'run', durationSec: 60, label: 'Fast Run', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.run },
    { id: '7', type: 'walk', durationSec: 90, label: 'Recover', targetDistanceKm: 0.2, advanceBy: 'time', color: INTERVAL_COLORS.walk },
    { id: '8', type: 'cooldown', durationSec: 300, label: 'Cool Down', targetDistanceKm: 0.6, advanceBy: 'time', color: INTERVAL_COLORS.cooldown },
];
