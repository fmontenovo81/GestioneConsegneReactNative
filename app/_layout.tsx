import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuthContext } from '../contexts/AuthContext';
import { QueryProvider } from '../providers/QueryProvider';
import { initDb } from '../lib/db/sqlite';

initDb();

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
  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryProvider>
  );
}
