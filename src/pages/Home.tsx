import React, { useEffect, useMemo, useState } from 'react';
import { Palette, HandHeart, MessageCircleHeart, Target, Sparkles, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { useMemoryStore } from '../stores/memoryStore';
import { useBucketStore } from '../stores/bucketStore';
import { usePrayerStore } from '../stores/prayerStore';
import { useCustomContentStore } from '../stores/customContentStore';
import { Button, Modal } from '../components/UI';
import { CONTEXT, ThemeName, THEME_LABELS } from '../theme';
import { getTogetherSince, setTogetherSince, getFunDurationSince } from '../services/togetherSince';
import { config, onRefresh } from '../services/api';
import { playersOrDefault } from '../services/settings';
import { questionOfDay, dailyAnswers, defiOfWeek, defiDone } from '../services/daily';
import { stablePick, todayKey, formatDate } from '../services/time';

interface HomeProps {
  onNavigate: (tab: string, game?: string) => void;
  theme: ThemeName;
  onCycleTheme: () => void;
  onOpenColorEditor: () => void;
}

const LAST_SEEN_KEY = 'bulle_last_seen';

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bel après-midi';
  if (h >= 18 && h < 23) return 'Bonsoir';
  return 'On ne dort pas ?';
}

export const HomePage: React.FC<HomeProps> = ({ onNavigate, theme, onCycleTheme, onOpenColorEditor }) => {
  const memories = useMemoryStore((s) => s.memories);
  const envies = useBucketStore((s) => s.items);
  const prayers = usePrayerStore((s) => s.topics);
  const customQuestions = useCustomContentStore((s) => s.questions);
  const customDefis = useCustomContentStore((s) => s.defis);
  const [, setTick] = useState(0);
  useEffect(() => onRefresh(() => setTick((t) => t + 1)), []);

  const me = config.me();
  const [other] = playersOrDefault().filter((p) => p !== me);
  const day = todayKey();

  // Dernière visite : lue une fois à l'ouverture, puis mise à jour.
  const [lastSeen] = useState(() => {
    let prev: string | null = null;
    try {
      prev = localStorage.getItem(LAST_SEEN_KEY);
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    return prev || new Date(Date.now() - 3 * 86400000).toISOString();
  });

  const news = useMemo(() => {
    if (!other) return [];
    const out: { at: string; text: string; tab: string }[] = [];
    envies.forEach((e) => {
      if (e.author === other && e.created_at > lastSeen) out.push({ at: e.created_at, text: `a ajouté l'envie « ${e.title} »`, tab: 'envies' });
      if (e.completed_by === other && e.completed_at && e.completed_at > lastSeen) out.push({ at: e.completed_at, text: `a coché « ${e.title} »`, tab: 'envies' });
    });
    prayers.forEach((p) => {
      if (p.author === other && p.created_at > lastSeen) out.push({ at: p.created_at, text: `a confié « ${p.title} »`, tab: 'priere' });
      if (p.answered_by === other && p.answered_at && p.answered_at > lastSeen) out.push({ at: p.answered_at, text: `a noté que « ${p.title} » est exaucé`, tab: 'priere' });
    });
    memories.forEach((m) => {
      if (m.author === other && m.created_at > lastSeen) out.push({ at: m.created_at, text: 'a gardé un nouvel instant', tab: 'instants' });
    });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  }, [envies, prayers, memories, other, lastSeen]);

  const prayerOfDay = stablePick(prayers.filter((p) => p.category === 'toport'), `priere-${day}`);
  const pending = envies.filter((e) => !e.completed);
  const envieOfDay = stablePick(pending.filter((e) => e.timing === 'ce_soir').length ? pending.filter((e) => e.timing === 'ce_soir') : pending, `envie-${day}`);
  const souvenir = useMemo(() => {
    const md = day.slice(5);
    const sameDay = memories.filter((m) => m.date?.slice(5, 10) === md && m.date.slice(0, 4) < day.slice(0, 4));
    if (sameDay.length) {
      const m = stablePick(sameDay, `souv-${day}`)!;
      const years = Number(day.slice(0, 4)) - Number(m.date.slice(0, 4));
      return { m, label: `Il y a ${years} an${years > 1 ? 's' : ''}, jour pour jour` };
    }
    const older = memories.filter((m) => m.date && Date.now() - new Date(m.date).getTime() > 30 * 86400000);
    const m = stablePick(older, `souv-${day}`);
    return m ? { m, label: `Le ${formatDate(m.date)}` } : null;
  }, [memories, day]);

  const answers = dailyAnswers();
  const qdjStatus = answers[me]
    ? other && answers[other] ? 'Vos deux réponses sont là' : `En attente de ${other}`
    : other && answers[other] ? `${other} a répondu, à toi !` : 'Pas encore répondu';
  const done = defiDone();
  const defiStatus = Object.values(done).every(Boolean) ? 'Relevé tous les deux' : done[me] ? `Fait pour toi, et ${other} ?` : 'À relever avant dimanche';

  const [togetherSince, setTogetherSinceState] = useState(getTogetherSince());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInput, setDateInput] = useState(togetherSince || '');
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  return (
    <div className="stack page home">
      <header className="home-head">
        <div>
          <h1 className="home-title">{greeting()}{me ? `, ${me}` : ''}</h1>
          <button className="link-btn quiet" style={{ padding: '4px 0', textAlign: 'left' }} onClick={() => setShowDatePicker(true)}>
            {togetherSince ? `Ensemble depuis ${getFunDurationSince(togetherSince)}` : 'Depuis quand êtes-vous ensemble ?'}
          </button>
        </div>
        <button
          className="icon-btn"
          onClick={onCycleTheme}
          onTouchStart={() => (pressTimer = setTimeout(onOpenColorEditor, 600))}
          onTouchEnd={() => pressTimer && clearTimeout(pressTimer)}
          onContextMenu={(e) => { e.preventDefault(); onOpenColorEditor(); }}
          aria-label={`Thème ${THEME_LABELS[theme]}. Appui long pour régler les couleurs.`}
          title={`Thème : ${THEME_LABELS[theme]}`}
        >
          <Palette size={20} />
        </button>
      </header>

      {news.length > 0 && (
        <section className="news">
          <h2 className="section-title">Du nouveau de {other}</h2>
          {news.map((n, i) => (
            <button key={i} className="news-line" onClick={() => onNavigate(n.tab)}>
              <span className="news-dot" />
              <span><strong>{other}</strong> {n.text}</span>
            </button>
          ))}
        </section>
      )}

      <section className="stack-sm">
        <h2 className="section-title">Aujourd'hui</h2>
        <TodayCard icon={<MessageCircleHeart size={18} />} color={CONTEXT.adeux} label="La question du jour" status={qdjStatus}
          text={questionOfDay(day, customQuestions.filter((q) => q.theme !== '__mot').map((q) => q.question))}
          onClick={() => onNavigate('adeux', 'question-du-jour')} />
        {prayerOfDay && (
          <TodayCard icon={<HandHeart size={18} />} color={CONTEXT.priere} label="Prions pour" text={prayerOfDay.title} onClick={() => onNavigate('priere')} />
        )}
        <TodayCard icon={<Target size={18} />} color={CONTEXT.adeux} label="Le défi de la semaine" status={defiStatus}
          text={defiOfWeek(undefined, customDefis.map((d) => d.text))} onClick={() => onNavigate('adeux', 'defi-semaine')} />
        {envieOfDay && (
          <TodayCard icon={<Sparkles size={18} />} color={CONTEXT.envies} label="Et si vous faisiez ça ?" text={envieOfDay.title} onClick={() => onNavigate('envies')} />
        )}
        {souvenir && (
          <TodayCard icon={<ImageIcon size={18} />} color={CONTEXT.instants} label={souvenir.label} text={souvenir.m.text} photo={souvenir.m.photo_url} onClick={() => onNavigate('instants')} />
        )}
      </section>

      <Modal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} title="Ensemble depuis…">
        <div className="stack">
          <input className="field" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          <Button full disabled={!dateInput} onClick={() => { setTogetherSince(dateInput); setTogetherSinceState(dateInput); setShowDatePicker(false); }}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
};

const TodayCard: React.FC<{ icon: React.ReactNode; color: string; label: string; text: string; status?: string; photo?: string; onClick: () => void }> = ({
  icon, color, label, text, status, photo, onClick,
}) => (
  <button className="today-card" onClick={onClick} style={{ ['--tone' as string]: color }}>
    <span className="today-icon">{icon}</span>
    <span className="today-body">
      <span className="today-label">{label}</span>
      <span className="today-text">{text.length > 120 ? `${text.slice(0, 120)}…` : text}</span>
      {status && <span className="today-status">{status}</span>}
    </span>
    {photo ? <img className="today-photo" src={photo} alt="" /> : <ChevronRight size={18} className="today-chevron" />}
  </button>
);
