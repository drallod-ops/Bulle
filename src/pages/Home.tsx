import React, { useMemo, useRef, useState } from 'react';
import { Image, Users, Sparkles, HandHeart, Palette } from 'lucide-react';
import { useMemoryStore } from '../stores/memoryStore';
import { useBucketStore } from '../stores/bucketStore';
import { usePrayerStore } from '../stores/prayerStore';
import { Card, Button, Modal } from '../components/UI';
import { T, CONTEXT, ThemeName, THEME_LABELS } from '../theme';
import { getTogetherSince, setTogetherSince, getFunDurationSince } from '../services/togetherSince';

interface HomeProps {
  onNavigate: (tab: string) => void;
  theme: ThemeName;
  onCycleTheme: () => void;
  onOpenColorEditor: () => void;
}

const REDECOUVERTE_LINES = [
  'Il y a quelque temps...',
  'Un instant à redécouvrir.',
  'Vous aviez presque oublié ça.',
  'Une envie qui attend toujours.',
  'Ce jour-là.',
];

const POSITIVE_MESSAGES = [
  'Chaque instant partagé construit votre histoire.',
  'Une petite attention peut créer un grand souvenir.',
  "Et si aujourd'hui devenait un instant à revivre ?",
  'Chaque jour est une nouvelle page de votre histoire.',
  'Les plus beaux souvenirs commencent souvent simplement.',
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bel après-midi';
  if (h >= 18 && h < 23) return 'Bonsoir';
  return 'On ne dort pas ?';
}

export const HomePage: React.FC<HomeProps> = ({ onNavigate, theme, onCycleTheme, onOpenColorEditor }) => {
  const memories = useMemoryStore((s) => s.memories);
  const bucketItems = useBucketStore((s) => s.items);
  const prayerTopics = usePrayerStore((s) => s.topics);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greeting = useMemo(() => getGreeting(), []);
  const positiveMessage = useMemo(
    () => POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)],
    []
  );
  const redecouverteLine = useMemo(
    () => REDECOUVERTE_LINES[Math.floor(Math.random() * REDECOUVERTE_LINES.length)],
    []
  );

  const [togetherSince, setTogetherSinceState] = useState(getTogetherSince());
  const funDuration = useMemo(
    () => (togetherSince ? getFunDurationSince(togetherSince) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [togetherSince]
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInput, setDateInput] = useState(togetherSince || '');

  const saveTogetherSince = () => {
    if (!dateInput) return;
    setTogetherSince(dateInput);
    setTogetherSinceState(dateInput);
    setShowDatePicker(false);
  };

  // Pioche un élément à redécouvrir : un instant, une envie non faite, ou une prière — au hasard.
  const redecouverte = useMemo(() => {
    const pool: { type: 'instant' | 'envie' | 'priere'; label: string }[] = [];
    if (memories.length > 0) {
      const m = memories[Math.floor(Math.random() * memories.length)];
      pool.push({ type: 'instant', label: m.text.slice(0, 60) });
    }
    const pendingEnvies = bucketItems.filter((i) => !i.completed);
    if (pendingEnvies.length > 0) {
      const e = pendingEnvies[Math.floor(Math.random() * pendingEnvies.length)];
      pool.push({ type: 'envie', label: e.title });
    }
    const activePrayers = prayerTopics.filter((p) => p.category === 'toport');
    if (activePrayers.length > 0) {
      const p = activePrayers[Math.floor(Math.random() * activePrayers.length)];
      pool.push({ type: 'priere', label: p.title });
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [memories, bucketItems, prayerTopics]);

  const redecouverteTarget = (type: string) => {
    if (type === 'instant') return 'instants';
    if (type === 'envie') return 'envies';
    return 'priere';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80, position: 'relative' }}>
      {/* Forme organique très discrète, en arrière-plan, pour une identité
          visuelle reconnaissable sans tomber dans le cliché romantique. */}
      <svg
        width="220" height="220" viewBox="0 0 220 220"
        style={{ position: 'absolute', top: -60, right: -70, zIndex: 0, opacity: 0.5, pointerEvents: 'none' }}
      >
        <path
          d="M110 10C150 10 200 40 205 90C210 140 170 190 115 205C60 220 15 180 10 125C5 70 70 10 110 10Z"
          fill={CONTEXT.instants}
          opacity={0.08}
        />
      </svg>

      <button
        onClick={onCycleTheme}
        onTouchStart={() => (longPressTimer.current = setTimeout(onOpenColorEditor, 600))}
        onTouchEnd={() => longPressTimer.current && clearTimeout(longPressTimer.current)}
        onMouseDown={() => (longPressTimer.current = setTimeout(onOpenColorEditor, 600))}
        onMouseUp={() => longPressTimer.current && clearTimeout(longPressTimer.current)}
        onMouseLeave={() => longPressTimer.current && clearTimeout(longPressTimer.current)}
        title={`Thème : ${THEME_LABELS[theme]} — appui long pour l'éditeur de couleurs`}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 1,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          color: T.muted,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Palette size={16} />
      </button>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: T.ink }}>{greeting}</h1>
        <p style={{ fontSize: 15, color: T.muted, margin: '6px 0 0 0' }}>
          {positiveMessage}
        </p>
      </div>

      {togetherSince ? (
        <button
          onClick={() => setShowDatePicker(true)}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: T.font, fontSize: 12.5, color: T.muted, padding: 0, zIndex: 1,
          }}
        >
          Ensemble depuis {funDuration} ✨
        </button>
      ) : (
        <button
          onClick={() => setShowDatePicker(true)}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: T.font, fontSize: 12.5, color: T.muted, padding: 0, textDecoration: 'underline', zIndex: 1,
          }}
        >
          Depuis quand êtes-vous ensemble ?
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1 }}>
        <SofaButton
          icon={<Image size={18} />}
          label="Retrouver un instant"
          color={CONTEXT.instants}
          onClick={() => onNavigate('instants')}
        />
        <SofaButton
          icon={<Users size={18} />}
          label="Faire quelque chose à deux"
          color={CONTEXT.adeux}
          onClick={() => onNavigate('adeux')}
        />
        <SofaButton
          icon={<Sparkles size={18} />}
          label="Piocher une envie"
          color={CONTEXT.envies}
          onClick={() => onNavigate('envies')}
        />
        <SofaButton
          icon={<HandHeart size={18} />}
          label="Prendre un temps de prière"
          color={CONTEXT.priere}
          onClick={() => onNavigate('priere')}
        />
      </div>

      {redecouverte && (
        <Card
          onClick={() => onNavigate(redecouverteTarget(redecouverte.type))}
          style={{ cursor: 'pointer', zIndex: 1 }}
        >
          <p style={{ fontSize: 11, color: T.muted, margin: '0 0 6px 0', letterSpacing: 0.3 }}>
            {redecouverteLine}
          </p>
          <p style={{ fontSize: 14, color: T.ink, margin: 0, lineHeight: 1.4 }}>
            {redecouverte.label}
          </p>
        </Card>
      )}

      <Modal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} title="Ensemble depuis...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            style={{
              border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '12px 16px',
              fontFamily: T.font, fontSize: 14, color: T.ink, background: T.surface,
            }}
          />
          <Button full onClick={saveTogetherSince} disabled={!dateInput}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
};

interface SofaButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

const SofaButton: React.FC<SofaButtonProps> = ({ icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: '16px 18px',
      cursor: 'pointer',
      fontFamily: T.font,
      textAlign: 'left',
      width: '100%',
      transition: 'transform 0.2s ease-out',
    }}
  >
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: `${color}22`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
    <span style={{ fontSize: 15, fontWeight: 500, color: T.ink }}>{label}</span>
  </button>
);
