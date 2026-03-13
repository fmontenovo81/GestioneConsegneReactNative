import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_BASE = 'https://consegne.entersrl.it/api';
const CONFIG_KEY = 'api_base_url';

let _apiBase: string = DEFAULT_API_BASE;

export function getApiBase(): string {
  return _apiBase;
}

export async function loadConfig(): Promise<void> {
  const stored = await SecureStore.getItemAsync(CONFIG_KEY);
  if (stored) _apiBase = stored;
}

export async function setApiBase(url: string): Promise<void> {
  const normalized = url.replace(/\/+$/, ''); // rimuove slash finale
  _apiBase = normalized;
  await SecureStore.setItemAsync(CONFIG_KEY, normalized);
}

export async function resetApiBase(): Promise<void> {
  _apiBase = DEFAULT_API_BASE;
  await SecureStore.deleteItemAsync(CONFIG_KEY);
}

export function getDefaultApiBase(): string {
  return DEFAULT_API_BASE;
}
