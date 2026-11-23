import { setSharedSetting } from './services/settings';

export const T = {
  paper: 'var(--paper)',
  paper2: 'var(--paper2)',
  surface: 'var(--surface)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  sage: 'var(--accent)',
  border: 'var(--border)',
  radius: 'var(--radius)',
  radiusMd: 'var(--radius-md)',
  radiusSm: 'var(--radius-sm)',
  rust: 'var(--rust)',
  font: "'Figtree',-apple-system,'SF Pro Text','Helvetica Neue',sans-serif",
  display: "'Bricolage Grotesque','Figtree',-apple-system,sans-serif",
};

// Couleurs contextuelles par module — jamais liées à une émotion, juste à une section.
// Partagées entre tous les thèmes (via variables CSS), pilotables en
// direct par l'éditeur de couleurs (voir ColorEditor).
export const CONTEXT = {
  adeux: 'var(--context-adeux)', // rouge orangé
  priere: 'var(--context-priere)', // vieux rose brun
  envies: 'var(--context-envies)', // miel
  instants: 'var(--context-instants)', // vert canapé
  libre: 'var(--context-libre)', // brun clair
};

// Valeurs par défaut (utilisées par l'éditeur de couleurs pour l'état
// initial et le bouton "Réinitialiser").
export const DEFAULT_CONTEXT_COLORS = {
  adeux: '#C4532F',
  priere: '#85596A',
  envies: '#B37A2C',
  instants: '#4E6E55',
  libre: '#8F7A66',
};
export const DEFAULT_RADIUS = { radius: 18, radiusMd: 14, radiusSm: 999 };

export type ThemeName = 'salon' | 'soiree' | 'papier';
export const THEME_ORDER: ThemeName[] = ['salon', 'soiree', 'papier'];
export const THEME_LABELS: Record<ThemeName, string> = {
  salon: 'Salon',
  soiree: 'Soirée',
  papier: 'Papier',
};

// Palette de base par thème (valeurs par défaut, définies aussi dans
// index.css). Servent de référence à l'éditeur de couleurs.
export const THEME_VARS = ['paper', 'paper2', 'surface', 'ink', 'muted', 'border', 'accent'] as const;
export type ThemeVar = (typeof THEME_VARS)[number];

export const DEFAULT_THEME_PALETTES: Record<ThemeName, Record<ThemeVar, string>> = {
  salon: { paper: '#F3EADC', paper2: '#E9DCC7', surface: '#FBF6EE', ink: '#33241B', muted: '#73604F', border: '#DECDB3', accent: '#3F5E47' },
  soiree: { paper: '#211813', paper2: '#2D221B', surface: '#2A2019', ink: '#F2E7D8', muted: '#B8A08A', border: '#45362B', accent: '#7FA588' },
  papier: { paper: '#F7F3EC', paper2: '#EDE8DF', surface: '#FFFFFF', ink: '#2E2B27', muted: '#736C61', border: '#E4DED2', accent: '#6F8C76' },
};

// Couleur automatique d'un instant selon ce à quoi il est lié — jamais
// choisie manuellement à la création.
export type MemorySource = 'manual' | 'game' | 'bucket' | 'prayer';
export const SOURCE_COLORS: Record<MemorySource, string> = {
  manual: 'var(--context-libre)',
  game: CONTEXT.adeux,
  bucket: CONTEXT.envies,
  prayer: CONTEXT.priere,
};

export const SOURCE_LABELS: Record<MemorySource, string> = {
  manual: 'Libre',
  game: 'À deux',
  bucket: 'Envies',
  prayer: 'Prière',
};

// Libellé affiché sur les cartes d'instants ("Lié à un moment à deux"...)
export const SOURCE_LINK_LABELS: Partial<Record<MemorySource, string>> = {
  game: 'Lié à un moment à deux',
  bucket: 'Lié à une envie',
  prayer: 'Lié à une prière',
};

const STORAGE_KEY = 'bulle_theme';

/** Change le thème et le partage avec l'autre téléphone. */
export function chooseTheme(name: ThemeName) {
  applyTheme(name);
  setSharedSetting('theme', name);
}

export function applyTheme(name: ThemeName) {
  document.body.setAttribute('data-theme', name);
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): ThemeName {
  try {
    const t = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (t && THEME_ORDER.includes(t)) return t;
  } catch {
    /* ignore */
  }
  return 'salon';
}
