import React from 'react';
import { config } from '../services/api';

/** Mention « ajouté par… / fait par… ». Rien si c'est la personne de ce téléphone. */
export const AuthorTag: React.FC<{ author?: string | null; doneBy?: string | null; doneLabel?: string; inline?: boolean }> = ({
  author,
  doneBy,
  doneLabel = 'fait par',
  inline,
}) => {
  const me = config.me();
  const parts: string[] = [];
  if (author && author !== me) parts.push(`ajouté par ${author}`);
  if (doneBy) parts.push(`${doneLabel} ${doneBy === me ? 'toi' : doneBy}`);
  if (!parts.length) return null;
  if (inline) return <span>, {parts.join(', ')}</span>;
  return <p className="item-meta">{parts.join(', ')}</p>;
};
