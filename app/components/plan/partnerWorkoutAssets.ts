import type { PartnerWorkoutAtlasLayout } from './partnerWorkoutCrop';

// This generated sheet has unequal row spacing. Equal 256px slices include
// neighboring exercises and cut off feet; use the clear gaps between silhouettes.
const SHEET_TWO_LAYOUT = {
  columns: 4, rows: 6, pixelWidth: 1024, pixelHeight: 1536,
  rowBounds: [[0, 298], [298, 579], [579, 866], [866, 1143], [1143, 1339], [1339, 1536]],
} satisfies PartnerWorkoutAtlasLayout;

export const PARTNER_WORKOUT_SHEETS: Record<string, PartnerWorkoutAtlasLayout & { source: number; firstFrame: number }> = {
  'partner-squats': { source: require('../../assets/exercise/partner-squats-sheet-v2.png'), columns: 4, rows: 4, firstFrame: 4 },
  'plank-high-fives': { source: require('../../assets/exercise/partner-workouts-sheet-1-v1.png'), columns: 4, rows: 6, firstFrame: 0 },
  'couple-push-up-challenge': { source: require('../../assets/exercise/partner-workouts-sheet-1-v1.png'), columns: 4, rows: 6, firstFrame: 8 },
  'partner-sit-ups': { source: require('../../assets/exercise/partner-workouts-sheet-1-v1.png'), columns: 4, rows: 6, firstFrame: 16 },
  'synchronized-lunges': { source: require('../../assets/exercise/partner-workouts-sheet-2-v1.png'), ...SHEET_TWO_LAYOUT, firstFrame: 0 },
  'wall-sit-challenge': { source: require('../../assets/exercise/partner-workouts-sheet-2-v1.png'), ...SHEET_TWO_LAYOUT, firstFrame: 8 },
  'mountain-climber-race': { source: require('../../assets/exercise/partner-workouts-sheet-2-v1.png'), ...SHEET_TWO_LAYOUT, firstFrame: 16 },
  'jumping-jacks-together': { source: require('../../assets/exercise/partner-workouts-sheet-3-v1.png'), columns: 4, rows: 6, firstFrame: 0 },
  'glute-bridge-challenge': { source: require('../../assets/exercise/partner-workouts-sheet-3-v1.png'), columns: 4, rows: 6, firstFrame: 8 },
  'couple-dance-cardio': { source: require('../../assets/exercise/partner-workouts-sheet-3-v1.png'), columns: 4, rows: 6, firstFrame: 16 },
};

