import { Game, GameSession } from '../types';
import { getGameSessionsRemote, createGameSessionRemote } from './db';

// Contenu chargé depuis des fichiers texte modifiables à la main, dans
// /content à la racine du projet (un fichier par banque de contenu).
// Éditer ces .txt, pousser sur GitHub, puis redéployer : le contenu se
// met à jour automatiquement au prochain build, sans toucher au code.
import jePenseRaw from '../../content/jepense.txt?raw';
import questionsRaw from '../../content/questions.txt?raw';
import etSiRaw from '../../content/etsi.txt?raw';
import defisRaw from '../../content/defis.txt?raw';
import tuPreferesRaw from '../../content/tupreferes.txt?raw';
import chronoMotsRaw from '../../content/chronomots.txt?raw';
import versetsRaw from '../../content/versets.txt?raw';

// Une ligne = une entrée. Lignes vides ignorées.
function parseLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// Blocs séparés par des titres "## Nom du thème".
function parseThemedBlocks(raw: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let currentTheme: string | null = null;
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('##')) {
      currentTheme = line.replace(/^##\s*/, '').trim();
      result[currentTheme] = [];
    } else if (currentTheme) {
      result[currentTheme].push(line);
    }
  }
  return result;
}

// ─── À deux : les expériences ────────────────────────────────────
// duree : pour l'écran « Vous avez combien de temps ? ».
export type Duree = 'rapide' | 'moyen' | 'soiree';
export const DUREE_LABELS: Record<Duree, string> = { rapide: '2 minutes', moyen: '10 minutes', soiree: 'Une soirée' };

export const DEFAULT_GAMES: (Game & { duree: Duree[]; distance?: boolean; scored?: 'versus' | 'coop' })[] = [
  {
    id: 'question-du-jour',
    name: 'La question du jour',
    description: 'Chacun répond de son côté. Les réponses se dévoilent quand vous avez répondu tous les deux.',
    icon: 'MessageCircleHeart',
    enabled: true,
    duree: ['rapide'],
    distance: true,
  },
  {
    id: 'defi-semaine',
    name: 'Le défi de la semaine',
    description: 'Un petit défi à relever ensemble avant dimanche.',
    icon: 'Target',
    enabled: true,
    duree: ['rapide'],
    distance: true,
  },
  {
    id: 'qui-connait-mieux',
    name: 'À propos de toi',
    description: 'Des questions pour mieux se connaître, et des « Et si… » pour rêver.',
    icon: 'Users',
    enabled: true,
    duree: ['moyen', 'soiree'],
  },
  {
    id: 'tu-preferes',
    name: 'Tu préfères…',
    description: 'Chacun choisit en secret. Combien de fois êtes-vous en phase ?',
    icon: 'Split',
    enabled: true,
    duree: ['rapide', 'moyen'],
    scored: 'coop',
  },
  {
    id: 'verset',
    name: 'Verset à compléter',
    description: 'Retrouvez ensemble le mot manquant ou la référence.',
    icon: 'BookOpen',
    enabled: true,
    duree: ['rapide', 'moyen'],
    scored: 'coop',
  },
  {
    id: 'souvenirs',
    name: 'Nos souvenirs',
    description: 'Photo mystère, chronologie ou « Où était-ce ? », avec vos Instants.',
    icon: 'Images',
    enabled: true,
    duree: ['moyen', 'soiree'],
  },
  {
    id: 'je-pense',
    name: 'Je pense à…',
    description: "L'un pense à quelque chose, l'autre devine avec des questions fermées.",
    icon: 'Brain',
    enabled: true,
    duree: ['moyen', 'soiree'],
  },
  {
    id: 'chrono-mots',
    name: 'Chrono-mots',
    description: 'Faire deviner un maximum de mots avant la fin du sablier.',
    icon: 'Timer',
    enabled: true,
    duree: ['moyen', 'soiree'],
  },
];

export const JE_PENSE_ITEMS = parseLines(jePenseRaw);

export const JE_PENSE_GUIDING_QUESTIONS = [
  "Est-ce qu'on l'a vécu ensemble ?",
  "C'est arrivé cette année ?",
  "C'est plutôt joyeux ou intense ?",
  "C'est lié à un voyage ?",
  'Est-ce que je connais cette personne ?',
];

export const QUI_CONNAIT_THEMES: Record<string, string[]> = parseThemedBlocks(questionsRaw);

export const ET_SI_QUESTIONS = parseLines(etSiRaw);

export const DEFIS = parseLines(defisRaw);

// Une ligne = "option A | option B".
export const TU_PREFERES: [string, string][] = parseLines(tuPreferesRaw)
  .map((l) => l.split('|').map((x) => x.trim()))
  .filter((p) => p.length === 2 && p[0] && p[1]) as [string, string][];

// Mots classés par catégorie (« # Catégorie » dans le fichier).
export const CHRONO_CATEGORIES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  let current = 'Divers';
  parseLines(chronoMotsRaw).forEach((line) => {
    if (line.startsWith('#')) current = line.slice(1).trim();
    else (out[current] ||= []).push(line);
  });
  return out;
})();
export const CHRONO_MOTS = Object.values(CHRONO_CATEGORIES).flat();

export interface Verset {
  ref: string;
  text: string;
  word: string;
}
export const VERSETS: Verset[] = parseLines(versetsRaw)
  .filter((l) => !l.startsWith('#'))
  .map((l) => l.split('|').map((x) => x.trim()))
  .filter((p) => p.length === 3 && p[1].includes(p[2]))
  .map(([ref, text, word]) => ({ ref, text, word }));

// Conservé pour compatibilité (utilisé comme secours dans le modal de jeu)
export const GAME_PROMPTS: Record<string, string[]> = {
  'je-pense': JE_PENSE_ITEMS,
  'et-si': ET_SI_QUESTIONS,
  defis: DEFIS,
};

export async function getGames(): Promise<Game[]> {
  return DEFAULT_GAMES;
}

export async function getGameSessions(): Promise<GameSession[]> {
  return getGameSessionsRemote();
}

export interface SessionResult {
  scores?: Record<string, number>;
  mode?: 'libre' | 'versus' | 'coop';
  funFact?: string;
}

/** Vainqueur d'une partie en versus (ou « égalité »). */
export function winnerOf(scores?: Record<string, number>): string | undefined {
  if (!scores) return undefined;
  const entries = Object.entries(scores);
  if (entries.length < 2) return undefined;
  const best = Math.max(...entries.map(([, v]) => v));
  const top = entries.filter(([, v]) => v === best);
  return top.length > 1 ? 'égalité' : top[0][0];
}

export async function createGameSession(gameId: string, summary?: string, result?: SessionResult): Promise<GameSession> {
  const mode = result?.mode || (result?.scores ? 'versus' : 'libre');
  return createGameSessionRemote({
    game_id: gameId,
    played_at: new Date().toISOString(),
    summary,
    scores: result?.scores,
    mode,
    winner: mode === 'versus' ? winnerOf(result?.scores) : undefined,
    fun_fact: result?.funFact,
  } as Omit<GameSession, 'id'>);
}
