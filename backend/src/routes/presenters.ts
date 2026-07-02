import { User, UserPlan } from '@prisma/client';
import { presentBillingSnapshot } from '../services/billing';
import { normalizeNotificationPreferences } from '../lib/notificationPreferences';

export function presentUser(user: User & { billingProfile?: any | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    partnerId: user.partnerId,
    age: user.age,
    gender: user.gender,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    timezone: user.timezone,
    units: user.units,
    baselinePaceSecPerKm: user.baselinePaceSecPerKm,
    billing: presentBillingSnapshot((user as any).billingProfile),
    notificationPreferences: normalizeNotificationPreferences((user as any).notificationPreferences),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function presentPlan(plan: UserPlan) {
  return {
    id: plan.id,
    weightKg: plan.weightKg,
    heightCm: plan.heightCm,
    ageYears: plan.ageYears,
    goalType: plan.goalType,
    targetWeightKg: plan.targetWeightKg,
    weightToLoseKg: plan.weightToLoseKg,
    timeHorizon: plan.timeHorizon,
    targetDate: plan.targetDate,
    activityPreference: plan.activityPreference,
    intensityLevel: plan.intensityLevel,
    availableDays: plan.availableDays,
    dailyCalorieTarget: plan.dailyCalorieTarget,
    dailyActivityMins: plan.dailyActivityMins,
    currentWeek: plan.currentWeek,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}
