import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getAnonymousId, getSessionId, randomId } from './identity';

export type AnalyticsEventName =
  | 'app_opened'
  | 'opening_viewed'
  | 'opening_skipped'
  | 'opening_completed'
  | 'home_viewed'
  | 'chat_cta_clicked'
  | 'chat_opened'
  | 'first_message_sent'
  | 'message_sent'
  | 'assistant_response_shown'
  | 'three_turns_completed'
  | 'invitation_shown'
  | 'next_state_selected'
  | 'chat_exited'
  | 'next_step_opened';

type EventPayload = {
  eventId: string;
  anonymousId: string;
  sessionId: string;
  eventName: AnalyticsEventName;
  occurredAt: string;
  appVersion: string;
  platform: string;
  properties: Record<string, unknown>;
};

const QUEUE_KEY = 'ignite.analytics.queue.v1';
const API_URL = process.env.EXPO_PUBLIC_ANALYTICS_URL;

async function readQueue(): Promise<EventPayload[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

async function writeQueue(events: EventPayload[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-100)));
}

async function postBatch(events: EventPayload[]) {
  if (!API_URL) return false;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  return response.ok;
}

export async function flushAnalytics() {
  const queued = await readQueue();
  if (!queued.length || !API_URL) return;
  try {
    if (await postBatch(queued)) await writeQueue([]);
  } catch {
    // Keep the local queue for the next app interaction.
  }
}

export async function track(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> = {},
) {
  const payload: EventPayload = {
    eventId: randomId(),
    anonymousId: await getAnonymousId(),
    sessionId: getSessionId(),
    eventName,
    occurredAt: new Date().toISOString(),
    appVersion: '0.1.0',
    platform: Platform.OS,
    properties,
  };

  const queue = [...await readQueue(), payload].slice(-100);
  await writeQueue(queue);
  await flushAnalytics();
}
