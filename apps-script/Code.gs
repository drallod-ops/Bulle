/**
 * Bulle — API Google Apps Script
 * ------------------------------------------------------------
 * Sert d'API à l'app : lit et écrit dans le Google Sheets "Bulle - Données"
 * et range les photos dans le dossier Drive "Bulle/Photos".
 *
 * Installation : voir INSTALL.md (section "Apps Script").
 */

// ─── Configuration ────────────────────────────────────────────
const SPREADSHEET_ID = '1HC7Dv74VgBs0Tfucfz5OImHwubw_Rb8DN90zMywxJaw';
const PHOTOS_FOLDER_ID = '1IvJV2IK-UZLSSbRSRfKuugyqrnjbQQfP';

// Code secret partagé par vous deux. Il n'est utilisé qu'au premier
// lancement de setup() : ensuite il vit dans les propriétés du script
// (Paramètres du projet → Propriétés du script → SECRET).
const INITIAL_SECRET = 'CHANGE-MOI';

const TRASH_RETENTION_DAYS = 30;

// Une table = un onglet. L'ordre des colonnes est celui du Sheets.
const TABLES = {
  moments: ['id', 'title', 'text', 'date', 'ambiance', 'location', 'collection_ids', 'favorite', 'source', 'source_id', 'photo_url', 'photo_file_id', 'poetic', 'author', 'deleted_at', 'created_at', 'updated_at'],
  collections: ['id', 'name', 'cover_photo', 'author', 'created_at', 'updated_at'],
  bucket_items: ['id', 'title', 'timing', 'completed', 'completed_at', 'completed_by', 'author', 'created_at', 'updated_at'],
  prayer_topics: ['id', 'title', 'description', 'type', 'category', 'status', 'answered_at', 'answered_by', 'archived_at', 'author', 'created_at', 'updated_at'],
  game_sessions: ['id', 'game_id', 'played_at', 'summary', 'winner', 'scores', 'mode', 'fun_fact', 'author', 'created_at', 'updated_at'],
  custom_questions: ['id', 'theme', 'question', 'author', 'created_at', 'updated_at'],
  custom_defis: ['id', 'text', 'author', 'created_at', 'updated_at'],
  settings: ['id', 'value', 'updated_by', 'created_at', 'updated_at'],
};

const JSON_COLUMNS = ['collection_ids', 'scores'];
const BOOL_COLUMNS = ['favorite', 'completed'];

// ─── Points d'entrée HTTP ─────────────────────────────────────
function doGet() {
  return json_({ ok: true, data: 'Bulle API' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    checkSecret_(req.secret);
    return json_({ ok: true, data: handle_(req) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!expected) throw new Error('Code secret non configuré : lance setup() dans l\'éditeur Apps Script.');
  if (secret !== expected) throw new Error('Code secret incorrect.');
}

// ─── Routage ──────────────────────────────────────────────────
function handle_(req) {
  switch (req.action) {
    case 'ping':
      return 'pong';
    case 'bootstrap':
      return bootstrap_();
    case 'list':
      return readAll_(req.table);
    case 'batch':
      return withLock_(() => (req.ops || []).map(applyOp_));
    case 'insert':
    case 'update':
    case 'upsert':
    case 'delete':
      return withLock_(() => applyOp_(req));
    case 'uploadPhoto':
      return uploadPhoto_(req);
    case 'trashPhoto':
      trashPhoto_(req.file_id);
      return true;
    default:
      throw new Error('Action inconnue : ' + req.action);
  }
}

function applyOp_(op) {
  assertTable_(op.table);
  switch (op.action) {
    case 'insert':
    case 'upsert':
      return upsert_(op.table, op.row);
    case 'update':
      return update_(op.table, op.id, op.patch);
    case 'delete':
      return remove_(op.table, op.id);
    default:
      throw new Error('Opération inconnue : ' + op.action);
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function assertTable_(table) {
  if (!TABLES[table]) throw new Error('Table inconnue : ' + table);
}

// ─── Accès aux onglets ────────────────────────────────────────
function sheet_(table) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(table);
  const columns = TABLES[table];
  if (!sh) {
    sh = ss.insertSheet(table);
    sh.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // Ajoute les colonnes manquantes (si le schéma évolue).
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = columns.filter((c) => headers.indexOf(c) === -1);
  if (missing.length) {
    sh.getRange(1, headers.filter(Boolean).length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function decode_(header, value) {
  if (value === '' || value === null) return null;
  if (BOOL_COLUMNS.indexOf(header) !== -1) return value === true || value === 'true';
  if (JSON_COLUMNS.indexOf(header) !== -1) {
    try { return JSON.parse(value); } catch (e) { return null; }
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function encode_(header, value) {
  if (value === null || value === undefined) return '';
  if (JSON_COLUMNS.indexOf(header) !== -1) return JSON.stringify(value);
  return String(value);
}

function readAll_(table) {
  assertTable_(table);
  const sh = sheet_(table);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter((row) => row[0] !== '')
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = decode_(h, row[i]); });
      return obj;
    });
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function upsert_(table, row) {
  if (!row || !row.id) throw new Error('Ligne sans id.');
  const sh = sheet_(table);
  const headers = headers_(sh);
  const rowIndex = findRow_(sh, row.id);
  if (rowIndex !== -1) return update_(table, row.id, row);
  const values = headers.map((h) => encode_(h, row[h]));
  sh.getRange(sh.getLastRow() + 1, 1, 1, headers.length).setNumberFormat('@').setValues([values]);
  return row;
}

function update_(table, id, patch) {
  const sh = sheet_(table);
  const headers = headers_(sh);
  const rowIndex = findRow_(sh, id);
  if (rowIndex === -1) return null; // déjà supprimée : on ignore
  const range = sh.getRange(rowIndex, 1, 1, headers.length);
  const current = range.getValues()[0];
  const next = headers.map((h, i) => (Object.prototype.hasOwnProperty.call(patch, h) ? encode_(h, patch[h]) : current[i]));
  range.setNumberFormat('@').setValues([next]);
  const obj = {};
  headers.forEach((h, i) => { if (h) obj[h] = decode_(h, next[i]); });
  return obj;
}

function remove_(table, id) {
  const sh = sheet_(table);
  const rowIndex = findRow_(sh, id);
  if (rowIndex === -1) return true;
  if (table === 'moments') {
    const headers = headers_(sh);
    const col = headers.indexOf('photo_file_id');
    if (col !== -1) trashPhoto_(sh.getRange(rowIndex, col + 1).getValue());
  }
  sh.deleteRow(rowIndex);
  return true;
}

function bootstrap_() {
  const out = {};
  Object.keys(TABLES).forEach((t) => { out[t] = readAll_(t); });
  return out;
}

// ─── Photos ───────────────────────────────────────────────────
function uploadPhoto_(req) {
  if (!req.base64) throw new Error('Photo manquante.');
  const bytes = Utilities.base64Decode(req.base64);
  const blob = Utilities.newBlob(bytes, req.mimeType || 'image/jpeg', req.name || ('photo_' + Date.now() + '.jpg'));
  const file = DriveApp.getFolderById(PHOTOS_FOLDER_ID).createFile(blob);
  // Lien non listé : visible seulement par qui connaît l'URL exacte.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { file_id: file.getId(), url: 'https://lh3.googleusercontent.com/d/' + file.getId() };
}

function trashPhoto_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(String(fileId)).setTrashed(true); } catch (e) { /* déjà supprimée */ }
}

// ─── Ménage quotidien (déclencheur) ───────────────────────────
function dailyCleanup() {
  withLock_(() => {
    const limit = Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
    readAll_('moments')
      .filter((m) => m.deleted_at && new Date(m.deleted_at).getTime() < limit)
      .forEach((m) => remove_('moments', m.id));
  });
}

// ─── À lancer une fois depuis l'éditeur ───────────────────────
function setup() {
  Object.keys(TABLES).forEach(sheet_);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) {
    if (INITIAL_SECRET === 'CHANGE-MOI') throw new Error('Remplace INITIAL_SECRET par votre code avant de lancer setup().');
    props.setProperty('SECRET', INITIAL_SECRET);
  }
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'dailyCleanup');
  if (!exists) ScriptApp.newTrigger('dailyCleanup').timeBased().everyDays(1).atHour(4).create();
  Logger.log('Bulle prêt : onglets vérifiés, code secret enregistré, ménage quotidien programmé.');
}
