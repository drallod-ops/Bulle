// Petites aides pour parler des durées et des dates en français.

export function durationBetween(fromIso?: string, toIso?: string): string {
  if (!fromIso || !toIso) return '';
  const days = Math.max(0, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000);
  if (days < 1) return "moins d'un jour";
  if (days < 14) return `${Math.round(days)} jour${Math.round(days) > 1 ? 's' : ''}`;
  if (days < 60) return `${Math.round(days / 7)} semaines`;
  if (days < 730) return `${Math.round(days / 30.4)} mois`;
  return `${Math.round(days / 365)} ans`;
}

export const formatDate = (iso: string, withYear = true) =>
  new Date(iso).toLocaleDateString('fr-FR', withYear ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });

export const monthLabel = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Semaine ISO, ex. « 2026-W48 ». */
export function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function previousWeekKey(key: string): string {
  const [y, w] = key.split('-W').map(Number);
  // Jeudi de la semaine donnée, moins 7 jours.
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const thursday = new Date(jan4.getTime() + ((w - 1) * 7 + (4 - (jan4.getUTCDay() || 7))) * 86400000);
  const prev = new Date(thursday.getTime() - 7 * 86400000);
  return weekKey(new Date(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate()));
}

/** Choix stable pour une journée ou une semaine : le même sur les deux téléphones. */
export function stablePick<T>(items: readonly T[], seed: string): T | null {
  if (!items.length) return null;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return items[Math.abs(h) % items.length];
}
