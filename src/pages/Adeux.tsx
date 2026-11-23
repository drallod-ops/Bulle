import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Shuffle, History, X, Users, Split, Timer, Brain, Target, MessageCircleHeart, BookOpen, Images, RefreshCw, Check } from 'lucide-react';
import { Button, Modal } from '../components/UI';
import { useMemoryStore } from '../stores/memoryStore';
import { useGameStore } from '../stores/gameStore';
import { useCustomContentStore } from '../stores/customContentStore';
import {
  DEFAULT_GAMES,
  DUREE_LABELS,
  JE_PENSE_ITEMS,
  JE_PENSE_GUIDING_QUESTIONS,
  QUI_CONNAIT_THEMES,
  ET_SI_QUESTIONS,
  DEFIS,
  TU_PREFERES,
  CHRONO_CATEGORIES,
  VERSETS,
  type Duree,
  type SessionResult,
} from '../services/adeuxContent';
import { pickRandom, pickFresh, shuffle } from '../services/random';
import { playersOrDefault } from '../services/settings';
import { config, refresh, onRefresh } from '../services/api';
import {
  questionOfDay, dailyAnswers, answerToday, dailyHistory,
  defiOfWeek, defiDone, setDefiDone, defiStreak, changeDefi,
} from '../services/daily';
import { formatDate } from '../services/time';
import type { GameSession, Memory } from '../types';
import { CONTEXT } from '../theme';

type Prefill = { text: string; source_id: string };
type FinishFn = (summary?: string, result?: SessionResult) => void;
interface ExperienceProps {
  onFinish: FinishFn;
  onCreateMemoryFor?: (prefill: Prefill) => void;
}

const ICONS: Record<string, LucideIcon> = { Users, Split, Timer, Brain, Target, MessageCircleHeart, BookOpen, Images };
const gameName = (id: string) =>
  DEFAULT_GAMES.find((g) => g.id === id)?.name ||
  ({ 'photo-mystere': 'Photo mystère', chronologie: 'Chronologie', 'et-si': 'Et si…', defis: 'Défis', 'le-hasard': 'Le hasard' } as Record<string, string>)[id] ||
  id;

/** Re-rend le composant quand des données fraîches arrivent du Sheets. */
function useRefreshTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => onRefresh(() => setTick((t) => t + 1)), []);
  return [tick, () => setTick((t) => t + 1)] as const;
}

// ─── Page ─────────────────────────────────────────────────────
export const AdeuxPage: React.FC<{ onCreateMemoryFor?: (prefill: Prefill) => void; initialGame?: string | null }> = ({ onCreateMemoryFor, initialGame }) => {
  const [activeId, setActiveId] = useState<string | null>(initialGame || null);
  const [duree, setDuree] = useState<Duree | 'tout'>('tout');
  const [showHistory, setShowHistory] = useState(false);
  const logSession = useGameStore((s) => s.logSession);
  const games = DEFAULT_GAMES.filter((g) => duree === 'tout' || g.duree.includes(duree));

  useEffect(() => {
    if (initialGame) setActiveId(initialGame);
  }, [initialGame]);

  return (
    <div className="stack page">
      <div>
        <p className="muted" style={{ marginBottom: 10 }}>Vous avez combien de temps ?</p>
        <div className="filters">
          {(['tout', 'rapide', 'moyen', 'soiree'] as const).map((d) => (
            <button key={d} className={duree === d ? 'on' : ''} onClick={() => setDuree(d)}>
              {d === 'tout' ? 'Tout' : DUREE_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <Button full style={{ background: CONTEXT.adeux, color: '#FBF6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setActiveId(pickRandom(games.map((g) => g.id)))}>
          <Shuffle size={16} /> Au hasard
        </Button>
        <Button variant="secondary" onClick={() => setShowHistory(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={16} /> Historique
        </Button>
      </div>

      <div className="game-grid">
        {games.map((game) => {
          const Icon = ICONS[game.icon] || Users;
          return (
            <button key={game.id} className="game-tile" onClick={() => setActiveId(game.id)}>
              <span className="game-icon"><Icon size={20} /></span>
              <span className="game-name">{game.name}</span>
              <span className="game-desc">{game.description}</span>
              {game.distance && <span className="chip">Aussi à distance</span>}
            </button>
          );
        })}
      </div>

      <ExperienceModal
        activeId={activeId}
        onClose={() => setActiveId(null)}
        onDone={(summary, result) => activeId && logSession(activeId, summary, result)}
        onCreateMemoryFor={onCreateMemoryFor}
      />

      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="Historique des jeux">
        <GameHistory />
      </Modal>
    </div>
  );
};

// ─── Historique (sans palmarès) ──────────────────────────────
const GameHistory: React.FC = () => {
  const sessions = useGameStore((s) => s.sessions);
  const deleteSession = useGameStore((s) => s.deleteSession);
  const stats = useMemo(() => {
    const coop = sessions.filter((s) => s.mode === 'coop' && s.scores);
    const best = (id: string) => coop.filter((s) => s.game_id === id).reduce((m, s) => Math.max(m, s.scores?.ensemble ?? 0), 0);
    const thisMonth = sessions.filter((s) => s.played_at.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
    return { total: sessions.length, thisMonth, phase: best('tu-preferes'), versets: best('verset') };
  }, [sessions]);

  if (sessions.length === 0) return <p className="muted">Aucune partie pour l'instant. Vos moments de jeu apparaîtront ici.</p>;

  return (
    <div className="stack">
      <div className="board">
        <div className="board-cell"><span className="big">{stats.thisMonth}</span><span className="label">parties ce mois-ci</span></div>
        <div className="board-cell"><span className="big">{stats.total}</span><span className="label">parties en tout</span></div>
        <div className="board-cell"><span className="big">{stats.phase}</span><span className="label">record « en phase »</span></div>
        <div className="board-cell"><span className="big">{stats.versets}</span><span className="label">versets retrouvés d'affilée</span></div>
      </div>
      <div>
        {sessions.slice(0, 40).map((s) => <HistoryItem key={s.id} session={s} onDelete={() => deleteSession(s.id)} />)}
      </div>
    </div>
  );
};

const HistoryItem: React.FC<{ session: GameSession; onDelete: () => void }> = ({ session, onDelete }) => {
  const scores = session.scores
    ? session.mode === 'coop'
      ? `${session.scores.ensemble ?? 0} ensemble`
      : Object.entries(session.scores).map(([k, v]) => `${k} ${v}`).join(', ')
    : null;
  return (
    <div className="history-item">
      <div style={{ flex: 1 }}>
        <div>{session.summary || gameName(session.game_id)}</div>
        <div className="meta">{formatDate(session.played_at, false)}{scores ? `, ${scores}` : ''}</div>
      </div>
      <button className="icon-btn" onClick={onDelete} aria-label="Supprimer cette partie"><X size={14} /></button>
    </div>
  );
};

// ─── Briques communes ────────────────────────────────────────
const ExperienceModal: React.FC<{ activeId: string | null; onClose: () => void; onDone: FinishFn; onCreateMemoryFor?: (p: Prefill) => void }> = ({
  activeId, onClose, onDone, onCreateMemoryFor,
}) => {
  const game = DEFAULT_GAMES.find((g) => g.id === activeId) || null;
  const finish: FinishFn = (summary, result) => {
    if (summary || result) onDone(summary, result);
    onClose();
  };
  const props = { onFinish: finish, onCreateMemoryFor };
  return (
    <Modal isOpen={!!game} onClose={onClose} title={game?.name}>
      {activeId === 'question-du-jour' && <QuestionDuJour {...props} />}
      {activeId === 'defi-semaine' && <DefiSemaine {...props} />}
      {activeId === 'qui-connait-mieux' && <QuiConnait {...props} />}
      {activeId === 'tu-preferes' && <TuPreferes {...props} />}
      {activeId === 'verset' && <VersetACompleter {...props} />}
      {activeId === 'souvenirs' && <NosSouvenirs {...props} />}
      {activeId === 'je-pense' && <JePense {...props} />}
      {activeId === 'chrono-mots' && <ChronoMots {...props} />}
    </Modal>
  );
};

function useScores() {
  const players = playersOrDefault();
  const [scores, setScores] = useState<Record<string, number>>({ [players[0]]: 0, [players[1]]: 0 });
  const add = (player: string, pts = 1) => setScores((s) => ({ ...s, [player]: (s[player] || 0) + pts }));
  return { players, scores, add, hasPoints: Object.values(scores).some((v) => v > 0) };
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
  onCreateMemoryFor ? <button className="link-btn" onClick={() => onCreateMemoryFor(prefill)}>Garder cet instant</button> : null;

const Empty: React.FC<{ text: string; onClose: () => void }> = ({ text, onClose }) => (
  <div className="stack">
    <p className="muted">{text}</p>
    <Button full variant="secondary" onClick={onClose}>Fermer</Button>
  </div>
);

const PrimaryBtn: React.FC<React.ComponentProps<typeof Button>> = ({ style, ...rest }) => (
  <Button full {...rest} style={{ background: CONTEXT.adeux, color: '#FBF6EE', ...style }} />
);

// ─── La question du jour (à distance) ────────────────────────
const QuestionDuJour: React.FC<ExperienceProps> = () => {
  const [, bump] = useRefreshTick();
  const custom = useCustomContentStore((s) => s.questions).filter((q) => q.theme !== '__mot').map((q) => q.question);
  const me = config.me();
  const [other] = playersOrDefault().filter((p) => p !== me);
  const question = questionOfDay(undefined, custom);
  const answers = dailyAnswers();
  const [draft, setDraft] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const mine = answers[me];
  const theirs = other ? answers[other] : undefined;

  const send = () => {
    if (!draft.trim()) return;
    answerToday(draft);
    setDraft('');
    bump();
  };
  const sync = async () => {
    setSyncing(true);
    await refresh().catch(() => undefined);
    setSyncing(false);
  };

  return (
    <div className="stack">
      <p className="prompt-box">{question}</p>
      {!mine ? (
        <>
          <textarea className="field" rows={3} placeholder="Ta réponse…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <p className="muted small">{theirs ? `${other} a déjà répondu. Sa réponse s'affichera après la tienne.` : `${other} ne verra ta réponse qu'après avoir répondu à son tour.`}</p>
          <PrimaryBtn onClick={send} disabled={!draft.trim()}>Envoyer</PrimaryBtn>
        </>
      ) : theirs ? (
        <div className="stack-sm">
          <div className="answer"><span className="answer-who">Toi</span>{mine}</div>
          <div className="answer"><span className="answer-who">{other}</span>{theirs}</div>
        </div>
      ) : (
        <div className="stack-sm">
          <div className="answer"><span className="answer-who">Toi</span>{mine}</div>
          <p className="muted">En attente de la réponse de {other}.</p>
          <Button variant="secondary" full onClick={sync} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <RefreshCw size={15} /> {syncing ? 'Vérification…' : 'Vérifier'}
          </Button>
        </div>
      )}
      <button className="link-btn quiet" onClick={() => setShowPast((v) => !v)}>{showPast ? 'Masquer les jours passés' : 'Voir les jours passés'}</button>
      {showPast && <PastQuestions custom={custom} />}
    </div>
  );
};

const PastQuestions: React.FC<{ custom: string[] }> = ({ custom }) => {
  const history = dailyHistory();
  if (!history.length) return <p className="muted small">Les questions auxquelles vous aurez répondu tous les deux apparaîtront ici.</p>;
  return (
    <div className="stack-sm">
      {history.slice(0, 30).map(({ day, answers }) => (
        <div key={day} className="past">
          <p className="item-meta">{formatDate(day)}</p>
          <p className="item-title">{questionOfDay(day, custom)}</p>
          {Object.entries(answers).map(([who, a]) => <p key={who} className="muted"><strong className="ink">{who} :</strong> {a}</p>)}
        </div>
      ))}
    </div>
  );
};

// ─── Le défi de la semaine ───────────────────────────────────
const DefiSemaine: React.FC<ExperienceProps> = ({ onCreateMemoryFor }) => {
  const [, bump] = useRefreshTick();
  const customDefis = useCustomContentStore((s) => s.defis).map((d) => d.text);
  const addDefi = useCustomContentStore((s) => s.addDefi);
  const me = config.me();
  const defi = defiOfWeek(undefined, customDefis);
  const done = defiDone();
  const streak = defiStreak();
  const [showAdd, setShowAdd] = useState(false);
  const [newDefi, setNewDefi] = useState('');
  const both = Object.values(done).every(Boolean);

  return (
    <div className="stack">
      <p className="prompt-box">{defi}</p>
      <div className="row">
        {Object.entries(done).map(([name, ok]) => (
          <button key={name} className={`choice${ok ? ' good' : ''}`} disabled={name !== me} onClick={() => { setDefiDone(!ok); bump(); }}
            style={{ opacity: name !== me && !ok ? 0.7 : 1 }}>
            {ok ? <Check size={15} style={{ verticalAlign: -2 }} /> : null} {name}
            <span className="muted small" style={{ display: 'block' }}>{ok ? 'relevé' : name === me ? 'Toucher quand c’est fait' : 'pas encore'}</span>
          </button>
        ))}
      </div>
      {both && <p className="ink center" style={{ margin: 0 }}>Défi relevé tous les deux cette semaine.</p>}
      {streak >= 2 && <p className="muted center">{streak} semaines d'affilée.</p>}
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: defi, source_id: 'defi-semaine' }} />
      <div className="row">
        <button className="link-btn quiet grow" onClick={() => { changeDefi(pickFresh('defis', [...DEFIS, ...customDefis].filter((d) => d !== defi))!); bump(); }}>
          Changer de défi
        </button>
        <button className="link-btn quiet grow" onClick={() => setShowAdd((v) => !v)}>+ Proposer un défi</button>
      </div>
      {showAdd && (
        <div className="row divider">
          <input className="field grow" type="text" placeholder="Votre défi…" value={newDefi} onChange={(e) => setNewDefi(e.target.value)} />
          <Button size="sm" onClick={async () => { if (newDefi.trim()) { await addDefi(newDefi.trim()); setNewDefi(''); setShowAdd(false); } }}>Ajouter</Button>
        </div>
      )}
    </div>
  );
};

// ─── À propos de toi (avec les « Et si… ») ───────────────────
const ET_SI_THEME = 'Et si…';

const QuiConnait: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const customQuestions = useCustomContentStore((s) => s.questions);
  const addQuestion = useCustomContentStore((s) => s.addQuestion);
  const themes = [...Object.keys(QUI_CONNAIT_THEMES), ET_SI_THEME];
  const [themeFilter, setThemeFilter] = useState<string>('tous');
  const [count, setCount] = useState(1);

  const pool = (theme: string) => [
    ...(theme === ET_SI_THEME ? ET_SI_QUESTIONS : QUI_CONNAIT_THEMES[theme] || []),
    ...customQuestions.filter((q) => q.theme === theme).map((q) => q.question),
  ];
  const draw = (filter = themeFilter) => {
    const theme = filter === 'tous' ? pickRandom(themes)! : filter;
    return { theme, question: pickFresh(`qui-${theme}`, pool(theme))! };
  };
  const [current, setCurrent] = useState(() => draw());
  const [showAdd, setShowAdd] = useState(false);
  const [newTheme, setNewTheme] = useState(themes[0]);
  const [newQuestion, setNewQuestion] = useState('');

  return (
    <div className="stack">
      <div className="filters scroll">
        {['tous', ...themes].map((t) => (
          <button key={t} className={themeFilter === t ? 'on' : ''} onClick={() => { setThemeFilter(t); setCurrent(draw(t)); }}>
            {t === 'tous' ? 'Tous' : t}
          </button>
        ))}
      </div>
      <span className="chip-accent">{current.theme}</span>
      <p className="prompt-box">{current.question}</p>
      <p className="muted small">{current.theme === ET_SI_THEME ? 'Pas de bonne réponse : imaginez ensemble.' : "Chacun répond en secret, puis vous comparez. Ou l'un devine la réponse de l'autre."}</p>
      <div className="row">
        <Button full variant="secondary" onClick={() => { setCurrent(draw()); setCount((c) => c + 1); }}>Autre question</Button>
        <PrimaryBtn onClick={() => onFinish(`À propos de toi, ${count} question${count > 1 ? 's' : ''}`)}>Terminer</PrimaryBtn>
      </div>
      <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `« ${current.question} »`, source_id: 'qui-connait-mieux' }} />
      {showAdd ? (
        <div className="stack-sm divider">
          <select className="field" value={newTheme} onChange={(e) => setNewTheme(e.target.value)}>
            {themes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="field" type="text" placeholder="Votre question…" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
          <Button size="sm" onClick={async () => { if (newQuestion.trim()) { await addQuestion(newTheme, newQuestion.trim()); setNewQuestion(''); setShowAdd(false); } }}>
            Ajouter à la banque
          </Button>
        </div>
      ) : (
        <button className="link-btn quiet" onClick={() => setShowAdd(true)}>+ Ajouter votre propre question</button>
      )}
    </div>
  );
};

// ─── Tu préfères… (ensemble) ─────────────────────────────────
const TuPreferes: React.FC<ExperienceProps> = ({ onFinish }) => {
  const players = playersOrDefault();
  const drawPair = () => pickFresh('tu-preferes', TU_PREFERES.map((p) => p.join(' | ')))!.split(' | ') as [string, string];
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
  const finish = () =>
    onFinish(rounds ? `Tu préfères…, ${matches} sur ${rounds} en phase` : undefined, rounds ? { mode: 'coop', scores: { ensemble: matches } } : undefined);

  return (
    <div className="stack">
      <div className="score-strip"><div className="score-cell"><span className="name">En phase</span><span className="pts">{matches} / {rounds}</span></div></div>
      {step === 'pass' ? (
        <div className="stack">
          <p className="prompt-box center">C'est noté. Passe le téléphone à {players[1]}, sans regarder.</p>
          <PrimaryBtn onClick={() => setStep('p2')}>Je suis {players[1]}</PrimaryBtn>
        </div>
      ) : (
        <>
          <p className="muted">
            {step === 'p1' && `${players[0]} choisit en secret.`}
            {step === 'p2' && `${players[1]} choisit en secret.`}
            {step === 'reveal' && (choices[0] === choices[1] ? 'Même choix !' : 'Pas le même choix. De quoi en parler.')}
          </p>
          <div className="stack-sm">
            {pair.map((option, i) => {
              const who = step === 'reveal' ? players.filter((_, j) => choices[j] === i) : [];
              return (
                <button key={option} className={`choice${who.length === 2 ? ' good' : who.length === 1 ? ' selected' : ''}`} onClick={() => pick(i)} disabled={step === 'reveal'}>
                  {option}
                  {who.length > 0 && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{who.join(' et ')}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="row">
        <Button variant="secondary" full onClick={() => { setPair(drawPair()); setChoices([null, null]); setStep('p1'); }} disabled={step !== 'reveal'}>Suivante</Button>
        <PrimaryBtn onClick={finish}>Terminer</PrimaryBtn>
      </div>
    </div>
  );
};

// ─── Verset à compléter (ensemble) ───────────────────────────
const VersetACompleter: React.FC<ExperienceProps> = ({ onFinish }) => {
  const draw = () => {
    const ref = pickFresh('versets', VERSETS.map((v) => v.ref))!;
    const verset = VERSETS.find((v) => v.ref === ref)!;
    const mode: 'mot' | 'ref' = Math.random() < 0.6 ? 'mot' : 'ref';
    const others = shuffle(VERSETS.filter((v) => v.ref !== ref)).slice(0, 3);
    const options = shuffle(mode === 'mot' ? [verset.word, ...others.map((o) => o.word)] : [verset.ref, ...others.map((o) => o.ref)]);
    return { verset, mode, options };
  };
  const [round, setRound] = useState(draw);
  const [answer, setAnswer] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const [played, setPlayed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const correct = round.mode === 'mot' ? round.verset.word : round.verset.ref;

  const choose = (opt: string) => {
    if (answer) return;
    setAnswer(opt);
    setPlayed((p) => p + 1);
    if (opt === correct) {
      setFound((f) => f + 1);
      setStreak((s) => { setBestStreak((b) => Math.max(b, s + 1)); return s + 1; });
    } else setStreak(0);
  };
  const shown = round.mode === 'mot' && !answer ? round.verset.text.replace(round.verset.word, '_____') : round.verset.text;

  return (
    <div className="stack">
      <div className="score-strip"><div className="score-cell"><span className="name">Trouvés ensemble</span><span className="pts">{found} / {played}</span></div></div>
      <p className="muted">{round.mode === 'mot' ? 'Quel mot manque ?' : 'Quelle est la référence ?'}</p>
      <blockquote className="verse">
        {shown}
        {(answer || round.mode === 'mot') && <cite>{round.verset.ref}</cite>}
      </blockquote>
      <div className="option-grid">
        {round.options.map((o) => (
          <button key={o} className={`choice${answer ? (o === correct ? ' good' : o === answer ? ' bad' : '') : ''}`} onClick={() => choose(o)}>{o}</button>
        ))}
      </div>
      <div className="row">
        <Button variant="secondary" full disabled={!answer} onClick={() => { setRound(draw()); setAnswer(null); }}>Verset suivant</Button>
        <PrimaryBtn onClick={() => onFinish(played ? `Verset à compléter, ${found} sur ${played}` : undefined, played ? { mode: 'coop', scores: { ensemble: bestStreak } } : undefined)}>
          Terminer
        </PrimaryBtn>
      </div>
      <p className="muted small center">Louis Segond 1910</p>
    </div>
  );
};

// ─── Nos souvenirs : 3 façons de jouer avec vos Instants ─────
type SouvenirMode = 'photo' | 'chrono' | 'lieu';
const SOUVENIR_LABELS: Record<SouvenirMode, string> = { photo: 'Photo mystère', chrono: 'Chronologie', lieu: 'Où était-ce ?' };

const NosSouvenirs: React.FC<ExperienceProps> = (props) => {
  const [mode, setMode] = useState<SouvenirMode>('photo');
  return (
    <div className="stack">
      <div className="segmented">
        {(Object.keys(SOUVENIR_LABELS) as SouvenirMode[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{SOUVENIR_LABELS[m]}</button>
        ))}
      </div>
      {mode === 'photo' && <PhotoMystere key="photo" {...props} />}
      {mode === 'chrono' && <Chronologie key="chrono" {...props} />}
      {mode === 'lieu' && <OuEtaitCe key="lieu" {...props} />}
    </div>
  );
};

const BLUR_LEVELS = [28, 16, 8, 0];

const PhotoMystere: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const all = useMemoryStore((s) => s.memories);
  const withPhoto = useMemo(() => all.filter((m) => !!m.photo_url), [all]);
  const { players, scores, add, hasPoints } = useScores();
  const [pick, setPick] = useState<Memory | null>(() => pickRandom(withPhoto));
  const [level, setLevel] = useState(0);
  const [found, setFound] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  if (withPhoto.length < 3 || !pick) return <Empty text="Il faut au moins 3 instants avec photo pour ce mode." onClose={() => onFinish()} />;
  const revealed = found !== null || level === BLUR_LEVELS.length - 1;
  const points = BLUR_LEVELS.length - 1 - level;
  const next = () => {
    const nextSeen = [...seen, pick.id];
    const pool = withPhoto.filter((m) => !nextSeen.includes(m.id));
    setSeen(pool.length ? nextSeen : []);
    setPick(pickRandom(pool.length ? pool : withPhoto));
    setLevel(0);
    setFound(null);
  };

  return (
    <div className="stack">
      <ScoreStrip scores={scores} />
      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <img src={pick.photo_url} alt="" style={{
          width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block',
          filter: revealed ? 'none' : `blur(${BLUR_LEVELS[level]}px)`, transform: revealed ? 'none' : 'scale(1.1)',
          transition: 'filter 0.5s ease-out, transform 0.5s ease-out',
        }} />
      </div>
      {revealed ? (
        <div className="stack-sm">
          <p className="ink" style={{ margin: 0 }}>{pick.text}</p>
          <p className="muted small">{formatDate(pick.date)}{pick.location ? `, ${pick.location}` : ''}{found ? `. Reconnue par ${found}.` : ''}</p>
          <div className="row">
            <Button variant="secondary" full onClick={next}>Photo suivante</Button>
            <PrimaryBtn onClick={() => onFinish('Nos souvenirs, photo mystère', hasPoints ? { scores } : undefined)}>Terminer</PrimaryBtn>
          </div>
          <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `Redécouvert : ${pick.text}`, source_id: 'souvenirs' }} />
        </div>
      ) : (
        <div className="stack-sm">
          <p className="muted">Qui reconnaît ce moment ? Il vaut {points} point{points > 1 ? 's' : ''}.</p>
          <div className="row">
            {players.map((p) => <button key={p} className="choice" onClick={() => { add(p, points); setFound(p); }}>{p} l'a trouvé</button>)}
          </div>
          <Button variant="secondary" full onClick={() => setLevel((l) => l + 1)}>Rendre plus net</Button>
        </div>
      )}
    </div>
  );
};

const dayOf = (m: Memory) => (m.date || m.created_at || '').slice(0, 10);

const Chronologie: React.FC<ExperienceProps> = ({ onFinish }) => {
  const memories = useMemoryStore((s) => s.memories);
  const dated = useMemo(() => memories.filter((m) => dayOf(m)), [memories]);
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

  if (new Set(dated.map(dayOf)).size < 4 || !pair) return <Empty text="Il faut au moins 4 instants à des dates différentes pour ce mode." onClose={() => onFinish()} />;
  const player = players[round % 2];
  const first = dayOf(pair[0]) < dayOf(pair[1]) ? pair[0].id : pair[1].id;

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={player} />
      <p className="muted">À {player} : lequel est arrivé en premier ?</p>
      {pair.map((m) => (
        <button key={m.id} className={`choice${answer ? (m.id === first ? ' good' : m.id === answer ? ' bad' : '') : ''}`}
          onClick={() => { if (!answer) { setAnswer(m.id); if (m.id === first) add(player); } }}
          style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', fontWeight: 500 }}>
          {m.photo_url && <img src={m.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>
            {m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text}
            {answer && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{formatDate(dayOf(m))}</span>}
          </span>
        </button>
      ))}
      <div className="row">
        <Button variant="secondary" full onClick={() => { setRound((r) => r + 1); setPair(drawPair()); setAnswer(null); }} disabled={!answer}>Suivante</Button>
        <PrimaryBtn onClick={() => onFinish('Nos souvenirs, chronologie', hasPoints ? { scores } : undefined)}>Terminer</PrimaryBtn>
      </div>
    </div>
  );
};

const OuEtaitCe: React.FC<ExperienceProps> = ({ onFinish }) => {
  const memories = useMemoryStore((s) => s.memories);
  const located = useMemo(() => memories.filter((m) => m.location?.trim()), [memories]);
  const places = useMemo(() => [...new Set(located.map((m) => m.location!.trim()))], [located]);
  const { players, scores, add, hasPoints } = useScores();
  const [round, setRound] = useState(0);
  const draw = () => {
    const m = pickRandom(located);
    if (!m) return null;
    const right = m.location!.trim();
    return { m, options: shuffle([right, ...shuffle(places.filter((p) => p !== right)).slice(0, 3)]) };
  };
  const [q, setQ] = useState(draw);
  const [answer, setAnswer] = useState<string | null>(null);

  if (places.length < 4 || !q) return <Empty text="Il faut des instants dans au moins 4 lieux différents pour ce mode." onClose={() => onFinish()} />;
  const player = players[round % 2];
  const right = q.m.location!.trim();

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={player} />
      <p className="muted">À {player} : où était-ce ?</p>
      {q.m.photo_url && <img src={q.m.photo_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />}
      <p className="prompt-box">{q.m.text}</p>
      <div className="option-grid">
        {q.options.map((o) => (
          <button key={o} className={`choice${answer ? (o === right ? ' good' : o === answer ? ' bad' : '') : ''}`}
            onClick={() => { if (!answer) { setAnswer(o); if (o === right) add(player); } }}>{o}</button>
        ))}
      </div>
      <div className="row">
        <Button variant="secondary" full onClick={() => { setRound((r) => r + 1); setQ(draw()); setAnswer(null); }} disabled={!answer}>Suivante</Button>
        <PrimaryBtn onClick={() => onFinish('Nos souvenirs, où était-ce ?', hasPoints ? { scores } : undefined)}>Terminer</PrimaryBtn>
      </div>
    </div>
  );
};

// ─── Je pense à… (sujet caché) ───────────────────────────────
const JePense: React.FC<ExperienceProps> = ({ onFinish, onCreateMemoryFor }) => {
  const { players, scores, add, hasPoints } = useScores();
  const [round, setRound] = useState(0);
  const [item, setItem] = useState(() => pickFresh('je-pense', JE_PENSE_ITEMS)!);
  const [phase, setPhase] = useState<'pass' | 'show' | 'guess'>('pass');
  const [questions, setQuestions] = useState(0);
  const thinker = players[round % 2];
  const guesser = players[(round + 1) % 2];
  const hints = useMemo(() => shuffle(JE_PENSE_GUIDING_QUESTIONS).slice(0, 3), [item]);
  const points = Math.max(1, 10 - questions);
  const next = () => { setRound((r) => r + 1); setItem(pickFresh('je-pense', JE_PENSE_ITEMS)!); setPhase('pass'); setQuestions(0); };

  return (
    <div className="stack">
      <ScoreStrip scores={scores} turn={phase === 'guess' ? guesser : thinker} />
      {phase === 'pass' && (
        <>
          <p className="prompt-box center">Passe le téléphone à {thinker}. {guesser}, ne regarde pas !</p>
          <PrimaryBtn onClick={() => setPhase('show')}>Je suis {thinker}, voir le sujet</PrimaryBtn>
        </>
      )}
      {phase === 'show' && (
        <>
          <p className="prompt-box big">{item}</p>
          <button className="link-btn quiet" onClick={() => setItem(pickFresh('je-pense', JE_PENSE_ITEMS)!)}>Un autre sujet</button>
          <PrimaryBtn onClick={() => setPhase('guess')}>Cacher et commencer</PrimaryBtn>
        </>
      )}
      {phase === 'guess' && (
        <>
          <p className="muted">{guesser} pose des questions fermées. Moins il en faut, plus ça rapporte.</p>
          <div className="row wrap">{hints.map((h) => <span key={h} className="chip">{h}</span>)}</div>
          <div className="row">
            <Button variant="secondary" full onClick={() => setQuestions((q) => q + 1)}>Question posée ({questions})</Button>
            <PrimaryBtn onClick={() => { add(guesser, points); next(); }}>Trouvé ! (+{points})</PrimaryBtn>
          </div>
          <div className="row">
            <button className="link-btn quiet grow" onClick={next}>Abandonner ce sujet</button>
            <button className="link-btn grow" onClick={() => onFinish(`Je pense à…, ${round} manche${round > 1 ? 's' : ''}`, hasPoints ? { scores } : undefined)}>Terminer</button>
          </div>
          <KeepMoment onCreateMemoryFor={onCreateMemoryFor} prefill={{ text: `« Je pense à… » ${item}`, source_id: 'je-pense' }} />
        </>
      )}
    </div>
  );
};

// ─── Chrono-mots (catégories, vos mots, durée réglable) ──────
const MY_WORDS = 'Vos mots';
const TURNS = 4;

const ChronoMots: React.FC<ExperienceProps> = ({ onFinish }) => {
  const custom = useCustomContentStore((s) => s.questions).filter((q) => q.theme === '__mot').map((q) => q.question);
  const addQuestion = useCustomContentStore((s) => s.addQuestion);
  const categories = [...Object.keys(CHRONO_CATEGORIES), ...(custom.length ? [MY_WORDS] : [])];
  const { players, scores, add, hasPoints } = useScores();
  const [selected, setSelected] = useState<string[]>(Object.keys(CHRONO_CATEGORIES));
  const [seconds, setSeconds] = useState(60);
  const [newWord, setNewWord] = useState('');
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'ready' | 'running' | 'between' | 'done'>('setup');
  const [left, setLeft] = useState(60);
  const [turnScore, setTurnScore] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pool = selected.flatMap((c) => (c === MY_WORDS ? custom : CHRONO_CATEGORIES[c] || []));
  const [word, setWord] = useState('');
  const player = players[turn % 2];
  const nextWord = () => setWord(pickFresh('chrono-mots', pool) || '');

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    if (phase === 'running' && left <= 0) {
      if (timer.current) clearInterval(timer.current);
      setPhase(turn + 1 >= TURNS ? 'done' : 'between');
      if (navigator.vibrate) navigator.vibrate(300);
    }
  }, [left, phase, turn]);

  const start = () => {
    setLeft(seconds);
    setTurnScore(0);
    nextWord();
    setPhase('running');
    timer.current = setInterval(() => setLeft((l) => l - 1), 1000);
  };

  return (
    <div className="stack">
      {phase === 'setup' ? (
        <>
          <p className="muted">Catégories</p>
          <div className="filters wrap">
            {categories.map((c) => (
              <button key={c} className={selected.includes(c) ? 'on' : ''} onClick={() => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}>{c}</button>
            ))}
          </div>
          <div className="row">
            <input className="field grow" type="text" placeholder="Ajouter un mot à vous" value={newWord} onChange={(e) => setNewWord(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={async () => { if (newWord.trim()) { await addQuestion('__mot', newWord.trim()); setNewWord(''); if (!selected.includes(MY_WORDS)) setSelected((s) => [...s, MY_WORDS]); } }}>Ajouter</Button>
          </div>
          <p className="muted">Durée d'un tour</p>
          <div className="segmented">
            {[30, 60, 90].map((s) => <button key={s} className={seconds === s ? 'on' : ''} onClick={() => setSeconds(s)}>{s} s</button>)}
          </div>
          <PrimaryBtn disabled={pool.length < 5} onClick={() => setPhase('ready')}>{pool.length < 5 ? 'Choisissez au moins une catégorie' : 'Commencer'}</PrimaryBtn>
        </>
      ) : (
        <>
          <ScoreStrip scores={scores} turn={phase === 'done' ? undefined : player} />
          {phase === 'ready' && (
            <>
              <p className="muted">{player} fait deviner un maximum de mots en {seconds} secondes, sans les prononcer. Deux tours chacun.</p>
              <PrimaryBtn onClick={start}>C'est parti pour {player}</PrimaryBtn>
            </>
          )}
          {phase === 'running' && (
            <>
              <p className={`timer${left <= 10 ? ' low' : ''}`}>{left}</p>
              <p className="prompt-box big">{word}</p>
              <div className="row">
                <Button variant="secondary" full onClick={nextWord}>Passer</Button>
                <PrimaryBtn onClick={() => { add(player); setTurnScore((s) => s + 1); nextWord(); }}>Trouvé</PrimaryBtn>
              </div>
            </>
          )}
          {phase === 'between' && (
            <>
              <p className="prompt-box center">Temps écoulé : {turnScore} mot{turnScore > 1 ? 's' : ''} pour {player}.</p>
              <PrimaryBtn onClick={() => { setTurn((t) => t + 1); setPhase('ready'); }}>Au tour de {players[(turn + 1) % 2]}</PrimaryBtn>
            </>
          )}
          {phase === 'done' && <p className="prompt-box center">Partie terminée : {players[0]} {scores[players[0]]}, {players[1]} {scores[players[1]]}.</p>}
          {phase !== 'running' && (
            <button className="link-btn" onClick={() => onFinish('Chrono-mots', hasPoints ? { scores } : undefined)}>
              {phase === 'done' ? 'Enregistrer et fermer' : 'Terminer la partie'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

