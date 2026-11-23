import React, { useEffect, useState } from 'react';
import { Plus, Check, Trash2, Pencil, MoreHorizontal, ChevronDown, Moon, CalendarDays } from 'lucide-react';
import { useBucketStore } from '../stores/bucketStore';
import { useMemoryStore } from '../stores/memoryStore';
import { Card, Button, Modal, ErrorBanner, Spinner, ActionSheet } from '../components/UI';
import { SwipeRow } from '../components/Feedback';
import { AuthorTag } from '../components/AuthorTag';
import { showUndo } from '../stores/undoStore';
import { BucketItem, Memory } from '../types';
import { formatDate } from '../services/time';
import { CONTEXT } from '../theme';

interface EnviesPageProps {
  onCreateMemoryFor?: (item: BucketItem) => void;
}

type Filter = 'tout' | 'ce_soir' | 'plus_tard';
const TIMING_LABEL = { ce_soir: 'Bientôt', plus_tard: 'Un jour' } as const;

export const EnviesPage: React.FC<EnviesPageProps> = ({ onCreateMemoryFor }) => {
  const { items, loading, error, loadItems, addItem, toggleComplete, updateTitle, deleteItem, restoreItem } = useBucketStore();
  const memories = useMemoryStore((s) => s.memories);
  const [filter, setFilter] = useState<Filter>('tout');
  const [newTitle, setNewTitle] = useState('');
  const [newTiming, setNewTiming] = useState<'ce_soir' | 'plus_tard'>('plus_tard');
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [actionItem, setActionItem] = useState<BucketItem | null>(null);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);
  const [editItem, setEditItem] = useState<BucketItem | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const memoryFor = (id: string) => memories.find((m) => m.source === 'bucket' && m.source_id === id);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addItem(newTitle.trim(), newTiming);
    setNewTitle('');
    setShowAdd(false);
  };

  const toggle = async (item: BucketItem) => {
    await toggleComplete(item.id);
    showUndo(item.completed ? 'Remise dans la liste.' : 'Bravo, envie réalisée !', () => restoreItem(item));
  };
  const remove = async (item: BucketItem) => {
    await deleteItem(item.id);
    showUndo('Envie supprimée.', () => restoreItem(item));
  };
  const saveEdit = async () => {
    if (!editItem || !editTitle.trim()) return;
    await updateTitle(editItem.id, editTitle.trim());
    setEditItem(null);
  };

  const pending = items.filter((i) => !i.completed && (filter === 'tout' || i.timing === filter));
  const done = items
    .filter((i) => i.completed)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  const counts = {
    tout: items.filter((i) => !i.completed).length,
    ce_soir: items.filter((i) => !i.completed && i.timing === 'ce_soir').length,
    plus_tard: items.filter((i) => !i.completed && i.timing === 'plus_tard').length,
  };

  return (
    <div className="stack page">
      {error && <ErrorBanner message={error} />}

      {showAdd ? (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="field"
            type="text"
            placeholder="Une envie..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="segmented">
            <button className={newTiming === 'ce_soir' ? 'on' : ''} onClick={() => setNewTiming('ce_soir')}>Bientôt</button>
            <button className={newTiming === 'plus_tard' ? 'on' : ''} onClick={() => setNewTiming('plus_tard')}>Un jour</button>
          </div>
          <div className="row">
            <Button variant="secondary" full onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button full onClick={handleAdd} style={{ background: CONTEXT.envies, color: '#FBF6EE' }}>Ajouter</Button>
          </div>
        </Card>
      ) : (
        <button className="add-line" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Une envie ?
        </button>
      )}

      {counts.tout > 0 && (
        <div className="filters" role="tablist">
          {(['tout', 'ce_soir', 'plus_tard'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'tout' ? 'Tout' : TIMING_LABEL[f]} <span className="count">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {loading && items.length === 0 ? (
        <Spinner />
      ) : (
        <>
          <section className="stack-sm">
            {pending.map((item) => (
              <SwipeRow key={item.id} onSwipeRight={() => toggle(item)} rightLabel="Fait !" rightColor={CONTEXT.envies} onSwipeLeft={() => setActionItem(item)}>
                <div className="item">
                  <button className="check" style={{ borderColor: CONTEXT.envies }} onClick={() => toggle(item)} aria-label="Marquer comme réalisée" />
                  <div className="item-body">
                    <p className="item-title">{item.title}</p>
                    <p className="item-meta">
                      {item.timing === 'ce_soir' ? <Moon size={12} /> : <CalendarDays size={12} />} {TIMING_LABEL[item.timing]}
                      <AuthorTag author={item.author} inline />
                    </p>
                  </div>
                  <button className="icon-btn" onClick={() => setActionItem(item)} aria-label="Options"><MoreHorizontal size={18} /></button>
                </div>
              </SwipeRow>
            ))}
            {pending.length === 0 && counts.tout > 0 && <p className="empty">Rien dans cette catégorie pour l'instant.</p>}
          </section>

          {items.length === 0 && (
            <p className="empty">Une petite idée aujourd'hui peut devenir un bel instant demain. Glissez une envie vers la droite quand elle est réalisée.</p>
          )}

          {done.length > 0 && (
            <section className="stack-sm">
              <button className="section-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                <span>Réalisées ({done.length})</span>
                <ChevronDown size={18} style={{ transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showDone &&
                done.map((item) => {
                  const linked = memoryFor(item.id);
                  return (
                    <SwipeRow key={item.id} onSwipeLeft={() => setActionItem(item)}>
                      <div className="item faded">
                        <button className="check done" style={{ background: CONTEXT.envies, borderColor: CONTEXT.envies }} onClick={() => toggle(item)} aria-label="Remettre dans la liste">
                          <Check size={13} />
                        </button>
                        <div className="item-body">
                          <p className="item-title">{item.title}</p>
                          <p className="item-meta">
                            {item.completed_at ? `Le ${formatDate(item.completed_at)}` : 'Réalisée'}
                            {item.completed_by ? `, coché par ${item.completed_by}` : ''}
                          </p>
                          {linked ? (
                            <button className="link-btn" style={{ color: CONTEXT.envies, padding: '4px 0', textAlign: 'left' }} onClick={() => setViewingMemory(linked)}>
                              Voir l'instant
                            </button>
                          ) : (
                            onCreateMemoryFor && (
                              <button className="link-btn" style={{ color: CONTEXT.envies, padding: '4px 0', textAlign: 'left' }} onClick={() => onCreateMemoryFor(item)}>
                                + Garder cet instant
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </SwipeRow>
                  );
                })}
            </section>
          )}
        </>
      )}

      <ActionSheet
        isOpen={!!actionItem}
        onClose={() => setActionItem(null)}
        items={
          actionItem
            ? [
                { key: 'edit', icon: <Pencil size={16} />, label: 'Modifier', onClick: () => { setEditItem(actionItem); setEditTitle(actionItem.title); } },
                { key: 'toggle', icon: <Check size={16} />, label: actionItem.completed ? 'Remettre dans la liste' : 'Réalisée', onClick: () => toggle(actionItem) },
                { key: 'delete', icon: <Trash2 size={16} color="var(--rust)" />, label: 'Supprimer', danger: true, onClick: () => remove(actionItem) },
              ]
            : []
        }
      />

      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Modifier l'envie">
        <div className="stack">
          <input className="field" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
          <Button full onClick={saveEdit} style={{ background: CONTEXT.envies, color: '#FBF6EE' }}>Enregistrer</Button>
        </div>
      </Modal>

      <Modal isOpen={!!viewingMemory} onClose={() => setViewingMemory(null)} title="Instant">
        {viewingMemory && (
          <div className="stack">
            {viewingMemory.photo_url && <img src={viewingMemory.photo_url} alt="" style={{ width: '100%', maxHeight: 280, borderRadius: 'var(--radius)', objectFit: 'cover' }} />}
            <p className="muted">{viewingMemory.poetic || formatDate(viewingMemory.date)}</p>
            <p className="ink" style={{ fontSize: 17, lineHeight: 1.5, margin: 0 }}>{viewingMemory.text}</p>
            {viewingMemory.location && <p className="muted">{viewingMemory.location}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};
