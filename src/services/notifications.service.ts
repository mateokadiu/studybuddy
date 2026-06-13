/**
 * Daily review reminders via expo-notifications.
 *
 * Per settings.dailyReviewTime ("HH:mm"), schedule a single repeating
 * notification per device. Re-schedules whenever the user changes the time
 * from settings.
 */

import type { LlmModelId } from '@/stores/settings.store';

interface Notifications {
  requestPermissionsAsync?: () => Promise<{ status: string }>;
  setNotificationChannelAsync?: (id: string, channel: unknown) => Promise<void>;
  cancelAllScheduledNotificationsAsync?: () => Promise<void>;
  scheduleNotificationAsync?: (req: {
    content: { title: string; body?: string };
    trigger: unknown;
  }) => Promise<string>;
}

function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function load(): Notifications | null {
  if (isNode()) return null;
  try {
    return require('expo-notifications') as Notifications;
  } catch {
    return null;
  }
}

export interface ReminderState {
  scheduled: boolean;
  /** "HH:mm" 24h */
  time: string;
}

export async function ensureReminder(time: string, modelId: LlmModelId): Promise<ReminderState> {
  const n = load();
  if (!n?.scheduleNotificationAsync) return { scheduled: false, time };

  if (n.requestPermissionsAsync) {
    const perm = await n.requestPermissionsAsync();
    if (perm.status !== 'granted') return { scheduled: false, time };
  }
  if (n.setNotificationChannelAsync) {
    await n.setNotificationChannelAsync('reviews', {
      name: 'reviews',
      importance: 3,
      sound: 'default',
    });
  }

  await n.cancelAllScheduledNotificationsAsync?.();

  const [hh, mm] = time.split(':').map((s) => Number.parseInt(s, 10));
  await n.scheduleNotificationAsync({
    content: {
      title: 'time to review',
      body: `your daily session is ready (${modelId.split('-').slice(0, 2).join(' ')}).`,
    },
    trigger: {
      hour: Number.isFinite(hh) ? hh : 9,
      minute: Number.isFinite(mm) ? mm : 0,
      repeats: true,
    },
  });

  return { scheduled: true, time };
}

export async function clearReminders(): Promise<void> {
  const n = load();
  await n?.cancelAllScheduledNotificationsAsync?.();
}
