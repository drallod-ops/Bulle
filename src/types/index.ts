export type Mood = 'soleil' | 'calme' | 'gris' | 'tempete';

export interface Memory {
  id: string;
  title?: string;
  text: string;
  date: string;
  ambiance: Mood;
  location?: string;
  collection_ids?: string[];
  favorite?: boolean;
  source: 'manual' | 'game' | 'bucket' | 'prayer';
  source_id?: string;
  photo_url?: string;
  photo_file_id?: string;
  poetic?: string;
  author?: string;
  photos?: Photo[];
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  memory_id: string;
  url: string;
  width: number;
  height: number;
  taken_at?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  cover_photo?: string;
  author?: string;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface GameSession {
  id: string;
  game_id: string;
  played_at: string;
  summary?: string;
  winner?: string;
  fun_fact?: string;
  /** Points par joueur, ex. { "Steve": 3, "Marie": 5 }. En coopération : { "ensemble": 7 }. */
  scores?: Record<string, number>;
  mode?: 'libre' | 'versus' | 'coop';
  author?: string;
}

export interface BucketItem {
  id: string;
  title: string;
  timing: 'ce_soir' | 'plus_tard';
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  author?: string;
  created_at: string;
}

export interface PrayerTopic {
  id: string;
  title: string;
  description?: string;
  type: 'ponctuel' | 'récurrent';
  category: 'toport' | 'recognition';
  status: 'active' | 'answered';
  created_at: string;
  answered_at?: string;
  answered_by?: string;
  archived_at?: string | null;
  author?: string;
}

export interface CustomQuestion {
  id: string;
  theme: string;
  question: string;
  author?: string;
  created_at: string;
}

export interface CustomDefi {
  id: string;
  text: string;
  author?: string;
  created_at: string;
}

export interface Settings {
  language: 'fr' | 'en';
  theme: 'light' | 'dark';
}
