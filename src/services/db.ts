// Accès aux données de Bulle, au-dessus du client générique (api.ts).
// Les noms des fonctions reprennent ceux de l'ancienne couche Supabase,
// pour que les stores n'aient presque pas à changer.
import * as api from './api';
import type { Table } from './api';
import type { Memory, Collection, BucketItem, PrayerTopic, GameSession, CustomQuestion, CustomDefi } from '../types';

const byDesc = <T,>(key: keyof T) => (a: T, b: T) => String(b[key] ?? '').localeCompare(String(a[key] ?? ''));

async function all<T>(table: Table, sortKey: keyof T = 'created_at' as keyof T): Promise<T[]> {
  await api.ready();
  return [...api.list<T>(table)].sort(byDesc<T>(sortKey));
}

// ─── Instants ───────────────────────────────────────────
export async function getMemories() {
  return (await all<Memory>('moments')).filter((m) => !m.deleted_at);
}
export async function getTrashedMemories() {
  return (await all<Memory>('moments', 'deleted_at')).filter((m) => !!m.deleted_at);
}
export async function createMemory(memory: Omit<Memory, 'id'> & { id?: string }) {
  return api.insert('moments', memory) as unknown as Memory;
}
export async function updateMemory(id: string, updates: Partial<Memory>) {
  return api.update<Memory>('moments', id, updates);
}
export async function trashMemory(id: string) {
  return api.update<Memory>('moments', id, { deleted_at: new Date().toISOString() });
}
export async function restoreMemory(id: string) {
  return api.update<Memory>('moments', id, { deleted_at: null });
}
export async function permanentlyDeleteMemory(id: string) {
  api.remove('moments', id);
}
export const uploadPhoto = api.uploadPhoto;
export const trashPhoto = api.trashPhoto;

// ─── Envies ─────────────────────────────────────────────
export const getBucketItemsRemote = () => all<BucketItem>('bucket_items');
export const createBucketItemRemote = async (item: Omit<BucketItem, 'id'>) => api.insert('bucket_items', item) as unknown as BucketItem;
export const updateBucketItemRemote = async (id: string, updates: Partial<BucketItem> | Record<string, any>) =>
  api.update<BucketItem>('bucket_items', id, updates);
export const deleteBucketItemRemote = async (id: string) => api.remove('bucket_items', id);

// ─── Prière ─────────────────────────────────────────────
export const getPrayerTopicsRemote = () => all<PrayerTopic>('prayer_topics');
export const createPrayerTopicRemote = async (topic: Omit<PrayerTopic, 'id'>) => api.insert('prayer_topics', topic) as unknown as PrayerTopic;
export const updatePrayerTopicRemote = async (id: string, updates: Partial<PrayerTopic>) => api.update<PrayerTopic>('prayer_topics', id, updates);
export const deletePrayerTopicRemote = async (id: string) => api.remove('prayer_topics', id);

// ─── Jeux ───────────────────────────────────────────────
export const getGameSessionsRemote = () => all<GameSession>('game_sessions', 'played_at');
export const createGameSessionRemote = async (session: Omit<GameSession, 'id'>) => api.insert('game_sessions', session) as unknown as GameSession;
export const deleteGameSessionRemote = async (id: string) => api.remove('game_sessions', id);

// ─── Collections ────────────────────────────────────────
export const getCollectionsRemote = () => all<Collection>('collections');
export const createCollectionRemote = async (c: Omit<Collection, 'id'>) => api.insert('collections', c) as unknown as Collection;
export const deleteCollectionRemote = async (id: string) => api.remove('collections', id);

// ─── Contenu perso des jeux ─────────────────────────────
export const getCustomQuestionsRemote = () => all<CustomQuestion>('custom_questions');
export const createCustomQuestionRemote = async (q: Omit<CustomQuestion, 'id'>) => api.insert('custom_questions', q) as unknown as CustomQuestion;
export const updateCustomQuestionRemote = async (id: string, u: Partial<CustomQuestion>) => api.update<CustomQuestion>('custom_questions', id, u);
export const deleteCustomQuestionRemote = async (id: string) => api.remove('custom_questions', id);

export const getCustomDefisRemote = () => all<CustomDefi>('custom_defis');
export const createCustomDefiRemote = async (d: Omit<CustomDefi, 'id'>) => api.insert('custom_defis', d) as unknown as CustomDefi;
export const updateCustomDefiRemote = async (id: string, u: Partial<CustomDefi>) => api.update<CustomDefi>('custom_defis', id, u);
export const deleteCustomDefiRemote = async (id: string) => api.remove('custom_defis', id);
