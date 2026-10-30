import * as SecureStore from 'expo-secure-store';

/*
 * The OpenAI key lives in the iOS Keychain / Android Keystore via expo-secure-store and never
 * leaves the device except in requests to the provider. (Before publishing to an app store,
 * move AI calls behind a server proxy instead — see README.)
 */
const KEY = 'openai_api_key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value.trim(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
