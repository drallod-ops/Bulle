import { create } from 'zustand';

// Bandeau « Annuler » affiché quelques secondes après une action
// (cocher, supprimer…), à la place des fenêtres de confirmation.
interface UndoState {
  message: string | null;
  undo: (() => void) | null;
  key: number;
  show: (message: string, undo?: () => void) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useUndo = create<UndoState>((set) => ({
  message: null,
  undo: null,
  key: 0,
  show: (message, undo) => {
    if (timer) clearTimeout(timer);
    set((s) => ({ message, undo: undo || null, key: s.key + 1 }));
    timer = setTimeout(() => set({ message: null, undo: null }), 5000);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ message: null, undo: null });
  },
}));

export const showUndo = (message: string, undo?: () => void) => useUndo.getState().show(message, undo);
