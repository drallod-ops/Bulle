// Tirages au hasard partagés par toute l'app.

/** Mélange de Fisher-Yates (équitable, contrairement à sort(() => Math.random() - 0.5)). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: readonly T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

const HISTORY_PREFIX = 'bulle_drawn_';

/**
 * Tire un élément en évitant ceux sortis récemment (mémorisés par jeu sur
 * ce téléphone). La mémoire couvre environ la moitié de la banque, pour
 * ne pas revoir les mêmes questions d'une partie à l'autre.
 */
export function pickFresh(key: string, pool: readonly string[]): string | null {
  if (pool.length === 0) return null;
  let history: string[] = [];
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_PREFIX + key) || '[]');
  } catch {
    history = [];
  }
  const memory = Math.max(1, Math.floor(pool.length / 2));
  const recent = new Set(history.slice(-memory));
  const fresh = pool.filter((p) => !recent.has(p));
  const choice = pickRandom(fresh.length ? fresh : pool)!;
  try {
    localStorage.setItem(HISTORY_PREFIX + key, JSON.stringify([...history, choice].slice(-200)));
  } catch {
    /* ignore */
  }
  return choice;
}
