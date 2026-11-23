import React, { useEffect, useState } from 'react';
import { Button, Modal } from './UI';
import { config, refresh, testConnection, onSyncChange, flush, type SyncState } from '../services/api';
import { getPlayers, setPlayers } from '../services/settings';
import { CloudOff, RefreshCw } from 'lucide-react';

// ─── Premier lancement sur un téléphone ──────────────────────
export const SetupScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState<'code' | 'names' | 'me'>(config.secret() && config.apiUrl() ? 'me' : 'code');
  const [url, setUrl] = useState(config.apiUrl());
  const [code, setCode] = useState('');
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [players, setPlayersState] = useState<[string, string] | null>(getPlayers());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'me' && !players) setStep('names');
  }, [step, players]);

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await testConnection(url.trim(), code.trim());
      if (!config.hasBuiltInUrl()) config.setApiUrl(url.trim());
      config.setSecret(code.trim());
      await refresh();
      const p = getPlayers();
      setPlayersState(p);
      setStep(p ? 'me' : 'names');
    } catch (e: any) {
      setError(e?.message || 'Connexion impossible.');
    }
    setBusy(false);
  };

  const submitNames = () => {
    const clean: [string, string] = [names[0].trim(), names[1].trim()];
    if (!clean[0] || !clean[1] || clean[0] === clean[1]) {
      setError('Indiquez deux prénoms différents.');
      return;
    }
    setPlayers(clean);
    setPlayersState(clean);
    setError(null);
    setStep('me');
  };

  return (
    <div className="setup">
      <h1>Bulle</h1>
      {step === 'code' && (
        <>
          <p className="muted">Entrez le code secret que vous avez choisi tous les deux. Il ne sera demandé qu'une fois sur ce téléphone.</p>
          {!config.hasBuiltInUrl() && (
            <div>
              <label htmlFor="api-url">Adresse de l'Apps Script</label>
              <input id="api-url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" inputMode="url" autoComplete="off" />
            </div>
          )}
          <div>
            <label htmlFor="secret">Code secret</label>
            <input id="secret" className="field" type="password" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitCode()} autoFocus />
          </div>
          {error && <p className="error-text">{error}</p>}
          <Button full onClick={submitCode} disabled={busy || !code.trim() || !url.trim()}>
            {busy ? 'Vérification…' : 'Entrer'}
          </Button>
        </>
      )}

      {step === 'names' && (
        <>
          <p className="muted">Vos deux prénoms, pour l'historique et les scores des jeux.</p>
          <input className="field" placeholder="Premier prénom" value={names[0]} onChange={(e) => setNames([e.target.value, names[1]])} autoFocus />
          <input className="field" placeholder="Second prénom" value={names[1]} onChange={(e) => setNames([names[0], e.target.value])} />
          {error && <p className="error-text">{error}</p>}
          <Button full onClick={submitNames}>Continuer</Button>
        </>
      )}

      {step === 'me' && players && (
        <>
          <p className="muted">Qui utilise ce téléphone ?</p>
          <div className="row">
            {players.map((p) => (
              <button key={p} className="choice" onClick={() => { config.setMe(p); onDone(); }}>{p}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Réglages du compte ──────────────────────────────────────
export const AccountModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogout: () => void }> = ({ isOpen, onClose, onLogout }) => {
  const players = getPlayers() || ['', ''];
  const [names, setNames] = useState<[string, string]>([players[0], players[1]]);
  const [me, setMeState] = useState(config.me());

  useEffect(() => {
    if (isOpen) {
      const p = getPlayers() || ['', ''];
      setNames([p[0], p[1]]);
      setMeState(config.me());
    }
  }, [isOpen]);

  const save = () => {
    const clean: [string, string] = [names[0].trim(), names[1].trim()];
    if (clean[0] && clean[1] && clean[0] !== clean[1]) {
      const old = getPlayers();
      setPlayers(clean);
      // Si on renomme la personne de ce téléphone, on suit le changement.
      if (old) {
        const idx = old.indexOf(me);
        config.setMe(idx >= 0 ? clean[idx] : me);
      }
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vous deux">
      <div className="stack">
        <div className="stack-sm">
          <label className="muted small">Prénoms</label>
          <input className="field" value={names[0]} onChange={(e) => setNames([e.target.value, names[1]])} />
          <input className="field" value={names[1]} onChange={(e) => setNames([names[0], e.target.value])} />
        </div>
        <div className="stack-sm">
          <label className="muted small">Ce téléphone est celui de</label>
          <div className="row">
            {(getPlayers() || []).map((p) => (
              <button key={p} className={`choice${me === p ? ' selected' : ''}`} onClick={() => { config.setMe(p); setMeState(p); }}>{p}</button>
            ))}
          </div>
        </div>
        <Button full onClick={save}>Enregistrer</Button>
        <button className="link-btn quiet" onClick={() => { config.logout(); onLogout(); }}>
          Se déconnecter de ce téléphone
        </button>
      </div>
    </Modal>
  );
};

// ─── Indicateur de synchro (en-tête) ─────────────────────────
export const SyncBadge: React.FC = () => {
  const [state, setState] = useState<SyncState>({ status: 'idle', pending: 0 });
  useEffect(() => onSyncChange(setState), []);

  if (state.status === 'idle' && state.pending === 0) return null;
  const label =
    state.status === 'offline'
      ? `Hors ligne${state.pending ? `, ${state.pending} en attente` : ''}`
      : state.status === 'error'
      ? `Pas encore enregistré (${state.pending})`
      : 'Enregistrement…';

  return (
    <button
      className={`sync-badge${state.status === 'error' ? ' error' : ''}`}
      onClick={() => flush()}
      title={state.message || 'Réessayer maintenant'}
    >
      {state.status === 'offline' ? <CloudOff size={12} /> : <RefreshCw size={12} />}
      {label}
    </button>
  );
};
