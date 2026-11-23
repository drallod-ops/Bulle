import React, { useEffect, useState } from 'react';
import { Modal, Button } from './UI';
import { useBucketStore } from '../stores/bucketStore';
import { usePrayerStore } from '../stores/prayerStore';
import { showUndo } from '../stores/undoStore';
import { CONTEXT } from '../theme';

type Kind = 'instant' | 'envie' | 'priere';

/** Le bouton + : noter une idée au vol, depuis n'importe quel onglet. */
export const QuickAdd: React.FC<{ isOpen: boolean; onClose: () => void; onInstant: () => void; defaultKind: Kind }> = ({
  isOpen, onClose, onInstant, defaultKind,
}) => {
  const addItem = useBucketStore((s) => s.addItem);
  const addTopic = usePrayerStore((s) => s.addToPortTopic);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [text, setText] = useState('');
  const [timing, setTiming] = useState<'ce_soir' | 'plus_tard'>('plus_tard');

  useEffect(() => {
    if (isOpen) {
      setKind(defaultKind === 'instant' ? 'envie' : defaultKind);
      setText('');
    }
  }, [isOpen, defaultKind]);

  const save = async () => {
    if (!text.trim()) return;
    if (kind === 'envie') await addItem(text.trim(), timing);
    else await addTopic(text.trim());
    showUndo(kind === 'envie' ? 'Envie ajoutée.' : 'Sujet de prière ajouté.');
    onClose();
  };

  const color = kind === 'priere' ? CONTEXT.priere : CONTEXT.envies;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter">
      <div className="stack">
        <div className="segmented">
          <button className={kind === 'envie' ? 'on' : ''} onClick={() => setKind('envie')}>Une envie</button>
          <button className={kind === 'priere' ? 'on' : ''} onClick={() => setKind('priere')}>Une prière</button>
          <button onClick={onInstant}>Un instant</button>
        </div>
        <input
          className="field"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={kind === 'envie' ? 'Une idée de chose à faire…' : 'Pour quoi voulez-vous prier ?'}
          autoFocus
        />
        {kind === 'envie' && (
          <div className="segmented">
            <button className={timing === 'ce_soir' ? 'on' : ''} onClick={() => setTiming('ce_soir')}>Bientôt</button>
            <button className={timing === 'plus_tard' ? 'on' : ''} onClick={() => setTiming('plus_tard')}>Un jour</button>
          </div>
        )}
        <Button full disabled={!text.trim()} onClick={save} style={{ background: color, color: '#FBF6EE' }}>Ajouter</Button>
      </div>
    </Modal>
  );
};
