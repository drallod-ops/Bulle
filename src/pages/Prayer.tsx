import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Archive, Pencil, MoreHorizontal, Check, BookHeart } from 'lucide-react';
import { usePrayerStore } from '../stores/prayerStore';
import { Card, Button, Modal, ErrorBanner, Spinner, ActionSheet } from '../components/UI';
import { SwipeRow } from '../components/Feedback';
import { AuthorTag } from '../components/AuthorTag';
import { showUndo } from '../stores/undoStore';
import { PrayerTopic } from '../types';
import { isPrayerTopicArchived } from '../services/prayerService';
import { shuffle } from '../services/random';
import { durationBetween, formatDate, monthLabel } from '../services/time';
import { CONTEXT } from '../theme';

interface PrayerPageProps {
  onCreateMemoryFor?: (topic: PrayerTopic) => void;
}

export const PrayerPage: React.FC<PrayerPageProps> = ({ onCreateMemoryFor }) => {
  const { topics, loading, error, loadTopics, addToPortTopic, addRecognitionTopic, markAnswered, updateTitle, archiveNow, deleteTopic, restoreTopic } =
    usePrayerStore();

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const enCours = topics.filter((t) => t.category === 'toport');
  const recognition = topics.filter((t) => t.category === 'recognition' && !isPrayerTopicArchived(t));
  const answeredAll = topics.filter((t) => t.category === 'recognition');

  const [newTitle, setNewTitle] = useState('');
  const [category, setCategory] = useState<'toport' | 'recognition'>('toport');
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [praying, setPraying] = useState(false);
  const [actionTopic, setActionTopic] = useState<PrayerTopic | null>(null);
  const [editTopic, setEditTopic] = useState<PrayerTopic | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    if (category === 'toport') await addToPortTopic(newTitle.trim());
    else await addRecognitionTopic(newTitle.trim());
    setNewTitle('');
    setShowAdd(false);
  };

  const answer = async (topic: PrayerTopic) => {
    await markAnswered(topic.id);
    showUndo('Exaucé, rangé dans la reconnaissance.', () => restoreTopic(topic));
  };
  const archive = async (topic: PrayerTopic) => {
    await archiveNow(topic.id);
    showUndo("Rangé dans l'historique.", () => restoreTopic(topic));
  };
  const remove = async (topic: PrayerTopic) => {
    await deleteTopic(topic.id);
    showUndo('Sujet supprimé.', () => restoreTopic(topic));
  };

  const saveEdit = async () => {
    if (!editTopic || !editTitle.trim()) return;
    await updateTitle(editTopic.id, editTitle.trim());
    setEditTopic(null);
  };

  return (
    <div className="stack page">
      {error && <ErrorBanner message={error} />}

      {enCours.length + recognition.length > 0 && (
        <button className="big-action" style={{ background: CONTEXT.priere }} onClick={() => setPraying(true)}>
          <span className="big-action-title">Prier ensemble</span>
          <span className="big-action-sub">Un sujet à la fois, en grand</span>
        </button>
      )}

      {showAdd ? (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="segmented">
            <button className={category === 'toport' ? 'on' : ''} onClick={() => setCategory('toport')}>À porter</button>
            <button className={category === 'recognition' ? 'on' : ''} onClick={() => setCategory('recognition')}>Un merci</button>
          </div>
          <input
            className="field"
            type="text"
            placeholder={category === 'toport' ? 'Pour quoi voulez-vous prier ?' : 'Pour quoi dites-vous merci ?'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="row">
            <Button variant="secondary" full onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button full onClick={handleAdd} style={{ background: CONTEXT.priere, color: '#FBF6EE' }}>Ajouter</Button>
          </div>
        </Card>
      ) : (
        <button className="add-line" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Ajouter un sujet
        </button>
      )}

      {loading && topics.length === 0 ? (
        <Spinner />
      ) : (
        <>
          {enCours.length > 0 && (
            <section className="stack-sm">
              <h2 className="section-title">Entre ses mains</h2>
              {enCours.map((topic) => (
                <SwipeRow key={topic.id} onSwipeRight={() => answer(topic)} rightLabel="Exaucé" rightColor={CONTEXT.priere} onSwipeLeft={() => setActionTopic(topic)}>
                  <div className="item">
                    <button className="check" style={{ borderColor: CONTEXT.priere }} onClick={() => answer(topic)} aria-label="Marquer comme exaucé" />
                    <div className="item-body">
                      <p className="item-title">{topic.title}</p>
                      <p className="item-meta">
                        Porté depuis {durationBetween(topic.created_at, new Date().toISOString())}
                        <AuthorTag author={topic.author} inline />
                      </p>
                    </div>
                    <button className="icon-btn" onClick={() => setActionTopic(topic)} aria-label="Options"><MoreHorizontal size={18} /></button>
                  </div>
                </SwipeRow>
              ))}
            </section>
          )}

          {recognition.length > 0 && (
            <section className="stack-sm">
              <h2 className="section-title">Reconnaissance</h2>
              {recognition.map((topic) => (
                <SwipeRow key={topic.id} onSwipeRight={() => archive(topic)} rightLabel="Ranger" rightColor={CONTEXT.libre} onSwipeLeft={() => setActionTopic(topic)}>
                  <div className="item">
                    <span className="check done" style={{ background: CONTEXT.priere, borderColor: CONTEXT.priere }}><Check size={13} /></span>
                    <div className="item-body">
                      <p className="item-title">{topic.title}</p>
                      <p className="item-meta">
                        {topic.answered_at ? `Exaucé le ${formatDate(topic.answered_at, false)}` : 'Merci'}
                        {topic.answered_at && topic.created_at < topic.answered_at && `, après ${durationBetween(topic.created_at, topic.answered_at)}`}
                      </p>
                      {onCreateMemoryFor && (
                        <button className="link-btn" style={{ color: CONTEXT.priere, padding: '4px 0', textAlign: 'left' }} onClick={() => onCreateMemoryFor(topic)}>
                          + Garder un instant
                        </button>
                      )}
                    </div>
                    <button className="icon-btn" onClick={() => setActionTopic(topic)} aria-label="Options"><MoreHorizontal size={18} /></button>
                  </div>
                </SwipeRow>
              ))}
            </section>
          )}

          {topics.length === 0 && (
            <p className="empty">Déposez ici ce que vous portez ensemble. Glissez un sujet vers la droite quand la prière est exaucée.</p>
          )}
        </>
      )}

      {answeredAll.length > 0 && (
        <button className="add-line quiet" onClick={() => setShowHistory(true)}>
          <BookHeart size={18} /> Journal de reconnaissance ({answeredAll.length})
        </button>
      )}

      <ActionSheet
        isOpen={!!actionTopic}
        onClose={() => setActionTopic(null)}
        items={
          actionTopic
            ? [
                { key: 'edit', icon: <Pencil size={16} />, label: 'Modifier', onClick: () => { setEditTopic(actionTopic); setEditTitle(actionTopic.title); } },
                ...(actionTopic.category === 'toport'
                  ? [{ key: 'answer', icon: <Check size={16} />, label: 'Exaucé', onClick: () => answer(actionTopic) }]
                  : [{ key: 'archive', icon: <Archive size={16} />, label: "Ranger dans l'historique", onClick: () => archive(actionTopic) }]),
                { key: 'delete', icon: <Trash2 size={16} color="var(--rust)" />, label: 'Supprimer', danger: true, onClick: () => remove(actionTopic) },
              ]
            : []
        }
      />

      <Modal isOpen={!!editTopic} onClose={() => setEditTopic(null)} title="Modifier le sujet">
        <div className="stack">
          <input className="field" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
          <Button full onClick={saveEdit} style={{ background: CONTEXT.priere, color: '#FBF6EE' }}>Enregistrer</Button>
        </div>
      </Modal>

      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="Journal de reconnaissance">
        <GratitudeJournal topics={answeredAll} />
      </Modal>

      {praying && <PrayTogether topics={[...enCours, ...recognition]} onAnswer={answer} onClose={() => setPraying(false)} />}
    </div>
  );
};

// ─── Journal : une frise des prières exaucées ────────────────
const GratitudeJournal: React.FC<{ topics: PrayerTopic[] }> = ({ topics }) => {
  const groups = useMemo(() => {
    const sorted = [...topics].sort((a, b) => (b.answered_at || b.created_at).localeCompare(a.answered_at || a.created_at));
    const map = new Map<string, PrayerTopic[]>();
    sorted.forEach((t) => {
      const key = monthLabel(t.answered_at || t.created_at);
      map.set(key, [...(map.get(key) || []), t]);
    });
    return [...map.entries()];
  }, [topics]);

  return (
    <div className="timeline">
      {groups.map(([month, items]) => (
        <section key={month}>
          <h3 className="timeline-month">{month}</h3>
          {items.map((t) => (
            <div key={t.id} className="timeline-item">
              <span className="timeline-dot" style={{ background: CONTEXT.priere }} />
              <p className="item-title">{t.title}</p>
              <p className="item-meta">
                {t.answered_at ? `Exaucé le ${formatDate(t.answered_at)}` : formatDate(t.created_at)}
                {t.answered_at && t.created_at < t.answered_at ? `, porté pendant ${durationBetween(t.created_at, t.answered_at)}` : ''}
                {t.answered_by ? `. Coché par ${t.answered_by}.` : ''}
              </p>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
};

// ─── Prier ensemble : plein écran, un sujet à la fois ────────
const PrayTogether: React.FC<{ topics: PrayerTopic[]; onAnswer: (t: PrayerTopic) => void; onClose: () => void }> = ({ topics, onAnswer, onClose }) => {
  const [order] = useState(() => [...shuffle(topics.filter((t) => t.category === 'toport')), ...shuffle(topics.filter((t) => t.category !== 'toport'))]);
  const [i, setI] = useState(0);
  const done = i >= order.length;
  const topic = order[i];

  return (
    <div className="pray-screen" role="dialog" aria-modal="true">
      <div className="pray-top">
        <span className="muted">{done ? '' : `${i + 1} sur ${order.length}`}</span>
        <button className="link-btn" style={{ color: 'inherit' }} onClick={onClose}>Fermer</button>
      </div>
      <div className="pray-center">
        {done ? (
          <>
            <p className="pray-title">Amen.</p>
            <p className="pray-sub">Merci d'avoir pris ce temps ensemble.</p>
          </>
        ) : (
          <>
            <p className="pray-kind">{topic.category === 'toport' ? 'Nous te confions' : 'Merci pour'}</p>
            <p className="pray-title">{topic.title}</p>
            {topic.description && <p className="pray-sub">{topic.description}</p>}
            {topic.category === 'toport' && <p className="pray-sub">Porté depuis {durationBetween(topic.created_at, new Date().toISOString())}</p>}
          </>
        )}
      </div>
      <div className="pray-actions">
        {done ? (
          <Button full onClick={onClose}>Terminer</Button>
        ) : (
          <>
            {topic.category === 'toport' && (
              <Button variant="secondary" full onClick={() => { onAnswer(topic); setI(i + 1); }}>Exaucé</Button>
            )}
            <Button full onClick={() => setI(i + 1)}>{i + 1 === order.length ? 'Conclure' : 'Suivant'}</Button>
          </>
        )}
      </div>
    </div>
  );
};
