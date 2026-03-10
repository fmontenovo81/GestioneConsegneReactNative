import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../lib/auth/apiClient';
import { insertGps } from '../lib/db/sqlite';

const INTERVALLO_MS = 5 * 60 * 1000; // 5 minuti

export type GpsStatus = 'idle' | 'ok' | 'errore' | 'no_permesso';

export function useGps(idTrasportatore: number | null) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [accuratezza, setAccuratezza] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!idTrasportatore) return;

    let attivo = true;

    async function inviaPositione() {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
          setStatus('no_permesso');
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!attivo) return;

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
              accuratezza: accuracy,
            }),
          });
          if (res.ok) setStatus('ok');
          else {
            insertGps(idTrasportatore, latitude, longitude, accuracy ?? undefined);
            setStatus('ok');
          }
        } else {
          insertGps(idTrasportatore, latitude, longitude, accuracy ?? undefined);
          setStatus('ok');
        }
      } catch {
        if (attivo) setStatus('errore');
      }
    }

    inviaPositione();
    timerRef.current = setInterval(inviaPositione, INTERVALLO_MS);

    return () => {
      attivo = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [idTrasportatore]);

  return { status, accuratezza };
}
