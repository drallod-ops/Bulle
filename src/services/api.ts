// Client de l'API Apps Script.
//
// Principe : l'app lit toujours une copie locale (instantané), et chaque
// écriture est appliquée tout de suite à cette copie puis envoyée en
// arrière-plan. Si le réseau manque, les écritures attendent dans une file
// (« outbox ») et partent dès que possible, dans l'ordre.

export type Table =
  | 'moments'
  | 'collections'
  | 'bucket_items'
  | 'prayer_topics'
  | 'game_sessions'
  | 'custom_questions'
  | 'custom_defis'
  | 'settings';

export const TABLES: Table[] = [
  'moments',
  'collections',
  'bucket_items',
  'prayer_topics',
  'game_sessions',
  'custom_questions',
  'custom_defis',
  'settings',
];

export type Row = { id: string; [key: string]: any };
type Cache = Record<Table, Row[]>;

type Op =
  | { action: 'insert' | 'upsert'; table: Table; row: Row }
  | { action: 'update'; table: Table; id: string; patch: Record<string, any> }
  | { action: 'delete'; table: Table; id: string };

export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; pending: number; message?: string };

const CACHE_KEY = 'bulle_cache_v1';
const OUTBOX_KEY = 'bulle_outbox_v1';
const URL_KEY = 'bulle_api_url';
const SECRET_KEY = 'bulle_secret';
const ME_KEY = 'bulle_me';

// ─── Configuration locale (propre à chaque téléphone) ─────────
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* stockage plein ou désactivé */
  }
}

export const config = {
  apiUrl: () => (read(URL_KEY) || import.meta.env.VITE_API_URL || '').trim(),
  hasBuiltInUrl: () => !!import.meta.env.VITE_API_URL,
  secret: () => read(SECRET_KEY) || '',
  me: () => read(ME_KEY) || '',
  setApiUrl: (v: string) => write(URL_KEY, v || null),
  setSecret: (v: string) => write(SECRET_KEY, v || null),
  setMe: (v: string) => write(ME_KEY, v || null),
  isReady: () => !!config.apiUrl() && !!config.secret() && !!config.me(),
  logout: () => {
    write(SECRET_KEY, null);
    write(ME_KEY, null);
  },
};

// ─── Appel réseau ─────────────────────────────────────────────
async function call<T = any>(action: string, payload: Record<string, any> = {}, overrides?: { url?: string; secret?: string }): Promise<T> {
  const url = overrides?.url ?? config.apiUrl();
  if (!url) throw new Error("L'adresse de l'API n'est pas configurée.");
  // text/plain évite la requête préalable CORS, qu'Apps Script ne gère pas.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret: overrides?.secret ?? config.secret(), ...payload }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Erreur inconnue du serveur.');
  return json.data as T;
}

/** Vérifie une adresse et un code avant de les enregistrer. */
export async function testConnection(url: string, secret: string): Promise<void> {
  await call('ping', {}, { url, secret });
}

// ─── Copie locale ─────────────────────────────────────────────
function emptyCache(): Cache {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Cache;
}

function loadCache(): Cache | null {
  const raw = read(CACHE_KEY);
  if (!raw) return null;
  try {
    return { ...emptyCache(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

let cache: Cache = loadCache() || emptyCache();
let hasCache = !!read(CACHE_KEY);
let outbox: Op[] = (() => {
  try {
    return JSON.parse(read(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
})();

function saveCache() {
  write(CACHE_KEY, JSON.stringify(cache));
}
function saveOutbox() {
  write(OUTBOX_KEY, JSON.stringify(outbox));
}

// Les cellules vides reviennent en null : on les retire pour coller aux
// types de l'app (champs optionnels = undefined).
function clean(row: Row): Row {
  const out: Row = { id: String(row.id) };
  for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined && k !== 'id') out[k] = v;
  return out;
}

function applyLocal(op: Op) {
  const rows = cache[op.table];
  switch (op.action) {
    case 'insert':
    case 'upsert': {
      const row = op.row;
      const i = rows.findIndex((r) => r.id === row.id);
      cache[op.table] = i === -1 ? [row, ...rows] : rows.map((r, j) => (j === i ? clean({ ...r, ...row }) : r));
      break;
    }
    case 'update': {
      const { id, patch } = op;
      cache[op.table] = rows.map((r) => (r.id === id ? clean({ ...r, ...patch }) : r));
      break;
    }
    case 'delete': {
      const { id } = op;
      cache[op.table] = rows.filter((r) => r.id !== id);
      break;
    }
  }
}

// ─── État de synchro (pour l'indicateur à l'écran) ────────────
let syncState: SyncState = { status: 'idle', pending: outbox.length };
const syncListeners = new Set<(s: SyncState) => void>();
function setSync(next: Partial<SyncState>) {
  syncState = { ...syncState, ...next, pending: outbox.length };
  syncListeners.forEach((fn) => fn(syncState));
}
export function onSyncChange(fn: (s: SyncState) => void) {
  syncListeners.add(fn);
  fn(syncState);
  return () => {
    syncListeners.delete(fn);
  };
}

const refreshListeners = new Set<() => void>();
/** Prévient quand des données fraîches sont arrivées du Sheets. */
export function onRefresh(fn: () => void) {
  refreshListeners.add(fn);
  return () => {
    refreshListeners.delete(fn);
  };
}

// ─── Envoi de la file d'attente ───────────────────────────────
let flushing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;

export function flush(): Promise<void> {
  if (flushing) return flushing;
  if (outbox.length === 0) {
    setSync({ status: 'idle', message: undefined });
    return Promise.resolve();
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSync({ status: 'offline' });
    return Promise.resolve();
  }
  flushing = (async () => {
    setSync({ status: 'syncing' });
    const batch = outbox.slice(0, 50);
    try {
      await call('batch', { ops: batch });
      outbox = outbox.slice(batch.length);
      saveOutbox();
      retryDelay = 2000;
      setSync({ status: outbox.length ? 'syncing' : 'idle', message: undefined });
    } catch (e: any) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setSync({ status: offline ? 'offline' : 'error', message: e?.message });
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => flush(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
      throw e;
    } finally {
      flushing = null;
    }
  })()
    .then(() => (outbox.length ? flush() : undefined))
    .catch(() => undefined);
  return flushing;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush());
  window.addEventListener('offline', () => setSync({ status: 'offline' }));
}

function enqueue(op: Op) {
  applyLocal(op);
  saveCache();
  outbox.push(op);
  saveOutbox();
  setSync({});
  flush();
}

// ─── Lecture ──────────────────────────────────────────────────
let refreshing: Promise<void> | null = null;

/** Recharge tout le Sheets en un seul appel, puis réapplique les écritures pas encore envoyées. */
export function refresh(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      // On vide d'abord la file pour que le serveur soit à jour.
      await flush();
      const data = await call<Partial<Record<Table, Row[]>>>('bootstrap');
      const next = emptyCache();
      for (const t of TABLES) next[t] = (data[t] || []).map(clean);
      cache = next;
      outbox.forEach(applyLocal);
      hasCache = true;
      saveCache();
      refreshListeners.forEach((fn) => fn());
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Résout tout de suite s'il existe une copie locale, sinon attend le premier chargement. */
export async function ready(): Promise<void> {
  if (hasCache) return;
  await refresh();
}

export function list<T = Row>(table: Table): T[] {
  return cache[table] as unknown as T[];
}

// ─── Écriture ─────────────────────────────────────────────────
const AUTHORLESS: Table[] = ['settings'];

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function insert<T extends Record<string, any>>(table: Table, data: T): T & Row {
  const now = new Date().toISOString();
  const row = clean({
    created_at: now,
    updated_at: now,
    ...(AUTHORLESS.includes(table) ? {} : { author: config.me() || undefined }),
    ...data,
    id: (data as any).id || uuid(),
  } as Row);
  enqueue({ action: 'insert', table, row });
  return row as T & Row;
}

export function update<T = Row>(table: Table, id: string, patch: Record<string, any>): T {
  const fullPatch = { ...patch, updated_at: new Date().toISOString() };
  enqueue({ action: 'update', table, id, patch: fullPatch });
  return (cache[table].find((r) => r.id === id) || { id, ...fullPatch }) as T;
}

export function upsert(table: Table, row: Row): Row {
  const now = new Date().toISOString();
  const full = clean({ created_at: now, ...row, updated_at: now });
  enqueue({ action: 'upsert', table, row: full });
  return full;
}

export function remove(table: Table, id: string) {
  enqueue({ action: 'delete', table, id });
}

// ─── Photos (envoi direct, il faut du réseau) ─────────────────
function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Lecture de la photo impossible.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPhoto(file: File): Promise<{ url: string; file_id: string }> {
  const base64 = await fileToBase64(file);
  return call('uploadPhoto', { base64, mimeType: file.type || 'image/jpeg', name: file.name });
}

/** Met à la corbeille Drive une photo remplacée ou retirée (sans bloquer l'app). */
export function trashPhoto(fileId?: string) {
  if (!fileId) return;
  call('trashPhoto', { file_id: fileId }).catch(() => undefined);
}
