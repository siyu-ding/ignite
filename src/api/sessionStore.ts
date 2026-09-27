import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ChatSession } from './chat';

const SESSION_KEY = 'ignite.chat.credentials.v1';
const INSTALL_MARKER_KEY = 'ignite.install.marker.v1';

function parseSession(value: string | null): ChatSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ChatSession>;
    if (!parsed.sessionId || !parsed.sessionToken) return null;
    return { sessionId: parsed.sessionId, sessionToken: parsed.sessionToken };
  } catch {
    return null;
  }
}

function webStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export async function loadChatSession(): Promise<ChatSession | null> {
  if (Platform.OS === 'web') {
    return parseSession(webStorage()?.getItem(SESSION_KEY) ?? null);
  }

  // Keychain items can survive an iOS uninstall. AsyncStorage cannot, so a
  // missing marker identifies a fresh install and invalidates old credentials.
  const installMarker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
  if (!installMarker) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, '1');
    return null;
  }

  return parseSession(await SecureStore.getItemAsync(SESSION_KEY));
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const serialized = JSON.stringify(session);
  if (Platform.OS === 'web') {
    webStorage()?.setItem(SESSION_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearChatSession(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
