import { create } from 'zustand';

// Bandeau « Annuler » affiché quelques secondes après une action
// (cocher, supprimer…), à la place des fenêtres de confirmation.
interface UndoState {
  message: string | null;
  undo: (() => void) | null;
  actionLabel: string;
  key: number;
  show: (message: string, undo?: () => void, actionLabel?: string, durationMs?: number) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useUndo = create<UndoState>((set) => ({
  message: null,
  undo: null,
  actionLabel: 'Annuler',
  key: 0,
  show: (message, undo, actionLabel = 'Annuler', durationMs = 5000) => {
    if (timer) clearTimeout(timer);
    set((s) => ({ message, undo: undo || null, actionLabel, key: s.key + 1 }));
    if (durationMs > 0) timer = setTimeout(() => set({ message: null, undo: null }), durationMs);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ message: null, undo: null });
  },
}));

export const showUndo = (message: string, undo?: () => void) => useUndo.getState().show(message, undo);
/** Message d'état, avec une action facultative (ex. « Réessayer »). */
export const showNotice = (message: string, action?: () => void, actionLabel?: string, durationMs = 5000) =>
  useUndo.getState().show(message, action, actionLabel, durationMs);
