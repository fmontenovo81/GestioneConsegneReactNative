import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../auth/apiClient';
import {
  getConsegne, upsertConsegna, deleteConsegne, getConsegnaById,
  type ConsegnaLocale,
} from '../db/sqlite';

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}

export const consegneKeys = {
  all: ['consegne'] as const,
  byTrasportatore: (id: number) => ['consegne', 'trasportatore', id] as const,
  detail: (id: number) => ['consegne', 'detail', id] as const,
};

async function fetchConsegne(idTrasportatore: number): Promise<ConsegnaLocale[]> {
  const res = await apiFetch(`/consegne?idTrasportatore=${idTrasportatore}`);
  if (!res.ok) throw new Error('Errore fetch consegne');
  const serverData: any[] = await res.json();

  const serverIds = serverData.map(c => c.id).filter(Boolean);

  for (const c of serverData) {
    const esistente = getConsegnaById(c.id);
    if (esistente) {
      if (new Date(c.aggiornatoIl) >= new Date(esistente.aggiornatoIl)) {
        upsertConsegna({ ...esistente, ...normalizza(c), localId: esistente.localId });
      }
    } else {
      upsertConsegna(normalizza(c));
    }
  }

  // Rimuovi consegne non più presenti sul server
  const serverIdSet = new Set(serverIds);
  const locali = getConsegne(idTrasportatore);
  const daEliminare = locali
    .filter(c => c.id && !serverIdSet.has(c.id) && c.statoSincronizzazione)
    .map(c => c.localId!)
    .filter(Boolean);
  if (daEliminare.length > 0) deleteConsegne(daEliminare);

  return getConsegne(idTrasportatore);
}

function normalizza(c: any): ConsegnaLocale {
  return {
    id: c.id,
    idTrasportatore: c.idTrasportatore,
    clienteNome: c.clienteNome,
    emailCliente: c.emailCliente ?? undefined,
    indirizzoConsegna: c.indirizzoConsegna,
    dataProgrammata: c.dataProgrammata,
    noteTrasportatore: c.noteTrasportatore ?? undefined,
    noteDdt: c.noteDdt ?? undefined,
    firmaDigitale: c.firmaDigitale ?? undefined,
    ddtPdf: c.ddtPdf ?? undefined,
    ddtFirmato: c.ddtFirmato ?? undefined,
    statoConsegna: c.statoConsegna,
    statoSincronizzazione: true,
    aggiornatoIl: c.aggiornatoIl ?? new Date().toISOString(),
  };
}

export function useConsegne(idTrasportatore: number) {
  return useQuery<ConsegnaLocale[]>({
    queryKey: consegneKeys.byTrasportatore(idTrasportatore),
    queryFn: async () => {
      if (!await isOnline()) return getConsegne(idTrasportatore);
      return fetchConsegne(idTrasportatore);
    },
    enabled: idTrasportatore > 0,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateConsegna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ConsegnaLocale> & { localId?: number; id?: number }) => {
      const { localId, id, ...campi } = payload;
      const aggiornamento = { ...campi, aggiornatoIl: new Date().toISOString() };
      const esistente = localId ? getConsegnaById(localId) : (id ? getConsegnaById(id) : null);
      if (esistente) {
        upsertConsegna({ ...esistente, ...aggiornamento, statoSincronizzazione: await isOnline() });
      }
      if (await isOnline() && id) {
        const res = await apiFetch(`/consegne/${id}`, { method: 'PUT', body: JSON.stringify(aggiornamento) });
        if (!res.ok) throw new Error('Errore aggiornamento server');
        return res.json();
      }
      return null;
    },
    onSettled: (_d, _e, payload) => {
      qc.invalidateQueries({ queryKey: consegneKeys.byTrasportatore(payload.idTrasportatore ?? 0) });
    },
  });
}
