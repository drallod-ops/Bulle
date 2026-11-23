import React from 'react';
import { config } from '../services/api';

/** Petite mention « ajouté par… / fait par… » sous un élément. Rien si c'est vous seul. */
export const AuthorTag: React.FC<{ author?: string | null; doneBy?: string | null; doneLabel?: string }> = ({ author, doneBy, doneLabel = 'fait par' }) => {
  const me = config.me();
  const parts: string[] = [];
  if (author && author !== me) parts.push(`ajouté par ${author}`);
  if (doneBy) parts.push(`${doneLabel} ${doneBy === me ? 'toi' : doneBy}`);
  if (!parts.length) return null;
  return <p className="author">{parts.join(', ')}</p>;
};
