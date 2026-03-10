import { apiFetch } from '../auth/apiClient';
import {
  getConsegneDaSincronizzare, getPagamentiDaSincronizzare,
  getGpsCoda, clearGpsCoda, upsertConsegna,
} from '../db/sqlite';

export async function runSync(): Promise<void> {
  await sincronizzaConsegne();
  await sincronizzaPagamenti();
  await flushGps();
}

async function sincronizzaConsegne() {
  const pendenti = getConsegneDaSincronizzare();
  if (pendenti.length === 0) return;

  // Escludi campi binari dal payload batch — troppo grandi e gestiti via detail endpoint
  const payload = pendenti.map(({ firmaDigitale, ddtPdf, ddtFirmato, ...rest }) => rest);

  const res = await apiFetch('/consegne/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    // Marca come sincronizzate in SQLite
    for (const c of pendenti) {
      upsertConsegna({ ...c, statoSincronizzazione: true });
    }
  }
}

async function sincronizzaPagamenti() {
  const pendenti = getPagamentiDaSincronizzare();
  if (pendenti.length === 0) return;
  await apiFetch('/pagamenti/sync/batch', {
    method: 'POST',
    body: JSON.stringify(pendenti),
  });
}

async function flushGps() {
  const coda = getGpsCoda();
  if (coda.length === 0) return;
  try {
    const res = await apiFetch('/posizioni/batch', {
      method: 'POST',
      body: JSON.stringify(coda.map(r => ({
        idTrasportatore: r.idTrasportatore,
        latitudine:      r.latitudine,
        longitudine:     r.longitudine,
        accuratezza:     r.accuratezza,
        timestamp:       r.timestamp,
      }))),
    });
    if (res.ok) clearGpsCoda(coda.map(r => r.id));
  } catch {}
}
