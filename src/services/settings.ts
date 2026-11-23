// Réglages partagés entre vos deux téléphones (onglet "settings" du Sheets).
// Une copie est gardée dans le navigateur pour un affichage immédiat au
// démarrage ; elle est remplacée par la version du Sheets à chaque synchro.
import * as api from './api';

export const SHARED_KEYS = {
  theme: 'bulle_theme',
  color_overrides: 'bulle_color_overrides',
  together_since: 'bulle_together_since',
} as const;
type SharedKey = keyof typeof SHARED_KEYS;

const timers: Record<string, ReturnType<typeof setTimeout>> = {};

/** Enregistre un réglage partagé (regroupe les changements rapprochés, ex. un curseur de couleur). */
export function setSharedSetting(key: SharedKey | 'players', value: unknown) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    api.upsert('settings', { id: key, value: JSON.stringify(value), updated_by: api.config.me() || undefined });
  }, 800);
}

export function getSharedSetting<T>(key: string, fallback: T): T {
  const row = api.list<{ id: string; value?: string }>('settings').find((r) => r.id === key);
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

/** Recopie les réglages du Sheets dans le stockage local du téléphone. */
export function pullSharedSettingsToLocal() {
  (Object.keys(SHARED_KEYS) as SharedKey[]).forEach((key) => {
    const value = getSharedSetting<unknown>(key, undefined);
    if (value === undefined) return;
    try {
      localStorage.setItem(SHARED_KEYS[key], typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      /* ignore */
    }
  });
}

// ─── Les deux joueurs ─────────────────────────────────────────
export function getPlayers(): [string, string] | null {
  const p = getSharedSetting<string[] | null>('players', null);
  return p && p.length === 2 && p[0] && p[1] ? [p[0], p[1]] : null;
}

export function playersOrDefault(): [string, string] {
  return getPlayers() || ['Joueur 1', 'Joueur 2'];
}

export function setPlayers(players: [string, string]) {
  api.upsert('settings', { id: 'players', value: JSON.stringify(players), updated_by: api.config.me() || undefined });
}
