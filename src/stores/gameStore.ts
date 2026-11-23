import { create } from 'zustand';
import { Game, GameSession } from '../types';
import { createGameSession as createGameSessionRemote, getGameSessions, type SessionResult } from '../services/adeuxContent';
import { deleteGameSessionRemote } from '../services/db';

interface GameStore {
  games: Game[];
  sessions: GameSession[];
  setGames: (games: Game[]) => void;
  setSessions: (sessions: GameSession[]) => void;
  loadSessions: () => Promise<void>;
  logSession: (gameId: string, summary?: string, result?: SessionResult) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getRandomGame: () => Game | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  sessions: [],
  setGames: (games) => set({ games }),
  setSessions: (sessions) => set({ sessions }),
  loadSessions: async () => {
    try {
      set({ sessions: await getGameSessions() });
    } catch {
      /* les scores restent consultables au prochain chargement */
    }
  },
  logSession: async (gameId, summary, result) => {
    const saved = await createGameSessionRemote(gameId, summary, result);
    set((state) => ({ sessions: [saved, ...state.sessions] }));
  },
  deleteSession: async (id) => {
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
    await deleteGameSessionRemote(id);
  },
  getRandomGame: () => {
    const games = get().games.filter((g) => g.enabled);
    return games.length ? games[Math.floor(Math.random() * games.length)] : null;
  },
}));
