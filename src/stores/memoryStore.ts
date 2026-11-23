import { create } from 'zustand';
import { Memory } from '../types';
import {
  getMemories,
  getTrashedMemories,
  createMemory,
  updateMemory as updateMemoryRemote,
  trashMemory,
  restoreMemory,
  permanentlyDeleteMemory,
} from '../services/db';

interface MemoryStore {
  memories: Memory[];
  trashed: Memory[];
  loading: boolean;
  error: string | null;
  loadMemories: () => Promise<void>;
  loadTrash: () => Promise<void>;
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Omit<Memory, 'id'>) => Promise<Memory | undefined>;
  /** Aperçu local d'une photo en cours d'envoi (non enregistré dans le Sheets). */
  setLocalPhoto: (id: string, url: string | undefined) => void;
  updateMemory: (id: string, memory: Partial<Memory>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  purgeForever: (id: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  trashed: [],
  loading: false,
  error: null,

  loadMemories: async () => {
    set({ loading: true, error: null });
    try {
      const memories = await getMemories();
      set({ memories, loading: false });
    } catch (e: any) {
      set({ error: e.message || 'Erreur de chargement', loading: false });
    }
  },

  loadTrash: async () => {
    try {
      // La purge après 30 jours est faite chaque nuit par l'Apps Script.
      const trashed = await getTrashedMemories();
      set({ trashed });
    } catch {
      /* silencieux */
    }
  },

  setMemories: (memories) => set({ memories }),

  addMemory: async (memory) => {
    const tempId = `temp_${Date.now()}`;
    const optimisticMemory = { ...memory, id: tempId } as Memory;
    set((state) => ({ memories: [optimisticMemory, ...state.memories] }));
    try {
      const saved = await createMemory(memory);
      set((state) => ({
        memories: state.memories.map((m) => (m.id === tempId ? saved : m)),
      }));
      return saved;
    } catch (e: any) {
      set((state) => ({
        memories: state.memories.filter((m) => m.id !== tempId),
        error: e.message || "Erreur lors de l'enregistrement",
      }));
      throw e;
    }
  },

  setLocalPhoto: (id, url) =>
    set((state) => ({ memories: state.memories.map((m) => (m.id === id ? { ...m, photo_url: url } : m)) })),

  updateMemory: async (id, memory) => {
    const previous = get().memories;
    set((state) => ({
      memories: state.memories.map((m) => (m.id === id ? { ...m, ...memory } : m)),
    }));
    try {
      await updateMemoryRemote(id, memory);
    } catch (e: any) {
      set({ memories: previous, error: e.message || 'Erreur lors de la mise à jour' });
      throw e;
    }
  },

  // Suppression = passage en corbeille (30 jours), jamais immédiate.
  deleteMemory: async (id) => {
    const previous = get().memories;
    const item = previous.find((m) => m.id === id);
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
    try {
      const trashedItem = await trashMemory(id);
      if (item) set((state) => ({ trashed: [trashedItem, ...state.trashed] }));
    } catch (e: any) {
      set({ memories: previous, error: e.message || 'Erreur lors de la suppression' });
      throw e;
    }
  },

  restore: async (id) => {
    const previous = get().trashed;
    set((state) => ({ trashed: state.trashed.filter((m) => m.id !== id) }));
    try {
      const restored = await restoreMemory(id);
      set((state) => ({ memories: [restored, ...state.memories] }));
    } catch {
      set({ trashed: previous });
    }
  },

  purgeForever: async (id) => {
    const previous = get().trashed;
    set((state) => ({ trashed: state.trashed.filter((m) => m.id !== id) }));
    try {
      await permanentlyDeleteMemory(id);
    } catch {
      set({ trashed: previous });
    }
  },
}));
