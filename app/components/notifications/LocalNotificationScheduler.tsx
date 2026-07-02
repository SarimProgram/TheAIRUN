import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { API_BASE_URL } from '@/config/api';
import { loadRuns } from '@/lib/run-storage';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import type { BillingAccessSnapshot } from '@/src/billing/types';
import {
  cacheNotificationPreferences,
  loadCachedNotificationPreferences,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/utils/notificationPreferences';

const MANAGED_LOCAL_NOTIFICATION_IDS_KEY = 'managed_local_notification_ids_v1';
const REDEEMED_WEEK_PREFIX = 'weekly_quest_redeemed_v1';

type ManagedNotificationRequest = {
  key: string;
  content: Notifications.NotificationContentInput;
  trigger: Notifications.NotificationTriggerInput;
};

type ScheduledRun = {
  id: string;
  partnerName: string;
  scheduledTime: string;
  distanceKm: number;
  status: string;
};

function notificationPermissionGranted(permission: unknown) {
  const value = permission as { granted?: boolean; status?: string };
  return value.granted === true || value.status === 'granted';
}

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function nextDateAt(hour: number, minute: number) {
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return dateTrigger(next);
}

function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
  };
}

function dailyTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

async function loadManagedLocalNotificationIds(): Promise<Record<string, string>> {
  const rawValue = await AsyncStorage.getItem(MANAGED_LOCAL_NOTIFICATION_IDS_KEY);
  if (!rawValue) return {};

  try {
    return JSON.parse(rawValue);
  } catch {
    return {};
  }
}

async function replaceManagedLocalNotifications(entries: ManagedNotificationRequest[]) {
  const existing = await loadManagedLocalNotificationIds();
  await Promise.all(
    Object.values(existing).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );

  const nextMap: Record<string, string> = {};
  for (const entry of entries) {
    const id = await Notifications.scheduleNotificationAsync({
      content: entry.content,
      trigger: entry.trigger,
    });
    nextMap[entry.key] = id;
  }

  await AsyncStorage.setItem(MANAGED_LOCAL_NOTIFICATION_IDS_KEY, JSON.stringify(nextMap));
}

async function clearManagedLocalNotifications() {
  await replaceManagedLocalNotifications([]);
}

async function fetchJsonIfOk(authFetch: (url: string, options?: RequestInit) => Promise<Response>, url: string) {
  const response = await authFetch(url);
  if (!response.ok) return null;
  return response.json();
}

async function buildQuestReminder(authFetch: (url: string, options?: RequestInit) => Promise<Response>) {
  const weekData = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/summary/week`);
  const weeklyPlanData = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/plan/weekly`);
  if (!weekData || !weeklyPlanData) return null;

  const currentWeek = typeof weekData.currentWeek === 'number' ? weekData.currentWeek : 1;
  const weeklyPlan = Array.isArray(weeklyPlanData?.['Weekly Plan Table']) ? weeklyPlanData['Weekly Plan Table'] : [];
  const currentWeekPlan = weeklyPlan.find((week: any) => week?.Week === currentWeek);
  const weekDailys = currentWeekPlan?.['Week Dailys'];
  const runs = Array.isArray(weekDailys?.runs) ? weekDailys.runs : [];
  const longestPlannedKm = runs.reduce((max: number, item: any) => {
    const targetKm = Number(item?.distanceKm ?? item?.km ?? 0);
    return Math.max(max, Number.isFinite(targetKm) ? targetKm : 0);
  }, 0);

  if (longestPlannedKm <= 0) return null;

  const requiredKm = Number((longestPlannedKm * 2).toFixed(1));
  const weekStart = getStartOfWeek(new Date());
  const redeemedKey = `${REDEEMED_WEEK_PREFIX}:${weekStart.toISOString().slice(0, 10)}`;
  const [redeemedRaw, localRuns] = await Promise.all([AsyncStorage.getItem(redeemedKey), loadRuns()]);

  const completedQuestRun = localRuns.some((run) => {
    const startedAt = new Date(run.startedAt).getTime();
    const inCurrentWeek = startedAt >= weekStart.getTime();
    const runKm = (run.totalDistanceMeters || 0) / 1000;
    return inCurrentWeek && runKm >= requiredKm;
  });

  if (!completedQuestRun || redeemedRaw === 'true') {
    return null;
  }

  const triggerAt = new Date(Date.now() + 15 * 60 * 1000);
  return {
    key: 'weekly_quest_reminder',
    content: {
      title: 'Quest reward ready',
      body: `You completed this week's ${requiredKm.toFixed(1)}km quest. Redeem your points.`,
      data: { type: 'weekly_quest_reminder' },
    },
    trigger: dateTrigger(triggerAt),
  } satisfies ManagedNotificationRequest;
}

function buildBillingReminder(access: BillingAccessSnapshot | null): ManagedNotificationRequest | null {
  if (!access) return null;

  const upcomingRaw = access.trialEndsAt || access.premiumExpiresAt;
  if (!upcomingRaw) return null;

  const upcomingDate = new Date(upcomingRaw);
  if (Number.isNaN(upcomingDate.getTime()) || upcomingDate.getTime() <= Date.now()) {
    return null;
  }

  const triggerAt = new Date(upcomingDate.getTime() - 24 * 60 * 60 * 1000);
  const scheduledAt = triggerAt.getTime() > Date.now() ? triggerAt : new Date(Date.now() + 60 * 60 * 1000);
  const label = access.trialEndsAt ? 'trial' : 'subscription';

  return {
    key: 'billing_reminder',
    content: {
      title: 'Billing reminder',
      body: `Your ${label} changes on ${upcomingDate.toLocaleDateString()}. Review your access details.`,
      data: { type: 'billing_reminder' },
    },
    trigger: dateTrigger(scheduledAt),
  };
}

export default function LocalNotificationScheduler() {
  const { authFetch, isAuthenticated } = useAuth();
  const { access } = useEntitlement();

  useEffect(() => {
    if (!isAuthenticated) {
      clearManagedLocalNotifications().catch(() => {});
      return;
    }

    let active = true;

    const syncNotifications = async () => {
      if (!active) return;

      const profileRes = await authFetch(`${API_BASE_URL}/profile`);
      let preferences: NotificationPreferences = await loadCachedNotificationPreferences();

      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        preferences = normalizeNotificationPreferences(profileJson?.user?.notificationPreferences);
        await cacheNotificationPreferences(preferences);
      }

      const permission = await Notifications.getPermissionsAsync();
      if (!notificationPermissionGranted(permission)) {
        await clearManagedLocalNotifications();
        return;
      }

      const entries: ManagedNotificationRequest[] = [];

      const weekData = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/summary/week`);
      const todaySummary = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/summary/today`);
      const currentWeek = typeof weekData?.currentWeek === 'number' ? weekData.currentWeek : 1;
      const dailyPlan = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/plan/daily/${currentWeek}`);

      if (preferences.dailyPlanReminder) {
        const planDays = Array.isArray(dailyPlan?.days) ? dailyPlan.days : [];
        const todayIndex = (new Date().getDay() + 6) % 7;
        const todayPlan = planDays.find((day: any) => day?.dayOfWeek === todayIndex) || planDays[0];

        if (todayPlan) {
          const planParts = [
            `${Math.round(todayPlan.stepsTarget || 0)} steps`,
            `${Math.round(todayPlan.calorieTarget || 0)} kcal`,
          ];

          if ((todayPlan.runKm || 0) > 0) {
            planParts.push(`${Number(todayPlan.runKm).toFixed(1)}km ${todayPlan.runType || 'run'}`);
          }

          entries.push({
            key: 'daily_plan_reminder',
            content: {
              title: "Today's plan",
              body: planParts.join(' | '),
              data: { type: 'daily_plan_reminder' },
            },
            trigger: nextDateAt(8, 0),
          });
        }
      }

      if (preferences.mealLoggingReminder) {
        entries.push(
          {
            key: 'meal_logging_lunch',
            content: {
              title: 'Meal check-in',
              body: 'Log lunch so your calorie target stays accurate.',
              data: { type: 'meal_logging_reminder' },
            },
            trigger: dailyTrigger(12, 30),
          },
          {
            key: 'meal_logging_dinner',
            content: {
              title: 'Dinner reminder',
              body: 'Log dinner before the day ends.',
              data: { type: 'meal_logging_reminder' },
            },
            trigger: dailyTrigger(18, 30),
          }
        );
      }

      if (preferences.stepTargetReminder && todaySummary?.stepsTarget && todaySummary?.steps < todaySummary?.stepsTarget) {
        const remainingSteps = Math.max(0, Number(todaySummary.stepsTarget) - Number(todaySummary.steps || 0));
        const now = new Date();
        let triggerAt = new Date();
        triggerAt.setHours(19, 0, 0, 0);
        if (triggerAt.getTime() <= now.getTime()) {
          triggerAt = new Date(now.getTime() + 30 * 60 * 1000);
        }

        if (remainingSteps > 0) {
          entries.push({
            key: 'step_target_reminder',
            content: {
              title: 'Step target at risk',
              body: `${remainingSteps.toLocaleString()} steps left to finish today strong.`,
              data: { type: 'step_target_reminder' },
            },
            trigger: dateTrigger(triggerAt),
          });
        }
      }

      if (preferences.scheduledRunReminder) {
        const activeRuns = await fetchJsonIfOk(authFetch, `${API_BASE_URL}/runtogether/active`);
        const runs = [
          ...(Array.isArray(activeRuns?.sent) ? activeRuns.sent : []),
          ...(Array.isArray(activeRuns?.received) ? activeRuns.received : []),
        ] as ScheduledRun[];

        runs
          .filter((run) => run.status === 'ACCEPTED')
          .forEach((run) => {
            const scheduledAt = new Date(run.scheduledTime);
            const reminderAt = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
            if (reminderAt.getTime() <= Date.now()) return;

            entries.push({
              key: `scheduled_run_${run.id}`,
              content: {
                title: 'Scheduled run soon',
                body: `${Number(run.distanceKm).toFixed(1)}km with ${run.partnerName} at ${formatClock(scheduledAt)}.`,
                data: { type: 'scheduled_run_reminder' },
              },
              trigger: dateTrigger(reminderAt),
            });
          });
      }

      if (preferences.weeklyQuestReminder) {
        const questReminder = await buildQuestReminder(authFetch);
        if (questReminder) {
          entries.push(questReminder);
        }
      }

      if (preferences.billingReminder) {
        const billingReminder = buildBillingReminder(access);
        if (billingReminder) {
          entries.push(billingReminder);
        }
      }

      await replaceManagedLocalNotifications(entries);
    };

    syncNotifications().catch((err) => {
      console.log('[LocalNotificationScheduler] sync failed', err);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNotifications().catch((err) => {
          console.log('[LocalNotificationScheduler] active sync failed', err);
        });
      }
    });

    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [access, authFetch, isAuthenticated]);

  return null;
}
