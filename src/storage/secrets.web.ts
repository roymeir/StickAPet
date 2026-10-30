// Web preview only: expo-secure-store has no web implementation. Keep the key in memory for the
// session (never persisted in the browser).
let key: string | null = null;

export async function getApiKey(): Promise<string | null> {
  return key;
}

export async function setApiKey(value: string): Promise<void> {
  key = value.trim();
}

export async function clearApiKey(): Promise<void> {
  key = null;
}
