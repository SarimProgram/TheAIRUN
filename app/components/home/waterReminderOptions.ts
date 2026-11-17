import {
  buildPhotoReminderMessage,
  getReminderAssetsForCategory,
  photoReminderOption,
  REMINDER_ASSET_BY_ID,
  type PartnerReminderOption,
} from '@/components/partner/reminderAssets';

/** Hydration photo reminders surfaced from the home water goal sheet. */
export const HOME_WATER_REMINDER_OPTIONS: PartnerReminderOption[] =
  getReminderAssetsForCategory('hydration')
    .filter((asset) => asset.folder === 'Water')
    .slice(0, 3)
    .map(photoReminderOption);

export function buildHomeWaterCustomMessage(text: string): string {
  const body = text.trim();
  if (!body) {
    return buildPhotoReminderMessage('water-1');
  }
  return `[WATER:photo:water-1] ${body}`;
}

export const HOME_WATER_CUSTOM_OPTION: PartnerReminderOption = {
  id: 'home-water-custom',
  label: 'Your note',
  previewEyebrow: 'HYDRATION',
  previewTitle: 'Your hydration note',
  delivery: 'fullscreen',
  mode: 'photo',
  previewImage: REMINDER_ASSET_BY_ID['water-1']?.image,
  photoAnimation: 'float',
  pointsCost: 0,
  buildMessage: () => buildPhotoReminderMessage('water-1'),
};
