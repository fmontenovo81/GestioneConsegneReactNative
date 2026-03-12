import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../auth/apiClient';
import { getPagamentiByConsegna, insertPagamento, type PagamentoLocale } from '../db/sqlite';

export const pagamentiKeys = {
  byConsegna: (id: number) => ['pagamenti', 'consegna', id] as const,
};

export function usePagamenti(consegnaServerId: number | undefined) {
  return useQuery<PagamentoLocale[]>({
    queryKey: pagamentiKeys.byConsegna(consegnaServerId ?? 0),
    queryFn: async () => {
      // Prima mostra quelli locali
      const locali = consegnaServerId ? getPagamentiByConsegna(consegnaServerId) : [];
      if (!consegnaServerId) return locali;
      try {
        const res = await apiFetch(`/pagamenti?idConsegna=${consegnaServerId}`);
        if (!res.ok) return locali;
        const serverData: any[] = await res.json();
        return serverData.map(p => ({
          id: p.id,
          idConsegna: p.idConsegna,
          importo: p.importo,
          metodo: p.metodo,
          statoPagamento: p.statoPagamento,
          note: p.note ?? undefined,
          haRicevuta: p.haRicevuta,
          statoSincronizzazione: true,
          aggiornatoIl: p.aggiornatoIl ?? new Date().toISOString(),
        }));
      } catch {
        return locali;
      }
    },
    enabled: (consegnaServerId ?? 0) > 0,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreaPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      idConsegna: number;
      importo: number;
      metodo: 'contanti' | 'carta' | 'bonifico';
      note?: string;
      firmaRicevuta?: string;
    }) => {
      const base: PagamentoLocale = {
        ...payload,
        statoPagamento: 'completato',
        statoSincronizzazione: false,
        aggiornatoIl: new Date().toISOString(),
      };

      // Server-first: prova a inviare al server prima di scrivere in SQLite.
      // Inserendo direttamente con statoSincronizzazione: true si evita la race
      // condition con runSync() che altrimenti ri-invierebbe il pagamento via batch.
      try {
        const res = await apiFetch('/pagamenti', {
          method: 'POST',
          body: JSON.stringify(base),
        });
        if (res.ok) {
          const serverRecord = await res.json();
          const synced: PagamentoLocale = {
            ...base,
            id:            serverRecord.id,
            ricevutaPdf:   serverRecord.ricevutaPdf ?? undefined,
            statoSincronizzazione: true,
          };
          const localId = insertPagamento(synced);
          return { ...synced, localId };
        }
      } catch {}

      // Offline path: salva come pending in SQLite
      const localId = insertPagamento(base);
      return { ...base, localId };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: pagamentiKeys.byConsegna(variables.idConsegna) });
    },
  });
}
