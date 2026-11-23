import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Shuffle, Trophy, X, Brain, Eye, Users, CalendarClock, Split, Timer, HelpCircle, Target } from 'lucide-react';
import { Card, Button, Modal } from '../components/UI';
import { useMemoryStore } from '../stores/memoryStore';
import { useBucketStore } from '../stores/bucketStore';
import { usePrayerStore } from '../stores/prayerStore';
import { useGameStore } from '../stores/gameStore';
import { useCustomContentStore } from '../stores/customContentStore';
import {
  DEFAULT_GAMES,
  JE_PENSE_ITEMS,
  JE_PENSE_GUIDING_QUESTIONS,
  QUI_CONNAIT_THEMES,
  ET_SI_QUESTIONS,
  DEFIS,
  TU_PREFERES,
  CHRONO_MOTS,
  type SessionResult,
} from '../services/adeuxContent';
import { pickRandom, pickFresh, shuffle } from '../services/random';
import { playersOrDefault } from '../services/settings';
import type { GameSession, Memory } from '../types';
import { CONTEXT } from '../theme';

type Prefill = { text: string; source_id: string };
type FinishFn = (summary?: string, result?: SessionResult) => void;
interface ExperienceProps {
  onFinish: FinishFn;
  onCreateMemoryFor?: (prefill: Prefill) => void;
}

// Import explicite des icônes : « import * as Icons » embarquait toute la
// bibliothèque (plus de 700 ko) dans la page des jeux.
const ICONS: Record<string, LucideIcon> = { Brain, Eye, Users, CalendarClock, Split, Timer, HelpCircle, Target, Shuffle };
const getIcon = (name: string): LucideIcon => ICONS[name] || Users;

const gameName = (id: string) => DEFAULT_GAMES.find((g) => g.id === id)?.name || id;

// ─── Page ─────────────────────────────────────────────────────
export const AdeuxPage: React.FC<{ onCreateMemoryFor?: (prefill: Prefill) => void }> = ({ onCreateMemoryFor }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const logSession = useGameStore((s) => s.logSession);

  return (
    <div className="stack" style={{ paddingBottom: 80 }}>
      <p className="muted">Jouez pour le plaisir, ou comptez les points : tout est gardé dans votre historique.</p>

      <div className="row">
        <Button
          full
          style={{ background: CONTEXT.adeux, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setActiveId(pickRandom(DEFAULT_GAMES.map((g) => g.id)))}
        >
          <Shuffle size={16} />
          Jeu surprise
        </Button>
        <Button variant="secondary" onClick={() => setShowBoard(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={16} />
          Scores
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DEFAULT_GAMES.map((game) => {
          const Icon = getIcon(game.icon);
          return (
            <Card key={game.id} onClick={() => setActiveId(game.id)} style={{ display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `color-mix(in srgb, ${CONTEXT.adeux} 14%, transparent)`, color: CONTEXT.adeux,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={18} />
                </span>
                {game.scored && <span className="chip">{game.scored === 'coop' ? 'Ensemble' : 'Points'}</span>}
              </div>
              <div>
                <p className="ink" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{game.name}</p>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.35 }}>{game.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <ExperienceModal
        activeId={activeId}
        onClose={() => setActiveId(null)}
        onDone={(summary, result) => {
          if (activeId) logSession(activeId, summary, result);
        }}
        onCreateMemoryFor={onCreateMemoryFor}
      />

      <Modal isOpen={showBoard} onClose={() => setShowBoard(false)} title="Tableau des scores">
        <Scoreboard />
      </Modal>
    </div>
  );
};

// ─── Tableau des scores ──────────────────────────────────────
const Scoreboard: React.FC = () => {
  const sessions = useGameStore((s) => s.sessions);
  const deleteSession = useGameStore((s) => s.deleteSession);
  const [p1, p2] = playersOrDefault();

  const stats = useMemo(() => {
    const versus = sessions.filter((s) => s.mode === 'versus' && s.scores);
    const wins = { [p1]: 0, [p2]: 0, egalite: 0 } as Record<string, number>;
    versus.forEach((s) => {
      if (s.winner === 'égalité') wins.egalite++;
      else if (s.winner && s.winner in wins) wins[s.winner]++;
    });
    const coop = sessions.filter((s) => s.mode === 'coop' && s.scores);
    const bestCoop = coop.reduce((best, s) => Math.max(best, s.scores?.ensemble ?? 0), 0);
    // Série en cours : victoires consécutives du dernier vainqueur.
    let streak = 0;
    let streakOwner = '';
    for (const s of versus) {
      if (!s.winner || s.winner === 'égalité') break;
      if (!streakOwner) streakOwner = s.winner;
      if (s.winner !== streakOwner) break;
      streak++;
    }
    const perGame = DEFAULT_GAMES.map((g) => ({ id: g.id, name: g.name, count: sessions.filter((s) => s.game_id === g.id).length }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);
    return { wins, bestCoop, streak, streakOwner, perGame, total: sessions.length };
  }, [sessions, p1, p2]);

  if (sessions.length === 0) {
    return <p className="muted">Aucune partie pour l'instant. Lancez un jeu, et vos résultats apparaîtront ici.</p>;
  }

  return (
    <div className="stack">
      <div className="board">
        <div className="board-cell"><span className="big">{stats.wins[p1]}</span><span className="label">victoires de {p1}</span></div>
        <div className="board-cell"><span className="big">{stats.wins[p2]}</span><span className="label">victoires de {p2}</span></div>
        <div className="board-cell"><span className="big">{stats.total}</span><span className="label">parties jouées</span></div>
        <div className="board-cell"><span className="big">{stats.bestCoop}</span><span className="label">record « en phase »</span></div>
      </div>
      {stats.streak >= 2 && (
        <p className="muted">{stats.streakOwner} enchaîne {stats.streak} victoires d'affilée.</p>
      )}
      {stats.perGame.length > 0 && (
        <div className="row wrap">
          {stats.perGame.map((g) => <span key={g.id} className="chip">{g.name} : {g.count}</span>)}
        </div>
      )}
      <div>
        {sessions.slice(0, 30).map((s) => <HistoryItem key={s.id} session={s} onDelete={() => deleteSession(s.id)} />)}
      </div>
    </div>
  );
};

const HistoryItem: React.FC<{ session: GameSession; onDelete: () => void }> = ({ session, onDelete }) => {
  const date = new Date(session.played_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const scores = session.scores
    ? session.mode === 'coop'
      ? `${session.scores.ensemble ?? 0} en phase`
      : Object.entries(session.scores).map(([k, v]) => `${k} ${v}`).join(', ')
    : null;
  return (
    <div className="history-item">
      <div style={{ flex: 1 }}>
        <div>{gameName(session.game_id)}{session.winner && session.winner !== 'égalité' ? `, gagné par ${session.winner}` : session.winner === 'égalité' ? ', égalité' : ''}</div>
        <div className="meta">{date}{scores ? `, ${scores}` : ''}</div>
      </div>
      <button className="icon-btn" onClick={onDelete} aria-label="Supprimer cette partie"><X size={14} /></button>
    </div>
  );
};

// ─── Briques communes ────────────────────────────────────────
const ExperienceModal: React.FC<{
  activeId: string | null;
  onClose: () => void;
  onDone: FinishFn;
  onCreateMemoryFor?: (prefill: Prefill) => void;
}> = ({ activeId, onClose, onDone, onCreateMemoryFor }) => {
  const game = DEFAULT_GAMES.find((g) => g.id === activeId) || null;
  const finish: FinishFn = (summary, result) => {
    onDone(summary, result);
    onClose();
  };
  const props = { onFinish: finish, onCreateMemoryFor };
  return (
    <Modal isOpen={!!game} onClose={onClose} title={game?.name}>
      {activeId === 'je-pense' && <JePenseExperience {...props} />}
      {activeId === 'photo-mystere' && <PhotoMystereExperience {...props} />}
      {activeId === 'qui-connait-mieux' && <QuiConnaitExperience {...props} />}
      {activeId === 'chronologie' && <ChronologieExperience {...props} />}
      {activeId === 'tu-preferes' && <TuPreferesExperience {...props} />}
      {activeId === 'chrono-mots' && <ChronoMotsExperience {...props} />}
      {activeId === 'et-si' && <EtSiExperience {...props} />}
      {activeId === 'le-hasard' && <LeHasardExperience {...props} />}
      {activeId === 'defis' && <DefisExperience {...props} />}
    </Modal>
  );
};

function useScores() {
  const players = playersOrDefault();
  const [scores, setScores] = useState<Record<string, number>>({ [players[0]]: 0, [players[1]]: 0 });
  const add = (player: string, pts = 1) => setScores((s) => ({ ...s, [player]: (s[player] || 0) + pts }));
  const hasPoints = Object.values(scores).some((v) => v > 0);
  return { players, scores, add, hasPoints };
}

const ScoreStrip: React.FC<{ scores: Record<string, number>; turn?: string }> = ({ scores, turn }) => (
  <div className="score-strip">
    {Object.entries(scores).map(([name, pts]) => (
      <div key={name} className={`score-cell${turn === name ? ' turn' : ''}`}>
        <span className="name">{name}</span>
        <span className="pts">{pts}</span>
      </div>
    ))}
  </div>
);

const KeepMoment: React.FC<{ onCreateMemoryFor?: (p: Prefill) => void; prefill: Prefill }> = ({ onCreateMemoryFor, prefill }) =>
  onCreateMemoryFor ? (
    <button className="link-btn" onClick={() => onCreateMemoryFor(prefill)}>Garder cet instant</button>
  ) : null;

const Empty: React.FC<{ text: string; onClose: () => void }> = ({ text, onClose }) => (
  <div className="stack">
    <p className="muted" style={{ fontSize: 14 }}>{text}</p>
    <Button full onClick={onClose}>Fermer</Button>
  </div>
);

// ─── Je pense à... (versus) ──────────────────────────────────
const JePenseExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const { players, scores, add, hasPoints } = useScores();
  const [round, setRound] = useState(0);
  const [item, setItem] = useState(() => pickFresh('je-pense', JE_PENSE_ITEMS)!);
  const [visible, setVisible] = useState(false);
  const [questions, setQuestions] = useState(0);
  const thinker = players[round % 2];
  const guesser = players[(round + 1) % 2];
  const hints = useMemo(() => shuffle(JE_PENSE_GUIDING_QUESTIONS).slice(0, 3), [item]);
  const points = Math.max(1, 10 - questions);

  const next = () => {
    setRound((r) => r + 1);
    setItem(pickFresh('je-pense', JE_PENSE_ITEMS)!);
    setVisible(false);
    setQuestions(0);
  };

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={guesser} />
      <p className="muted">
        {thinker} regarde le sujet en secret. {guesser} pose des questions fermées (oui ou non). Moins il en faut, plus ça rapporte.
      </p>
      {visible ? (
        <button className="prompt-box big" onClick={() => setVisible(false)} style={{ border: 'none', cursor: 'pointer' }}>{item}</button>
      ) : (
        <Button variant="secondary" full onClick={() => setVisible(true)}>Afficher le sujet pour {thinker}</Button>
      )}
      <div className="row wrap">{hints.map((h) => <span key={h} className="chip">{h}</span>)}</div>
      <div className="row">
        <Button variant="secondary" full onClick={() => setQuestions((q) => q + 1)}>Question posée ({questions})</Button>
        <Button full style={{ background: CONTEXT.adeux }} onClick={() => { add(guesser, points); next(); }}>
          Trouvé ! (+{points})
        </Button>
      </div>
      <div className="row">
        <button className="link-btn quiet grow" onClick={next}>Passer ce sujet</button>
        <button className="link-btn grow" onClick={() => onFinish(`Je pense à... (${round} manches)`, hasPoints ? { scores } : undefined)}>
          Terminer la partie
        </button>
      </div>
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `« Je pense à... » ${item}`, source_id: 'je-pense' }} />
    </div>
  );
};

// ─── Photo Mystère (versus, dévoilement progressif) ──────────
const BLUR_LEVELS = [28, 16, 8, 0];

const PhotoMystereExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const allMemories = useMemoryStore((s) => s.memories);
  const withPhoto = useMemo(() => allMemories.filter((m) => !!m.photo_url), [allMemories]);
  const { players, scores, add, hasPoints } = useScores();
  const [pick, setPick] = useState<Memory | null>(() => pickRandom(withPhoto));
  const [level, setLevel] = useState(0);
  const [found, setFound] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  if (withPhoto.length < 3) {
    return <Empty text="Il faut au moins 3 instants avec photo pour jouer. Ajoutez-en quelques-uns, puis revenez." onClose={() => onFinish()} />;
  }
  const revealed = found !== null || level === BLUR_LEVELS.length - 1;
  const points = BLUR_LEVELS.length - 1 - level; // 3, 2, 1, puis 0 à découvert

  const next = () => {
    const nextSeen = pick ? [...seen, pick.id] : seen;
    const pool = withPhoto.filter((m) => !nextSeen.includes(m.id));
    setSeen(pool.length ? nextSeen : []);
    setPick(pickRandom(pool.length ? pool : withPhoto));
    setLevel(0);
    setFound(null);
  };

  return (
    <div className="stack">
      <ScoreStrip scores={scores} />
      {pick && (
        <>
          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <img
              src={pick.photo_url}
              alt=""
              style={{
                width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block',
                filter: revealed ? 'none' : `blur(${BLUR_LEVELS[level]}px)`,
                transform: revealed ? 'none' : 'scale(1.1)',
                transition: 'filter 0.5s ease-out, transform 0.5s ease-out',
              }}
            />
          </div>
          {revealed ? (
            <div className="stack-sm">
              <p className="ink" style={{ fontSize: 14, margin: 0, lineHeight: 1.4 }}>{pick.text}</p>
              <p className="muted small">
                {new Date(pick.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {pick.location ? `, ${pick.location}` : ''}
                {found ? `. Reconnue par ${found}.` : ''}
              </p>
              <div className="row">
                <Button variant="secondary" full onClick={next}>Photo suivante</Button>
                <Button full style={{ background: CONTEXT.adeux }} onClick={() => onFinish('Photo Mystère', hasPoints ? { scores } : undefined)}>Terminer</Button>
              </div>
              <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `Redécouvert : ${pick.text}`, source_id: 'photo-mystere' }} />
            </div>
          ) : (
            <div className="stack-sm">
              <p className="muted">Qui reconnaît ce moment ? Il vaut {points} point{points > 1 ? 's' : ''}.</p>
              <div className="row">
                {players.map((p) => (
                  <button key={p} className="choice" onClick={() => { add(p, points); setFound(p); }}>{p} l'a trouvé</button>
                ))}
              </div>
              <Button variant="secondary" full onClick={() => setLevel((l) => l + 1)}>Rendre plus net</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── À propos de toi (points en option) ──────────────────────
const QuiConnaitExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const customQuestions = useCustomContentStore((s) => s.questions);
  const addQuestion = useCustomContentStore((s) => s.addQuestion);
  const themes = Object.keys(QUI_CONNAIT_THEMES);
  const { players, scores, add, hasPoints } = useScores();
  const [scoring, setScoring] = useState(false);
  const [count, setCount] = useState(0);

  const pool = (theme: string) => [
    ...QUI_CONNAIT_THEMES[theme],
    ...customQuestions.filter((q) => q.theme === theme).map((q) => q.question),
  ];
  const draw = () => {
    const theme = pickRandom(themes)!;
    return { theme, question: pickFresh(`qui-${theme}`, pool(theme))! };
  };
  const [current, setCurrent] = useState(draw);
  const [showAdd, setShowAdd] = useState(false);
  const [newTheme, setNewTheme] = useState(themes[0]);
  const [newQuestion, setNewQuestion] = useState('');

  const nextQuestion = () => { setCurrent(draw()); setCount((c) => c + 1); };
  const handleAdd = async () => {
    if (!newQuestion.trim()) return;
    await addQuestion(newTheme, newQuestion.trim());
    setNewQuestion('');
    setShowAdd(false);
  };

  return (
    <div className="stack">
      {scoring && <ScoreStrip scores={scores} />}
      <span className="chip-accent">{current.theme}</span>
      <p className="prompt-box">{current.question}</p>
      <p className="muted small">
        {scoring
          ? "Chacun écrit sa réponse et devine celle de l'autre. Puis indiquez qui a vu juste."
          : 'Chacun répond en secret, puis vous comparez.'}
      </p>
      {scoring ? (
        <div className="stack-sm">
          <div className="row">
            {players.map((p) => (
              <button key={p} className="choice" onClick={() => { add(p); nextQuestion(); }}>{p} a deviné</button>
            ))}
          </div>
          <div className="row">
            <button className="choice" onClick={() => { players.forEach((p) => add(p)); nextQuestion(); }}>Les deux</button>
            <button className="choice" onClick={nextQuestion}>Personne</button>
          </div>
        </div>
      ) : (
        <Button full variant="secondary" onClick={nextQuestion}>Nouvelle question</Button>
      )}
      <div className="row">
        <button className="link-btn quiet grow" onClick={() => setScoring((s) => !s)}>
          {scoring ? 'Arrêter de compter' : 'Compter les points'}
        </button>
        <button className="link-btn grow" onClick={() => onFinish(`À propos de toi (${count + 1} questions)`, scoring && hasPoints ? { scores } : undefined)}>
          Terminer
        </button>
      </div>
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `« ${current.question} »`, source_id: 'qui-connait-mieux' }} />

      {showAdd ? (
        <div className="stack-sm divider">
          <select className="field" value={newTheme} onChange={(e) => setNewTheme(e.target.value)}>
            {themes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="field" type="text" placeholder="Votre question..." value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
          <Button size="sm" onClick={handleAdd} style={{ background: CONTEXT.adeux }}>Ajouter à la banque</Button>
        </div>
      ) : (
        <button className="link-btn quiet" onClick={() => setShowAdd(true)}>+ Ajouter votre propre question</button>
      )}
    </div>
  );
};

// ─── Chronologie (nouveau, versus) ───────────────────────────
const dayOf = (m: Memory) => (m.date || m.created_at || '').slice(0, 10);

const ChronologieExperience: React.FC<ExperienceProps> = ({ onFinish }) => {
  const memories = useMemoryStore((s) => s.memories);
  const dated = useMemo(() => memories.filter((m) => dayOf(m)), [memories]);
  const distinctDays = new Set(dated.map(dayOf)).size;
  const { players, scores, add, hasPoints } = useScores();
  const [round, setRound] = useState(0);
  const drawPair = (): [Memory, Memory] | null => {
    for (let i = 0; i < 30; i++) {
      const [a, b] = shuffle(dated);
      if (a && b && dayOf(a) !== dayOf(b)) return [a, b];
    }
    return null;
  };
  const [pair, setPair] = useState(drawPair);
  const [answer, setAnswer] = useState<string | null>(null);

  if (distinctDays < 4 || !pair) {
    return <Empty text="Il faut au moins 4 instants à des dates différentes pour jouer. Ajoutez-en quelques-uns, puis revenez." onClose={() => onFinish()} />;
  }
  const player = players[round % 2];
  const first = dayOf(pair[0]) < dayOf(pair[1]) ? pair[0].id : pair[1].id;
  const choose = (id: string) => {
    if (answer) return;
    setAnswer(id);
    if (id === first) add(player);
  };
  const next = () => { setRound((r) => r + 1); setPair(drawPair()); setAnswer(null); };
  const fmt = (m: Memory) => new Date(dayOf(m)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={player} />
      <p className="muted">À {player} : lequel de ces deux instants est arrivé en premier ?</p>
      {pair.map((m) => (
        <button
          key={m.id}
          className={`choice${answer ? (m.id === first ? ' good' : m.id === answer ? ' bad' : '') : ''}`}
          onClick={() => choose(m.id)}
          style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', fontWeight: 500 }}
        >
          {m.photo_url && <img src={m.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>
            {m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text}
            {answer && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{fmt(m)}</span>}
          </span>
        </button>
      ))}
      {answer && (
        <p className="ink center" style={{ margin: 0, fontWeight: 600 }}>
          {answer === first ? `Bien vu, +1 pour ${player}.` : 'Raté, c\u2019était l\u2019autre.'}
        </p>
      )}
      <div className="row">
        <Button variant="secondary" full onClick={next} disabled={!answer}>Manche suivante</Button>
        <Button full style={{ background: CONTEXT.adeux }} onClick={() => onFinish(`Chronologie (${round + (answer ? 1 : 0)} manches)`, hasPoints ? { scores } : undefined)}>
          Terminer
        </Button>
      </div>
    </div>
  );
};

// ─── Tu préfères... (nouveau, coopératif) ────────────────────
const TuPreferesExperience: React.FC<ExperienceProps> = ({ onFinish }) => {
  const players = playersOrDefault();
  const drawPair = () => {
    const line = pickFresh('tu-preferes', TU_PREFERES.map((p) => p.join(' | ')))!;
    return line.split(' | ') as [string, string];
  };
  const [pair, setPair] = useState(drawPair);
  const [step, setStep] = useState<'p1' | 'pass' | 'p2' | 'reveal'>('p1');
  const [choices, setChoices] = useState<[number | null, number | null]>([null, null]);
  const [rounds, setRounds] = useState(0);
  const [matches, setMatches] = useState(0);

  const pick = (i: number) => {
    if (step === 'p1') { setChoices([i, null]); setStep('pass'); }
    else if (step === 'p2') {
      setChoices(([a]) => [a, i]);
      setRounds((r) => r + 1);
      if (choices[0] === i) setMatches((m) => m + 1);
      setStep('reveal');
    }
  };
  const next = () => { setPair(drawPair()); setChoices([null, null]); setStep('p1'); };
  const finish = () =>
    onFinish(`Tu préfères... (${matches}/${rounds} en phase)`, rounds ? { mode: 'coop', scores: { ensemble: matches }, funFact: `${matches}/${rounds}` } : undefined);

  return (
    <div className="stack">
      <div className="score-strip">
        <div className="score-cell"><span className="name">En phase</span><span className="pts">{matches}/{rounds}</span></div>
      </div>
      {step === 'pass' ? (
        <div className="stack">
          <p className="prompt-box center">C'est noté. Passe le téléphone à {players[1]}, sans regarder.</p>
          <Button full style={{ background: CONTEXT.adeux }} onClick={() => setStep('p2')}>Je suis {players[1]}</Button>
        </div>
      ) : (
        <>
          <p className="muted">
            {step === 'p1' && `${players[0]} choisit en secret.`}
            {step === 'p2' && `${players[1]} choisit en secret.`}
            {step === 'reveal' && (choices[0] === choices[1] ? 'Même choix ! +1 pour vous deux.' : 'Pas le même choix. De quoi en discuter.')}
          </p>
          <div className="stack-sm">
            {pair.map((option, i) => {
              const who = step === 'reveal' ? players.filter((_, j) => choices[j] === i) : [];
              return (
                <button
                  key={option}
                  className={`choice${step === 'reveal' && who.length === 2 ? ' good' : ''}${step === 'reveal' && who.length === 1 ? ' selected' : ''}`}
                  onClick={() => pick(i)}
                  disabled={step === 'reveal'}
                >
                  {option}
                  {step === 'reveal' && who.length > 0 && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{who.join(' et ')}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="row">
        <Button variant="secondary" full onClick={next} disabled={step !== 'reveal'}>Question suivante</Button>
        <Button full style={{ background: CONTEXT.adeux }} onClick={finish}>Terminer</Button>
      </div>
    </div>
  );
};

// ─── Chrono-mots (nouveau, versus) ───────────────────────────
const TURN_SECONDS = 60;
const TURNS = 4; // deux tours chacun

const ChronoMotsExperience: React.FC<ExperienceProps> = ({ onFinish }) => {
  const { players, scores, add, hasPoints } = useScores();
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'running' | 'between' | 'done'>('ready');
  const [left, setLeft] = useState(TURN_SECONDS);
  const [word, setWord] = useState(() => pickFresh('chrono-mots', CHRONO_MOTS)!);
  const [turnScore, setTurnScore] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const player = players[turn % 2];

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    if (phase === 'running' && left <= 0) {
      if (timer.current) clearInterval(timer.current);
      setPhase(turn + 1 >= TURNS ? 'done' : 'between');
      if (navigator.vibrate) navigator.vibrate(300);
    }
  }, [left, phase, turn]);

  const start = () => {
    setLeft(TURN_SECONDS);
    setTurnScore(0);
    setWord(pickFresh('chrono-mots', CHRONO_MOTS)!);
    setPhase('running');
    timer.current = setInterval(() => setLeft((l) => l - 1), 1000);
  };
  const found = () => { add(player); setTurnScore((s) => s + 1); setWord(pickFresh('chrono-mots', CHRONO_MOTS)!); };
  const skip = () => setWord(pickFresh('chrono-mots', CHRONO_MOTS)!);

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={phase === 'done' ? undefined : player} />
      {phase === 'ready' && (
        <>
          <p className="muted">{player} fait deviner un maximum de mots en {TURN_SECONDS} secondes, sans les prononcer. Deux tours chacun.</p>
          <Button full style={{ background: CONTEXT.adeux }} onClick={start}>C'est parti pour {player}</Button>
        </>
      )}
      {phase === 'running' && (
        <>
          <p className={`timer${left <= 10 ? ' low' : ''}`}>{left}</p>
          <p className="prompt-box big">{word}</p>
          <div className="row">
            <Button variant="secondary" full onClick={skip}>Passer</Button>
            <Button full style={{ background: CONTEXT.adeux }} onClick={found}>Trouvé</Button>
          </div>
        </>
      )}
      {phase === 'between' && (
        <>
          <p className="prompt-box center">Temps écoulé : {turnScore} mot{turnScore > 1 ? 's' : ''} pour {players[turn % 2]}.</p>
          <Button full style={{ background: CONTEXT.adeux }} onClick={() => { setTurn((t) => t + 1); setPhase('ready'); }}>
            Au tour de {players[(turn + 1) % 2]}
          </Button>
        </>
      )}
      {phase === 'done' && (
        <p className="prompt-box center">Partie terminée : {players[0]} {scores[players[0]]}, {players[1]} {scores[players[1]]}.</p>
      )}
      {phase !== 'running' && (
        <button className="link-btn" onClick={() => onFinish('Chrono-mots', hasPoints ? { scores } : undefined)}>
          {phase === 'done' ? 'Enregistrer et fermer' : 'Terminer la partie'}
        </button>
      )}
    </div>
  );
};

// ─── Et si... ────────────────────────────────────────────────
const EtSiExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const [question, setQuestion] = useState(() => pickFresh('et-si', ET_SI_QUESTIONS)!);
  return (
    <div className="stack">
      <p className="prompt-box">{question}</p>
      <div className="row">
        <Button full variant="secondary" onClick={() => setQuestion(pickFresh('et-si', ET_SI_QUESTIONS)!)}>Nouvelle question</Button>
        <Button full style={{ background: CONTEXT.adeux }} onClick={() => onFinish(question)}>Terminé</Button>
      </div>
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: question, source_id: 'et-si' }} />
    </div>
  );
};

// ─── Défis ───────────────────────────────────────────────────
const DefisExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const customDefis = useCustomContentStore((s) => s.defis);
  const addDefi = useCustomContentStore((s) => s.addDefi);
  const pool = () => [...DEFIS, ...customDefis.map((d) => d.text)];
  const [defi, setDefi] = useState(() => pickFresh('defis', pool())!);
  const [showAdd, setShowAdd] = useState(false);
  const [newDefi, setNewDefi] = useState('');

  const handleAdd = async () => {
    if (!newDefi.trim()) return;
    await addDefi(newDefi.trim());
    setNewDefi('');
    setShowAdd(false);
  };

  return (
    <div className="stack">
      <p className="prompt-box">{defi}</p>
      <div className="row">
        <Button full variant="secondary" onClick={() => setDefi(pickFresh('defis', pool())!)}>Nouveau défi</Button>
        <Button full style={{ background: CONTEXT.adeux }} onClick={() => onFinish(defi)}>Relevé !</Button>
      </div>
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: defi, source_id: 'defis' }} />
      {showAdd ? (
        <div className="row divider">
          <input className="field grow" type="text" placeholder="Votre défi..." value={newDefi} onChange={(e) => setNewDefi(e.target.value)} />
          <Button size="sm" onClick={handleAdd} style={{ background: CONTEXT.adeux }}>Ajouter</Button>
        </div>
      ) : (
        <button className="link-btn quiet" onClick={() => setShowAdd(true)}>+ Ajouter votre propre défi</button>
      )}
    </div>
  );
};

// ─── Le hasard ───────────────────────────────────────────────
type HasardPick = { type: 'instant' | 'envie' | 'priere'; id: string; label: string };

const LeHasardExperience: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const memories = useMemoryStore((s) => s.memories);
  const allEnvies = useBucketStore((s) => s.items);
  const allPrayers = usePrayerStore((s) => s.topics);
  const pool: HasardPick[] = useMemo(() => [
    ...memories.map((m) => ({ type: 'instant' as const, id: m.id, label: m.text })),
    ...allEnvies.filter((i) => !i.completed).map((e) => ({ type: 'envie' as const, id: e.id, label: e.title })),
    ...allPrayers.filter((t) => t.category === 'toport').map((p) => ({ type: 'priere' as const, id: p.id, label: p.title })),
  ], [memories, allEnvies, allPrayers]);

  const draw = () => {
    const id = pickFresh('le-hasard', pool.map((p) => p.id));
    return pool.find((p) => p.id === id) || null;
  };
  const [current, setCurrent] = useState(draw);

  if (pool.length === 0) {
    return <Empty text="Il n'y a encore rien à piocher. Créez un instant, une envie ou un sujet de prière pour commencer." onClose={() => onFinish()} />;
  }
  const phrase = (type: string) =>
    type === 'instant' ? 'Et si on repensait à ça ?' : type === 'envie' ? 'Et si on faisait ça maintenant ?' : 'Et si on priait pour ça ensemble ?';

  return (
    <div className="stack">
      {current && (
        <>
          <p className="muted small">{phrase(current.type)}</p>
          <p className="prompt-box">{current.label}</p>
          <div className="row">
            <Button full variant="secondary" onClick={() => setCurrent(draw())}>Nouveau tirage</Button>
            <Button full style={{ background: CONTEXT.adeux }} onClick={() => onFinish(current.label)}>Terminé</Button>
          </div>
          <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: current.label, source_id: current.id }} />
        </>
      )}
    </div>
  );
};
