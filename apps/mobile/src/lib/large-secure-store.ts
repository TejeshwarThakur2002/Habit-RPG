import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Supabase's documented Expo pattern (DECISIONS.md D33). The secure store (Keychain, Keystore)
// holds at most about 2 KB per value and a session is larger, so each write makes a fresh
// AES-256 key, keeps that key in the secure store and the encrypted session in AsyncStorage.
// A new key per write means the CTR counter can start at 1 without ever reusing a keystream.

function encrypt(value: string): { keyHex: string; dataHex: string } {
  const key = Crypto.getRandomBytes(32);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const data = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return { keyHex: aesjs.utils.hex.fromBytes(key), dataHex: aesjs.utils.hex.fromBytes(data) };
}

function decrypt(keyHex: string, dataHex: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(1),
  );
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(dataHex)));
}

/** The storage interface supabase-js expects for its session. */
export const largeSecureStore = {
  async getItem(name: string): Promise<string | null> {
    const dataHex = await AsyncStorage.getItem(name);
    if (dataHex === null) return null;
    const keyHex = await SecureStore.getItemAsync(name);
    // A session without its key can't be read (for example after a restore to a new phone).
    return keyHex === null ? null : decrypt(keyHex, dataHex);
  },
  async setItem(name: string, value: string): Promise<void> {
    const { keyHex, dataHex } = encrypt(value);
    await SecureStore.setItemAsync(name, keyHex);
    await AsyncStorage.setItem(name, dataHex);
  },
  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(name);
    await SecureStore.deleteItemAsync(name);
  },
};
