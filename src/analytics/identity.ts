import AsyncStorage from '@react-native-async-storage/async-storage';

const ANONYMOUS_ID_KEY = 'ignite.analytics.anonymous-id';

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const digit = char === 'x' ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

let sessionId = randomId();

export async function getAnonymousId() {
  const stored = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
  if (stored) return stored;

  const created = randomId();
  await AsyncStorage.setItem(ANONYMOUS_ID_KEY, created);
  return created;
}

export function getSessionId() {
  return sessionId;
}

export function startNewSession() {
  sessionId = randomId();
  return sessionId;
}

export { randomId };
