import { apiFetch } from '../auth/apiClient';
import {
  getConsegneDaSincronizzare, getPagamentiDaSincronizzare,
  getGpsCoda, clearGpsCoda, upsertConsegna, markPagamentiSincronizzati,
} from '../db/sqlite';

let syncRunning = false;

export async function runSync(): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;
  try {
    // Ordine importante: pagamenti prima → ricevutaPdf generato sul server
    // prima che sincronizzaConsegne triggeri l'email
    await sincronizzaPagamenti();
    await sincronizzaConsegne();
    await flushGps();
  } finally {
    syncRunning = false;
  }
}

async function sincronizzaConsegne(): Promise<void> {
  const pendenti = getConsegneDaSincronizzare();
  if (pendenti.length === 0) return;

  // Escludi solo ddtPdf/ddtFirmato (grandi PDF) — firmaDigitale va inclusa perché
  // può essere acquisita offline e deve raggiungere il server
  const payload = pendenti.map(({ ddtPdf, ddtFirmato, ...rest }) => rest);

  const res = await apiFetch('/consegne/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) return;

  // Marca come sincronizzate in SQLite
  for (const c of pendenti) {
    upsertConsegna({ ...c, statoSincronizzazione: true });
  }

  // Invia email per consegne appena segnate come consegnate offline con email cliente.
  // Fatto QUI (client) anziché nel batch route (server fire-and-forget) per garantire
  // che i pagamenti siano già stati sincronizzati (e ricevutaPdf generata) prima dell'invio.
  const daInviare = pendenti.filter(c =>
    c.statoConsegna === 'consegnata' && c.emailCliente && c.id
  );
  for (const c of daInviare) {
    // Pre-genera ddtFirmato in DB: lo chiediamo esplicitamente prima dell'email così
    // triggerEmailConsegna lo trova già pronto (evita la generazione on-the-fly che
    // può fallire se la funzione serverless non ha ancora visto il dato appena scritto).
    await apiFetch(`/consegne/${c.id}/ddt-firmato`).catch(() => {});
    await apiFetch(`/consegne/${c.id}/invia-email`, { method: 'POST' }).catch(() => {});
  }
}

async function sincronizzaPagamenti() {
  const pendenti = getPagamentiDaSincronizzare();
  if (pendenti.length === 0) return;
  const res = await apiFetch('/pagamenti/sync/batch', {
    method: 'POST',
    body: JSON.stringify(pendenti),
  });
  if (res.ok) {
    const localIds = pendenti.map(p => p.localId).filter((id): id is number => !!id);
    markPagamentiSincronizzati(localIds);
  }
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
