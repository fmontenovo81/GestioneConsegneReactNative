import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../../constants/api';

const ACCESS_TOKEN_KEY  = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}
export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}
export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshTokens(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) { await clearTokens(); return null; }
    const data = await res.json();
    await setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch { return null; }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    const errorCode = body.codice ?? body.code;
    if (errorCode === 'TOKEN_SCADUTO' || errorCode === 'NON_AUTENTICATO') {
      if (isRefreshing) {
        const newToken = await new Promise<string | null>(resolve => refreshQueue.push(resolve));
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          return fetch(`${API_BASE}${path}`, { ...options, headers });
        }
        throw new Error('NON_AUTENTICATO');
      }
      isRefreshing = true;
      const newToken = await refreshTokens();
      isRefreshing = false;
      refreshQueue.forEach(cb => cb(newToken));
      refreshQueue = [];
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        return fetch(`${API_BASE}${path}`, { ...options, headers });
      }
      throw new Error('NON_AUTENTICATO');
    }
  }
  return res;
}
