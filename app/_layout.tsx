import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuthContext } from '../contexts/AuthContext';
import { QueryProvider } from '../providers/QueryProvider';
import { initDb } from '../lib/db/sqlite';
import { loadConfig } from '../lib/config';

function AuthGuard() {
  const { utente, isLoading } = useAuthContext();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!utente && !inAuth) router.replace('/(auth)/login');
    if (utente  &&  inAuth) router.replace('/(tabs)/consegne');
  }, [utente, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadConfig().catch(() => {});
      try { initDb(); } catch (e) { console.error('[DB] initDb error:', e); }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryProvider>
  );
}
