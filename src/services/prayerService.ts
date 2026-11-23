import { PrayerTopic } from '../types';
import { config } from './api';
import { shuffle } from './random';
import { getPrayerTopicsRemote, createPrayerTopicRemote, updatePrayerTopicRemote, deletePrayerTopicRemote } from './db';

export async function getPrayerTopics(): Promise<PrayerTopic[]> {
  return getPrayerTopicsRemote();
}

export async function createPrayerTopic(
  title: string,
  category: 'toport' | 'recognition',
  type: 'ponctuel' | 'récurrent' = 'ponctuel',
  description?: string
): Promise<PrayerTopic> {
  const now = new Date().toISOString();
  return createPrayerTopicRemote({
    title,
    description,
    type,
    category,
    status: category === 'recognition' ? 'answered' : 'active',
    created_at: now,
    answered_at: category === 'recognition' ? now : undefined,
  });
}

// Une prière "en cours" exaucée bascule automatiquement en "reconnaissance",
// avec une date de départ pour l'archivage à 30 jours.
export async function markPrayerAnswered(topic: PrayerTopic): Promise<PrayerTopic> {
  return updatePrayerTopicRemote(topic.id, {
    status: 'answered',
    category: 'recognition',
    answered_at: new Date().toISOString(),
    answered_by: config.me() || undefined,
  });
}

export async function updatePrayerTopicTitle(id: string, title: string): Promise<PrayerTopic> {
  return updatePrayerTopicRemote(id, { title });
}

// Archive manuelle immédiate : la vraie date d'exaucement (answered_at)
// reste intacte pour l'historique.
export async function archiveTopicNow(id: string): Promise<PrayerTopic> {
  return updatePrayerTopicRemote(id, { archived_at: new Date().toISOString() });
}

export async function deletePrayerTopic(id: string): Promise<void> {
  return deletePrayerTopicRemote(id);
}

const ARCHIVE_AFTER_DAYS = 30;

export function isPrayerTopicArchived(topic: PrayerTopic): boolean {
  if (topic.archived_at) return true;
  if (!topic.answered_at) return false;
  const daysSince = (Date.now() - new Date(topic.answered_at).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= ARCHIVE_AFTER_DAYS;
}

export function getRandomPrayerTopics(topics: PrayerTopic[], count = 1): PrayerTopic[] {
  return shuffle(topics).slice(0, count);
}
