// app/constants/walkTheme.ts
// Visual language for walk sessions (walk, power walk, long walk).

import type { RunType } from '@/types/RunTemplate';

export const WALK_DESIGN_TEMPLATES: readonly RunType[] = ['walk', 'power_walk', 'long_walk'];

export function usesWalkDesign(templateId: RunType): boolean {
    return WALK_DESIGN_TEMPLATES.includes(templateId);
}

export const WALK_THEME = {
    accent: '#0D9488',
    accentLight: '#5EEAD4',
    accentText: '#0F766E',
    accentSoftSolid: '#E3F5F1',
    accentGlow: 'rgba(13, 148, 136, 0.25)',
    background: '#F8FBFA',
    backgroundClear: 'rgba(248, 251, 250, 0)',
    backgroundTint: '#EAF6F2',
    card: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#64748B',
    ringTrack: '#EDF1F0',
    divider: 'rgba(15, 23, 42, 0.08)',
    border: 'rgba(15, 23, 42, 0.04)',
    cardShadow: '0px 8px 24px rgba(15, 23, 42, 0.06)',
    buttonShadow: '0px 4px 14px rgba(15, 23, 42, 0.10)',
} as const;

// Google Maps style: soft park greens, bright water, white roads, quiet labels.
export const WALK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#EEF2EC' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7B8A84' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#F5F8F4' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#E9EDE7' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E3EEDC' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#BFE3AE' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3F7D4E' }] },
    { featureType: 'poi.park', elementType: 'labels.icon', stylers: [{ visibility: 'on' }, { color: '#4CAF63' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#DDE4DC' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94A09B' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D5DDD4' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#9FD3F2' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3E87B5' }] },
];
