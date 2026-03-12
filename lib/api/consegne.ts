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
      if (esistente.statoSincronizzazione) {
        // Record sincronizzato: il server è la fonte di verità, aggiorna sempre.
        // Preserva i campi binari (firmaDigitale, ddtPdf, ddtFirmato) perché la lista
        // non li restituisce — vengono popolati solo dalla GET dettaglio.
        upsertConsegna({
          ...normalizza(c),
          localId:       esistente.localId,
          firmaDigitale: esistente.firmaDigitale,
          ddtPdf:        esistente.ddtPdf,
          ddtFirmato:    esistente.ddtFirmato,
        });
      }
      // Se statoSincronizzazione: false → modifiche offline in attesa, mantieni locale
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

  // Pre-scarica PDF in background per consegne non ancora aperte
  const senzaPdf = getConsegne(idTrasportatore).filter(c => c.id && !c.ddtPdf);
  for (const c of senzaPdf) {
    prefetchConsegnaBinari(c.id!).catch(() => {});
  }

  return getConsegne(idTrasportatore);
}

async function prefetchConsegnaBinari(id: number): Promise<void> {
  const res = await apiFetch(`/consegne/${id}`);
  if (!res.ok) return;
  const data = await res.json();
  const esistente = getConsegnaById(id);
  if (esistente?.localId) {
    upsertConsegna({
      ...esistente,
      ddtPdf:        data.ddtPdf        ?? esistente.ddtPdf,
      firmaDigitale: data.firmaDigitale ?? esistente.firmaDigitale,
      ddtFirmato:    data.ddtFirmato    ?? esistente.ddtFirmato,
    });
  }
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

export function useConsegnaDetail(id: number | undefined) {
  return useQuery({
    queryKey: consegneKeys.detail(id ?? 0),
    queryFn: async () => {
      if (!id) return null;
      const res = await apiFetch(`/consegne/${id}`);
      if (!res.ok) throw new Error('Errore fetch dettaglio');
      const data = await res.json();

      // Se c'è firma ma ddtFirmato non ancora generato → genera al volo
      if (data.firmaDigitale && !data.ddtFirmato && data.ddtPdf) {
        try {
          const resFirmato = await apiFetch(`/consegne/${id}/ddt-firmato`);
          if (resFirmato.ok) {
            const firmato = await resFirmato.json();
            data.ddtFirmato = firmato.ddtFirmato;
          }
        } catch {}
      }

      // Salva i campi binari in SQLite per accesso offline
      const esistente = getConsegnaById(id);
      if (esistente?.localId) {
        upsertConsegna({
          ...esistente,
          ddtPdf:        data.ddtPdf        ?? undefined,
          firmaDigitale: data.firmaDigitale ?? undefined,
          ddtFirmato:    data.ddtFirmato    ?? undefined,
        });
      }
      return data as { ddtPdf?: string; firmaDigitale?: string; ddtFirmato?: string };
    },
    enabled: !!id && id > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateConsegna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ConsegnaLocale> & { localId?: number; id?: number }) => {
      const { localId, id, ...campi } = payload;
      const aggiornamento = { ...campi, aggiornatoIl: new Date().toISOString() };
      const esistente = localId ? getConsegnaById(localId) : (id ? getConsegnaById(id) : null);
      const online = await isOnline();

      if (esistente) {
        // Salva subito in locale come "in attesa" — verrà confermato dal server
        upsertConsegna({ ...esistente, ...aggiornamento, statoSincronizzazione: false });
      }

      if (online && id) {
        const res = await apiFetch(`/consegne/${id}`, { method: 'PUT', body: JSON.stringify(aggiornamento) });
        if (!res.ok) throw new Error('Errore aggiornamento server');
        // Server ha confermato → marca come sincronizzato
        if (esistente) {
          upsertConsegna({ ...esistente, ...aggiornamento, statoSincronizzazione: true });
        }
        return res.json();
      }
      return null;
    },
    onSettled: (_d, _e, payload) => {
      const idTrasportatore = payload.idTrasportatore ?? 0;
      // Aggiorna subito l'UI da SQLite (già aggiornato in mutationFn), poi ricarica dal server
      if (idTrasportatore > 0) {
        qc.setQueryData(consegneKeys.byTrasportatore(idTrasportatore), getConsegne(idTrasportatore));
      }
      qc.invalidateQueries({ queryKey: consegneKeys.byTrasportatore(idTrasportatore) });
    },
  });
}
