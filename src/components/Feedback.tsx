import React, { useRef, useState } from 'react';
import { useUndo } from '../stores/undoStore';

/** Bandeau en bas d'écran : « Coché. Annuler ». */
export const UndoToast: React.FC = () => {
  const { message, undo, key, hide } = useUndo();
  if (!message) return null;
  return (
    <div key={key} className="undo-toast" role="status">
      <span>{message}</span>
      {undo && (
        <button
          onClick={() => {
            undo();
            hide();
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
};

/**
 * Ligne qu'on peut faire glisser : vers la droite pour l'action principale
 * (cocher), vers la gauche pour ouvrir les options. Un appui long ouvre
 * aussi les options, et le bouton « ⋯ » reste là pour qui ne glisse pas.
 */
export const SwipeRow: React.FC<{
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightColor?: string;
}> = ({ children, onSwipeRight, onSwipeLeft, rightLabel = 'Cocher', leftLabel = 'Options', rightColor = 'var(--accent)' }) => {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THRESHOLD = 80;

  const clearLong = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  const onStart = (x: number, y: number) => {
    start.current = { x, y, locked: null };
    if (onSwipeLeft) longPress.current = setTimeout(() => { start.current = null; setDx(0); onSwipeLeft(); }, 550);
  };
  const onMove = (x: number, y: number) => {
    const s = start.current;
    if (!s) return;
    const mx = x - s.x;
    const my = y - s.y;
    if (Math.abs(mx) > 6 || Math.abs(my) > 6) clearLong();
    if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.locked = Math.abs(mx) > Math.abs(my);
    if (!s.locked) return;
    const limited = mx > 0 ? (onSwipeRight ? Math.min(mx, 140) : 0) : onSwipeLeft ? Math.max(mx, -140) : 0;
    setDx(limited);
  };
  const onEnd = () => {
    clearLong();
    if (dx > THRESHOLD) onSwipeRight?.();
    else if (dx < -THRESHOLD) onSwipeLeft?.();
    start.current = null;
    setDx(0);
  };

  return (
    <div className="swipe-row">
      <div className="swipe-bg" style={{ background: dx > 0 ? rightColor : 'var(--paper2)', justifyContent: dx > 0 ? 'flex-start' : 'flex-end' }}>
        <span style={{ color: dx > 0 ? 'var(--accent-ink)' : 'var(--ink)', opacity: Math.min(1, Math.abs(dx) / THRESHOLD) }}>
          {dx > 0 ? rightLabel : dx < 0 ? leftLabel : ''}
        </span>
      </div>
      <div
        className="swipe-fg"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform 0.2s ease-out' }}
        onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        onContextMenu={(e) => {
          if (onSwipeLeft) {
            e.preventDefault();
            onSwipeLeft();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
};
