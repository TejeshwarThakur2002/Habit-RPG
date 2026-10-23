import { randomBytes as mockRandomBytes } from 'node:crypto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { largeSecureStore } from '../large-secure-store';

// In-memory stand-ins for the phone's storage, so the encryption itself is what's tested.
jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(data.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => Promise.resolve(void data.set(k, v))),
      removeItem: jest.fn((k: string) => Promise.resolve(void data.delete(k))),
    },
  };
});
jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(data.get(k) ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => Promise.resolve(void data.set(k, v))),
    deleteItemAsync: jest.fn((k: string) => Promise.resolve(void data.delete(k))),
  };
});
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(mockRandomBytes(n)),
}));

const SESSION = JSON.stringify({
  access_token: 'a'.repeat(3000),
  user: { email: 'ada@example.com' },
});

describe('largeSecureStore', () => {
  it('reads back a session larger than the secure store allows', async () => {
    await largeSecureStore.setItem('session', SESSION);
    expect(await largeSecureStore.getItem('session')).toBe(SESSION);
  });

  it('keeps only a 32-byte key in the secure store and ciphertext elsewhere', async () => {
    await largeSecureStore.setItem('session', SESSION);
    const key = await SecureStore.getItemAsync('session');
    const stored = await AsyncStorage.getItem('session');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain('ada@example.com');
  });

  it('uses a new key for every write', async () => {
    await largeSecureStore.setItem('session', SESSION);
    const first = await SecureStore.getItemAsync('session');
    await largeSecureStore.setItem('session', SESSION);
    expect(await SecureStore.getItemAsync('session')).not.toBe(first);
  });

  it('treats a session without its key as no session', async () => {
    await largeSecureStore.setItem('session', SESSION);
    await SecureStore.deleteItemAsync('session');
    expect(await largeSecureStore.getItem('session')).toBeNull();
  });

  it('removes both halves on sign-out', async () => {
    await largeSecureStore.setItem('session', SESSION);
    await largeSecureStore.removeItem('session');
    expect(await AsyncStorage.getItem('session')).toBeNull();
    expect(await SecureStore.getItemAsync('session')).toBeNull();
  });
});
