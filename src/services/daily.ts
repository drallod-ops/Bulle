// La question du jour et le défi de la semaine.
// Tout est rangé dans l'onglet « settings » du Sheets, une ligne par réponse :
// pas besoin de modifier l'Apps Script.
import * as api from './api';
import { todayKey, weekKey, previousWeekKey, stablePick } from './time';
import { QUI_CONNAIT_THEMES, ET_SI_QUESTIONS, DEFIS } from './adeuxContent';
import { playersOrDefault } from './settings';

type SettingRow = { id: string; value?: string };

const rows = () => api.list<SettingRow>('settings');
const read = (id: string): unknown => {
  const r = rows().find((x) => x.id === id);
  if (!r?.value) return undefined;
  try {
    return JSON.parse(r.value);
  } catch {
    return undefined;
  }
};
const write = (id: string, value: unknown) =>
  api.upsert('settings', { id, value: JSON.stringify(value), updated_by: api.config.me() || undefined });

// ─── Question du jour ─────────────────────────────────────────
export function dailyQuestionPool(custom: string[] = []): string[] {
  return [...Object.values(QUI_CONNAIT_THEMES).flat(), ...ET_SI_QUESTIONS, ...custom];
}

export function questionOfDay(day = todayKey(), custom: string[] = []): string {
  return stablePick(dailyQuestionPool(custom), `qdj-${day}`) || 'Quel a été le meilleur moment de ta journée ?';
}

export function dailyAnswers(day = todayKey()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of playersOrDefault()) {
    const v = read(`qdj:${day}:${name}`);
    if (typeof v === 'string' && v.trim()) out[name] = v;
  }
  return out;
}

export function answerToday(text: string) {
  write(`qdj:${todayKey()}:${api.config.me()}`, text.trim());
}

/** Jours passés où vous avez répondu tous les deux, du plus récent au plus ancien. */
export function dailyHistory(): { day: string; answers: Record<string, string> }[] {
  const days = new Set(rows().filter((r) => r.id.startsWith('qdj:')).map((r) => r.id.split(':')[1]));
  return [...days]
    .filter((d) => d !== todayKey())
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({ day, answers: dailyAnswers(day) }))
    .filter((d) => Object.keys(d.answers).length === 2);
}

// ─── Défi de la semaine ───────────────────────────────────────
export function defiOfWeek(week = weekKey(), custom: string[] = []): string {
  const chosen = read(`defi:${week}`);
  if (typeof chosen === 'string' && chosen) return chosen;
  return stablePick([...DEFIS, ...custom], `defi-${week}`) || 'Prendre un moment rien que pour vous deux.';
}

export function changeDefi(text: string) {
  write(`defi:${weekKey()}`, text);
}

export function defiDone(week = weekKey()): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const name of playersOrDefault()) out[name] = read(`defi:${week}:${name}`) === true;
  return out;
}

export function setDefiDone(done: boolean) {
  write(`defi:${weekKey()}:${api.config.me()}`, done);
}

/** Nombre de semaines d'affilée où vous l'avez relevé tous les deux. */
export function defiStreak(): number {
  const bothDone = (w: string) => Object.values(defiDone(w)).every(Boolean);
  let week = weekKey();
  if (!bothDone(week)) week = previousWeekKey(week);
  let streak = 0;
  while (bothDone(week) && streak < 520) {
    streak++;
    week = previousWeekKey(week);
  }
  return streak;
}
