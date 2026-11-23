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
// scored : le jeu propose de compter les points (versus ou coopération).
export const DEFAULT_GAMES: (Game & { scored?: 'versus' | 'coop' })[] = [
  {
    id: 'je-pense',
    name: 'Je pense à...',
    description: "L'un pense à quelque chose, l'autre devine en un minimum de questions.",
    icon: 'Brain',
    enabled: true,
    scored: 'versus',
  },
  {
    id: 'photo-mystere',
    name: 'Photo Mystère',
    description: 'Une photo floue de vos Instants se dévoile peu à peu. Qui la reconnaît le plus vite ?',
    icon: 'Eye',
    enabled: true,
    scored: 'versus',
  },
  {
    id: 'qui-connait-mieux',
    name: 'À propos de toi',
    description: "Une question, deux réponses en secret, puis on compare. Points en option.",
    icon: 'Users',
    enabled: true,
    scored: 'versus',
  },
  {
    id: 'chronologie',
    name: 'Chronologie',
    description: 'Deux de vos Instants : lequel est arrivé en premier ?',
    icon: 'CalendarClock',
    enabled: true,
    scored: 'versus',
  },
  {
    id: 'tu-preferes',
    name: 'Tu préfères...',
    description: 'Chacun choisit en secret. Combien de fois êtes-vous en phase ?',
    icon: 'Split',
    enabled: true,
    scored: 'coop',
  },
  {
    id: 'chrono-mots',
    name: 'Chrono-mots',
    description: "60 secondes pour faire deviner un maximum de mots, sans les dire.",
    icon: 'Timer',
    enabled: true,
    scored: 'versus',
  },
  {
    id: 'et-si',
    name: 'Et si...',
    description: 'Des questions hypothétiques, sans bonne réponse.',
    icon: 'HelpCircle',
    enabled: true,
  },
  {
    id: 'defis',
    name: 'Défis',
    description: 'Un petit défi à relever à deux, maintenant ou bientôt.',
    icon: 'Target',
    enabled: true,
  },
  {
    id: 'le-hasard',
    name: 'Le hasard',
    description: 'Un instant, une envie ou une prière, piochés au hasard.',
    icon: 'Shuffle',
    enabled: true,
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

export const CHRONO_MOTS = parseLines(chronoMotsRaw);

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
