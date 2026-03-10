import { apiFetch } from '../auth/apiClient';
import { getConsegneDaSincronizzare, getPagamentiDaSincronizzare } from '../db/sqlite';

export async function runSync(): Promise<void> {
  await sincronizzaConsegne();
  await sincronizzaPagamenti();
}

async function sincronizzaConsegne() {
  const pendenti = getConsegneDaSincronizzare();
  if (pendenti.length === 0) return;
  await apiFetch('/consegne/sync/batch', {
    method: 'POST',
    body: JSON.stringify(pendenti),
  });
}

async function sincronizzaPagamenti() {
  const pendenti = getPagamentiDaSincronizzare();
  if (pendenti.length === 0) return;
  await apiFetch('/pagamenti/sync/batch', {
    method: 'POST',
    body: JSON.stringify(pendenti),
  });
}
