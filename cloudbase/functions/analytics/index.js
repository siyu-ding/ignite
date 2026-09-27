const cloudbase = require('@cloudbase/node-sdk');

// The CloudBase SDK reads the server-side CLOUDBASE_APIKEY injected by SCF.
const app = cloudbase.init({ env: 'ignite-d1g1f7k2pb353470e' });
const db = app.rdb({ database: 'public' });

const ALLOWED_EVENTS = new Set([
  'app_opened', 'opening_viewed', 'opening_skipped', 'opening_completed',
  'home_viewed', 'chat_cta_clicked', 'chat_opened', 'first_message_sent',
  'message_sent', 'assistant_response_shown', 'chat_request_failed',
  'three_turns_completed', 'invitation_shown', 'invitation_ack_failed',
  'growth_choice_failed', 'next_state_selected', 'chat_exited',
  'next_step_opened',
]);

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return event;
  if (typeof event.body === 'object') return event.body;
  return JSON.parse(event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body);
}

function sanitize(raw) {
  if (!raw || !ALLOWED_EVENTS.has(raw.eventName)) return null;
  if (!raw.eventId || !raw.anonymousId || !raw.sessionId) return null;

  const properties = raw.properties && typeof raw.properties === 'object'
    ? raw.properties : {};
  const serialized = JSON.stringify(properties);
  if (serialized.length > 8000) return null;

  return {
    event_id: String(raw.eventId).slice(0, 64),
    anonymous_id: String(raw.anonymousId).slice(0, 64),
    session_id: String(raw.sessionId).slice(0, 64),
    event_name: raw.eventName,
    occurred_at: new Date(raw.occurredAt || Date.now()).toISOString(),
    received_at: new Date().toISOString(),
    app_version: String(raw.appVersion || '').slice(0, 32),
    platform: String(raw.platform || '').slice(0, 16),
    properties,
  };
}

exports.main = async (event) => {
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return response(204, {});
  }

  try {
    const body = parseBody(event);
    const input = Array.isArray(body.events) ? body.events.slice(0, 50) : [body];
    const events = input.map(sanitize).filter(Boolean);
    if (!events.length) return response(400, { error: 'invalid_events' });

    // Ignore duplicate event IDs so client retries stay idempotent.
    const { error } = await db
      .from('analytics_events')
      .upsert(events, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) throw error;
    return response(202, { accepted: events.length });
  } catch (error) {
    console.error('analytics ingest failed', error);
    return response(500, { error: 'internal_error' });
  }
};
