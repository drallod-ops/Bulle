import { setSharedSetting } from './settings';

const STORAGE_KEY = 'bulle_together_since';

export function getTogetherSince(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setTogetherSince(isoDate: string) {
  try {
    localStorage.setItem(STORAGE_KEY, isoDate);
  } catch {
    /* ignore */
  }
  setSharedSetting('together_since', isoDate);
}

type Unit = 'annees' | 'jours' | 'minutes' | 'secondes';

const UNIT_LABELS: Record<Unit, (n: number) => string> = {
  annees: (n) => `${n} an${n > 1 ? 's' : ''}`,
  jours: (n) => `${n.toLocaleString('fr-FR')} jour${n > 1 ? 's' : ''}`,
  minutes: (n) => `${n.toLocaleString('fr-FR')} minutes`,
  secondes: (n) => `${n.toLocaleString('fr-FR')} secondes`,
};

// Un chiffre ludique, sous une unité tirée au hasard à chaque visite —
// jamais une statistique de suivi, juste un petit clin d'œil.
export function getFunDurationSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return '';

  const units: Unit[] = ['annees', 'jours', 'minutes', 'secondes'];
  const unit = units[Math.floor(Math.random() * units.length)];

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(seconds / (3600 * 24));
  const years = ms / (1000 * 3600 * 24 * 365.25);

  switch (unit) {
    case 'annees':
      return UNIT_LABELS.annees(Math.floor(years * 10) / 10);
    case 'jours':
      return UNIT_LABELS.jours(days);
    case 'minutes':
      return UNIT_LABELS.minutes(minutes);
    case 'secondes':
      return UNIT_LABELS.secondes(seconds);
  }
}
