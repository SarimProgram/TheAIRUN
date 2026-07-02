// app/lib/run-templates.ts

import type { RunTemplate, RunType } from '@/types/RunTemplate';

export const RUN_TEMPLATES: Record<RunType, RunTemplate> = {
    easy: {
        id: 'easy',
        title: 'EASY RUN',
        sessionAims: [
            { icon: 'brain', text: 'Build Aerobic Base' },
            { icon: 'flame', text: 'Optimize Fat Metabolism' },
            { icon: 'heart', text: 'Low-Stress Recovery' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 2.0,
        paceZones: [
            { label: 'WARM UP', minPaceSecPerKm: 420, maxPaceSecPerKm: 600, color: '#475569' },
            { label: 'IDEAL FAT BURN', minPaceSecPerKm: 330, maxPaceSecPerKm: 420, color: '#2DD4BF' },
            { label: 'CARDIO', minPaceSecPerKm: 240, maxPaceSecPerKm: 330, color: '#F472B6' },
        ],
        targetZoneIndex: 1,
        cues: ['FAT-BURN ZONE ACTIVE • KEEP STEADY', 'STAY CONVERSATIONAL', 'BREATHE EASY'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: MAXIMIZE FAT BURN',
        primaryColor: '#2DD4BF',
        secondaryColor: '#F472B6',
        phases: [
            { label: 'WARM UP', color: '#F59E0B', durationPercent: 15 },
            { label: 'RUN', color: '#2DD4BF', durationPercent: 70 },
            { label: 'SLOW DOWN', color: '#22C55E', durationPercent: 15 },
        ],
    },

    long: {
        id: 'long',
        title: 'LONG RUN',
        sessionAims: [
            { icon: 'target', text: 'Build Endurance' },
            { icon: 'heart', text: 'Strengthen Heart' },
            { icon: 'zap', text: 'Mental Toughness' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 5.0,
        paceZones: [
            { label: 'TOO SLOW', minPaceSecPerKm: 480, maxPaceSecPerKm: 600, color: '#475569' },
            { label: 'ENDURANCE', minPaceSecPerKm: 360, maxPaceSecPerKm: 480, color: '#3B82F6' },
            { label: 'TEMPO', minPaceSecPerKm: 270, maxPaceSecPerKm: 360, color: '#F59E0B' },
        ],
        targetZoneIndex: 1,
        cues: ['STEADY PACE • SAVE ENERGY FOR LATER', 'YOU GOT THIS', 'STAY STRONG'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: BUILD ENDURANCE',
        primaryColor: '#3B82F6',
        secondaryColor: '#F59E0B',
        phases: [
            { label: 'WARM UP', color: '#F59E0B', durationPercent: 10 },
            { label: 'ENDURANCE', color: '#3B82F6', durationPercent: 80 },
            { label: 'COOL DOWN', color: '#22C55E', durationPercent: 10 },
        ],
    },

    interval: {
        id: 'interval',
        title: 'INTERVAL',
        sessionAims: [
            { icon: 'zap', text: 'Boost Speed' },
            { icon: 'flame', text: 'Max Calorie Burn' },
            { icon: 'heart', text: 'VO2 Max Training' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 3.0,
        paceZones: [
            { label: 'RECOVERY', minPaceSecPerKm: 420, maxPaceSecPerKm: 600, color: '#22C55E' },
            { label: 'TEMPO', minPaceSecPerKm: 300, maxPaceSecPerKm: 420, color: '#F59E0B' },
            { label: 'SPRINT', minPaceSecPerKm: 180, maxPaceSecPerKm: 300, color: '#EF4444' },
        ],
        targetZoneIndex: 2,
        cues: ['PUSH IT! SPRINT ZONE', 'RECOVER • BREATHE', 'NEXT INTERVAL COMING'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: SPEED & POWER',
        primaryColor: '#EF4444',
        secondaryColor: '#F59E0B',
    },

    interval_walk: {
        id: 'interval_walk',
        title: 'INTERVAL WALK',
        sessionAims: [
            { icon: 'heart', text: 'Low-Impact Cardio' },
            { icon: 'brain', text: 'Build Walking Rhythm' },
            { icon: 'flame', text: 'Recover While Moving' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 2.2,
        paceZones: [
            { label: 'RECOVERY WALK', minPaceSecPerKm: 720, maxPaceSecPerKm: 1080, color: '#94A3B8' },
            { label: 'FAST WALK', minPaceSecPerKm: 540, maxPaceSecPerKm: 720, color: '#14B8A6' },
            { label: 'BRISK PUSH', minPaceSecPerKm: 420, maxPaceSecPerKm: 540, color: '#0F766E' },
        ],
        targetZoneIndex: 1,
        cues: ['FAST WALK BLOCK', 'RESET ON THE RECOVERY WALK', 'STAY TALL AND SMOOTH'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: CONTROLLED WALKING INTERVALS',
        primaryColor: '#14B8A6',
        secondaryColor: '#3B82F6',
        paceRangeLabel: '14:00–9:00 / km',
        phases: [
            { label: 'WARM UP WALK', color: '#94A3B8', durationPercent: 15 },
            { label: 'FAST WALK', color: '#14B8A6', durationPercent: 70 },
            { label: 'COOL DOWN WALK', color: '#22C55E', durationPercent: 15 },
        ],
    },

    walk: {
        id: 'walk',
        title: 'WALK',
        sessionAims: [
            { icon: 'heart', text: 'Active Recovery' },
            { icon: 'brain', text: 'Clear Your Mind' },
            { icon: 'flame', text: 'Burn Extra Calories' },
        ],
        distanceMode: 'user',
        defaultDistanceKm: 2.0,
        paceZones: [
            { label: 'STROLL', minPaceSecPerKm: 720, maxPaceSecPerKm: 900, color: '#94A3B8' },
            { label: 'BRISK', minPaceSecPerKm: 540, maxPaceSecPerKm: 720, color: '#22C55E' },
            { label: 'POWER WALK', minPaceSecPerKm: 420, maxPaceSecPerKm: 540, color: '#3B82F6' },
        ],
        targetZoneIndex: 1,
        cues: ['ENJOY THE WALK', 'BRISK PACE • FEEL GOOD', 'ALMOST THERE'],
        hud: { showPaceBar: true, showZoneIndicator: false, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: ACTIVE RECOVERY',
        primaryColor: '#22C55E',
        secondaryColor: '#3B82F6',
        phases: [
            { label: 'START', color: '#94A3B8', durationPercent: 20 },
            { label: 'BRISK WALK', color: '#22C55E', durationPercent: 60 },
            { label: 'COOL DOWN', color: '#94A3B8', durationPercent: 20 },
        ],
    },

    freeform: {
        id: 'freeform',
        title: 'FREE RUN',
        sessionAims: [
            { icon: 'zap', text: 'Run Your Way' },
            { icon: 'target', text: 'Set Your Own Goals' },
            { icon: 'flame', text: 'Any Pace Works' },
        ],
        distanceMode: 'user',
        defaultDistanceKm: 5.0,
        paceZones: [
            { label: 'EASY', minPaceSecPerKm: 420, maxPaceSecPerKm: 600, color: '#22C55E' },
            { label: 'MODERATE', minPaceSecPerKm: 300, maxPaceSecPerKm: 420, color: '#3B82F6' },
            { label: 'FAST', minPaceSecPerKm: 180, maxPaceSecPerKm: 300, color: '#EF4444' },
        ],
        targetZoneIndex: 1,
        cues: ['RUN YOUR OWN PACE', 'YOU DECIDE THE INTENSITY', 'KEEP GOING'],
        hud: { showPaceBar: true, showZoneIndicator: false, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: ENJOY THE RUN',
        primaryColor: '#3B82F6',
        secondaryColor: '#F472B6',
        phases: [
            { label: 'WARM UP', color: '#F59E0B', durationPercent: 15 },
            { label: 'RUN', color: '#3B82F6', durationPercent: 70 },
            { label: 'SLOW DOWN', color: '#22C55E', durationPercent: 15 },
        ],
    },

    power_walk: {
        id: 'power_walk',
        title: 'POWER WALK',
        sessionAims: [
            { icon: 'heart', text: 'Cardiovascular Health' },
            { icon: 'flame', text: 'Burn Calories Efficiently' },
            { icon: 'brain', text: 'Low Impact Exercise' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 3.0,
        paceZones: [
            { label: 'CASUAL', minPaceSecPerKm: 900, maxPaceSecPerKm: 1200, color: '#94A3B8' },
            { label: 'BEST ZONE', minPaceSecPerKm: 645, maxPaceSecPerKm: 750, color: '#8B5CF6' }, // 10:45-12:30 min/km
            { label: 'BRISK', minPaceSecPerKm: 540, maxPaceSecPerKm: 645, color: '#3B82F6' },
        ],
        targetZoneIndex: 1,
        cues: ['WALK A LITTLE FASTER THAN NORMAL', 'SWING YOUR ARMS AND STAY TALL', 'BRISK AND STEADY IS ENOUGH'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: ACTIVE & HEALTHY',
        primaryColor: '#8B5CF6',
        secondaryColor: '#EC4899',
        paceRangeLabel: '12:30–10:45 / km',
        phases: [
            { label: 'WARM UP', color: '#F59E0B', durationPercent: 15 },
            { label: 'POWER WALK', color: '#8B5CF6', durationPercent: 70 },
            { label: 'COOL DOWN', color: '#22C55E', durationPercent: 15 },
        ],
    },

    long_walk: {
        id: 'long_walk',
        title: 'LONG WALK',
        sessionAims: [
            { icon: 'heart', text: 'Build Walking Endurance' },
            { icon: 'flame', text: 'Sustainable Calorie Burn' },
            { icon: 'brain', text: 'Low-Stress Consistency' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 5.0,
        paceZones: [
            { label: 'EASY', minPaceSecPerKm: 900, maxPaceSecPerKm: 1140, color: '#94A3B8' },
            { label: 'ENDURANCE WALK', minPaceSecPerKm: 720, maxPaceSecPerKm: 900, color: '#10B981' },
            { label: 'BRISK FINISH', minPaceSecPerKm: 600, maxPaceSecPerKm: 720, color: '#3B82F6' },
        ],
        targetZoneIndex: 1,
        cues: ['LONG WALK MODE • STEADY AND SMOOTH', 'POSTURE TALL • KEEP MOVING', 'CONSISTENCY BUILDS RESULTS'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: ENDURANCE WALKING',
        primaryColor: '#10B981',
        secondaryColor: '#3B82F6',
        paceRangeLabel: '15:00–12:00 / km',
        phases: [
            { label: 'WARM UP', color: '#F59E0B', durationPercent: 10 },
            { label: 'LONG WALK', color: '#10B981', durationPercent: 80 },
            { label: 'COOL DOWN', color: '#22C55E', durationPercent: 10 },
        ],
    },

    goal_practice: {
        id: 'goal_practice',
        title: 'GOAL PRACTICE',
        sessionAims: [
            { icon: 'target', text: 'Rehearse Race Distance' },
            { icon: 'brain', text: 'Stay Controlled' },
            { icon: 'heart', text: 'Finish Confident' },
        ],
        distanceMode: 'schedule',
        defaultDistanceKm: 5.0,
        paceZones: [
            { label: 'CONTROL', minPaceSecPerKm: 420, maxPaceSecPerKm: 540, color: '#64748B' },
            { label: 'PRACTICE', minPaceSecPerKm: 300, maxPaceSecPerKm: 420, color: '#F97316' },
            { label: 'PUSH', minPaceSecPerKm: 210, maxPaceSecPerKm: 300, color: '#DC2626' },
        ],
        targetZoneIndex: 1,
        cues: ['SETTLE INTO YOUR GOAL DISTANCE', 'PRACTICE CONTROLLED EFFORT', 'STAY SMOOTH TO THE FINISH'],
        hud: { showPaceBar: true, showZoneIndicator: true, showCalories: true, showHeartRate: false, showCues: true },
        goalText: 'GOAL: PRACTICE YOUR RACE DISTANCE',
        primaryColor: '#F97316',
        secondaryColor: '#DC2626',
        phases: [
            { label: 'PRACTICE RUN', color: '#F97316', durationPercent: 100 },
        ],
    },
};

export function getRunTemplate(id: RunType): RunTemplate {
    return RUN_TEMPLATES[id] || RUN_TEMPLATES['easy'];
}
