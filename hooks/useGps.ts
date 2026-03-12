import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../lib/auth/apiClient';
import { insertGps } from '../lib/db/sqlite';

const INTERVALLO_MS = 5 * 60 * 1000; // 5 minuti
const GPS_TIMEOUT_MS = 15_000;        // timeout lettura posizione

export type GpsStatus = 'idle' | 'ok' | 'errore' | 'no_permesso';

export function useGps(idTrasportatore: number | null) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [accuratezza, setAccuratezza] = useState<number | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const attivoRef   = useRef(false);
  const permessoRef = useRef(false);

  useEffect(() => {
    if (!idTrasportatore) return;
    const id = idTrasportatore; // narrowing per TypeScript (closure non restringe il tipo)

    attivoRef.current = true;

    async function inviaPositione() {
      if (!attivoRef.current) return;

      // Permesso: richiedi solo se non già ottenuto
      if (!permessoRef.current) {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
          setStatus('no_permesso');
          return;
        }
        permessoRef.current = true;
      }

      try {
        // Lettura posizione con timeout esplicito
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GPS timeout')), GPS_TIMEOUT_MS)
          ),
        ]) as Location.LocationObject;

        if (!attivoRef.current) return;

        const { latitude, longitude, accuracy } = pos.coords;
        setAccuratezza(accuracy ?? null);

        const net = await NetInfo.fetch();
        if (net.isConnected) {
          const res = await apiFetch('/posizioni', {
            method: 'POST',
            body: JSON.stringify({
              idTrasportatore,
              latitudine:  latitude,
              longitudine: longitude,
              accuratezza: accuracy ?? null,
            }),
          });
          if (!res.ok) insertGps(id, latitude, longitude, accuracy ?? undefined);
        } else {
          insertGps(id, latitude, longitude, accuracy ?? undefined);
        }

        if (attivoRef.current) setStatus('ok');
      } catch (e: any) {
        console.warn('[GPS]', e?.message);
        if (attivoRef.current) setStatus('errore');
      }
    }

    // Prima chiamata immediata
    inviaPositione();

    // Intervallo ogni 5 minuti
    timerRef.current = setInterval(inviaPositione, INTERVALLO_MS);

    // Invia anche quando l'app torna in foreground
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') inviaPositione();
    });

    return () => {
      attivoRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      appSub.remove();
    };
  }, [idTrasportatore]);

  return { status, accuratezza };
}
