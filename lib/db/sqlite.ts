import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('consegne.db');

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS consegne (
      localId INTEGER PRIMARY KEY AUTOINCREMENT,
      id INTEGER,
      idTrasportatore INTEGER NOT NULL,
      clienteNome TEXT NOT NULL,
      emailCliente TEXT,
      indirizzoConsegna TEXT NOT NULL,
      dataProgrammata TEXT NOT NULL,
      noteTrasportatore TEXT,
      noteDdt TEXT,
      firmaDigitale TEXT,
      ddtPdf TEXT,
      ddtFirmato TEXT,
      statoConsegna TEXT NOT NULL DEFAULT 'da_consegnare',
      statoSincronizzazione INTEGER NOT NULL DEFAULT 1,
      aggiornatoIl TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pagamenti (
      localId INTEGER PRIMARY KEY AUTOINCREMENT,
      id INTEGER,
      idConsegna INTEGER,
      importo REAL NOT NULL,
      metodo TEXT NOT NULL,
      statoPagamento TEXT NOT NULL DEFAULT 'in_attesa',
      note TEXT,
      firmaRicevuta TEXT,
      ricevutaPdf TEXT,
      statoSincronizzazione INTEGER NOT NULL DEFAULT 1,
      aggiornatoIl TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coda_gps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idTrasportatore INTEGER NOT NULL,
      latitudine REAL NOT NULL,
      longitudine REAL NOT NULL,
      accuratezza REAL,
      timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessione (
      id INTEGER PRIMARY KEY DEFAULT 1,
      utente TEXT NOT NULL
    );
  `);
}

export type ConsegnaLocale = {
  localId?: number;
  id?: number;
  idTrasportatore: number;
  clienteNome: string;
  emailCliente?: string;
  indirizzoConsegna: string;
  dataProgrammata: string;
  noteTrasportatore?: string;
  noteDdt?: string;
  firmaDigitale?: string;
  ddtPdf?: string;
  ddtFirmato?: string;
  statoConsegna: 'da_consegnare' | 'in_corso' | 'consegnata' | 'fallita';
  statoSincronizzazione: boolean;
  aggiornatoIl: string;
};

export type PagamentoLocale = {
  localId?: number;
  id?: number;
  idConsegna?: number;
  importo: number;
  metodo: 'contanti' | 'carta' | 'bonifico';
  statoPagamento: 'in_attesa' | 'completato' | 'fallito' | 'rimborsato';
  note?: string;
  firmaRicevuta?: string;
  ricevutaPdf?: string;
  statoSincronizzazione: boolean;
  aggiornatoIl: string;
};

// ─── Consegne ────────────────────────────────────────────────
export function getConsegne(idTrasportatore: number): ConsegnaLocale[] {
  return db.getAllSync(
    'SELECT * FROM consegne WHERE idTrasportatore = ? ORDER BY dataProgrammata ASC',
    [idTrasportatore]
  ).map(rowToConsegna);
}

export function getConsegnaById(id: number): ConsegnaLocale | null {
  const row = db.getFirstSync('SELECT * FROM consegne WHERE id = ? OR localId = ?', [id, id]);
  return row ? rowToConsegna(row) : null;
}

export function upsertConsegna(c: ConsegnaLocale): number {
  if (c.localId) {
    db.runSync(
      `UPDATE consegne SET id=?,idTrasportatore=?,clienteNome=?,emailCliente=?,
       indirizzoConsegna=?,dataProgrammata=?,noteTrasportatore=?,noteDdt=?,
       firmaDigitale=?,ddtPdf=?,ddtFirmato=?,
       statoConsegna=?,statoSincronizzazione=?,aggiornatoIl=? WHERE localId=?`,
      [c.id ?? null, c.idTrasportatore, c.clienteNome, c.emailCliente ?? null,
       c.indirizzoConsegna, c.dataProgrammata, c.noteTrasportatore ?? null,
       c.noteDdt ?? null, c.firmaDigitale ?? null, c.ddtPdf ?? null, c.ddtFirmato ?? null,
       c.statoConsegna, c.statoSincronizzazione ? 1 : 0,
       c.aggiornatoIl, c.localId]
    );
    return c.localId;
  }
  const res = db.runSync(
    `INSERT INTO consegne (id,idTrasportatore,clienteNome,emailCliente,indirizzoConsegna,
     dataProgrammata,noteTrasportatore,noteDdt,firmaDigitale,ddtPdf,ddtFirmato,
     statoConsegna,statoSincronizzazione,aggiornatoIl)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [c.id ?? null, c.idTrasportatore, c.clienteNome, c.emailCliente ?? null,
     c.indirizzoConsegna, c.dataProgrammata, c.noteTrasportatore ?? null,
     c.noteDdt ?? null, c.firmaDigitale ?? null, c.ddtPdf ?? null, c.ddtFirmato ?? null,
     c.statoConsegna, c.statoSincronizzazione ? 1 : 0, c.aggiornatoIl]
  );
  return res.lastInsertRowId;
}

export function updateConsegnaFirma(localId: number, firmaDigitale: string, noteDdt?: string) {
  db.runSync('UPDATE consegne SET firmaDigitale=?, noteDdt=? WHERE localId=?',
    [firmaDigitale, noteDdt ?? null, localId]);
}

export function deleteConsegne(localIds: number[]) {
  if (localIds.length === 0) return;
  const placeholders = localIds.map(() => '?').join(',');
  db.runSync(`DELETE FROM consegne WHERE localId IN (${placeholders})`, localIds);
}

export function getConsegneDaSincronizzare(): ConsegnaLocale[] {
  return db.getAllSync('SELECT * FROM consegne WHERE statoSincronizzazione = 0', []).map(rowToConsegna);
}

// ─── Pagamenti ───────────────────────────────────────────────
export function getPagamentiByConsegna(idConsegna: number): PagamentoLocale[] {
  return db.getAllSync('SELECT * FROM pagamenti WHERE idConsegna = ?', [idConsegna]).map(rowToPagamento);
}

export function insertPagamento(p: PagamentoLocale): number {
  const res = db.runSync(
    `INSERT INTO pagamenti (id,idConsegna,importo,metodo,statoPagamento,note,statoSincronizzazione,aggiornatoIl)
     VALUES (?,?,?,?,?,?,?,?)`,
    [p.id ?? null, p.idConsegna ?? null, p.importo, p.metodo, p.statoPagamento,
     p.note ?? null, p.statoSincronizzazione ? 1 : 0, p.aggiornatoIl]
  );
  return res.lastInsertRowId;
}

export function getPagamentiDaSincronizzare(): PagamentoLocale[] {
  return db.getAllSync('SELECT * FROM pagamenti WHERE statoSincronizzazione = 0', []).map(rowToPagamento);
}

// ─── Coda GPS ────────────────────────────────────────────────
export function insertGps(idTrasportatore: number, lat: number, lon: number, acc?: number) {
  db.runSync(
    'INSERT INTO coda_gps (idTrasportatore, latitudine, longitudine, accuratezza, timestamp) VALUES (?,?,?,?,?)',
    [idTrasportatore, lat, lon, acc ?? null, new Date().toISOString()]
  );
}

export function getGpsCoda(): { id: number; idTrasportatore: number; latitudine: number; longitudine: number; accuratezza: number | null; timestamp: string }[] {
  return db.getAllSync('SELECT * FROM coda_gps ORDER BY id ASC', []) as any[];
}

export function clearGpsCoda(ids: number[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`DELETE FROM coda_gps WHERE id IN (${placeholders})`, ids);
}

// ─── Sessione ────────────────────────────────────────────────
export function salvaSessione(utente: object) {
  db.runSync('INSERT OR REPLACE INTO sessione (id, utente) VALUES (1, ?)', [JSON.stringify(utente)]);
}
export function getSessione(): object | null {
  const row = db.getFirstSync('SELECT utente FROM sessione WHERE id = 1', []) as any;
  return row ? JSON.parse(row.utente) : null;
}
export function cancellaSessione() {
  db.runSync('DELETE FROM sessione WHERE id = 1', []);
}

// ─── Helpers ─────────────────────────────────────────────────
function rowToConsegna(row: any): ConsegnaLocale {
  return {
    ...row,
    statoSincronizzazione: row.statoSincronizzazione === 1,
    firmaDigitale: row.firmaDigitale ?? undefined,
    ddtPdf:        row.ddtPdf        ?? undefined,
    ddtFirmato:    row.ddtFirmato    ?? undefined,
    emailCliente:  row.emailCliente  ?? undefined,
    noteTrasportatore: row.noteTrasportatore ?? undefined,
    noteDdt:       row.noteDdt       ?? undefined,
  };
}
function rowToPagamento(row: any): PagamentoLocale {
  return {
    ...row,
    statoSincronizzazione: row.statoSincronizzazione === 1,
    note:          row.note          ?? undefined,
    firmaRicevuta: row.firmaRicevuta ?? undefined,
    ricevutaPdf:   row.ricevutaPdf   ?? undefined,
  };
}

export { db };
