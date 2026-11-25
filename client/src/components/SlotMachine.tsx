import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameId } from '@kronen/shared';
import { Confetti } from './Decor';

/** Symbol je Minispiel auf der Walze */
export const GAME_ICON: Record<GameId, string> = {
  game7: '🏓',
  kopfrechnen: '🧮',
  stirnraten: '🤔',
  gegenstaende: '🧸',
  slf: '🌍',
  schaetzen: '📏',
  montagsmaler: '🎨',
  zahlen: '🔢',
  wissen: '🧠',
  begriffe: '💬',
  flunker: '🤥',
  huehner: '🐔',
  flitzer: '🏎️',
  songs: '🎵',
};

interface Item {
  id: GameId;
  name: string;
}

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BULBS = 14;

/**
 * Einarmiger Bandit für die Spielauslosung: Hebel wird gezogen, die Walze mit allen
 * Minispielen dreht sich, wird langsamer und rastet auf dem ausgelosten Spiel ein.
 */
export function GameSlotMachine({
  games, final, size = 'screen', duration = 3400, quick, title = 'Minispiel', onDone,
}: {
  games: Item[];
  final: Item;
  size?: 'host' | 'phone' | 'screen';
  /** Spinndauer (ms) */
  duration?: number;
  /** kurzer Dreh (Spiel wurde ausgesucht) */
  quick?: boolean;
  title?: string;
  onDone?: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [pulled, setPulled] = useState(false);
  const [won, setWon] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const spin = quick ? Math.min(duration, 1700) : duration;

  // Walze: mehrere gemischte Durchläufe, am Ende das ausgeloste Spiel in der Mitte
  const { items, finalIdx } = useMemo(() => {
    const others = games.filter((g) => g.id !== final.id);
    const pool = others.length ? others : [final];
    const want = quick ? 14 : 34;
    const out: Item[] = [];
    while (out.length < want) out.push(...shuffled(pool));
    out.length = want;
    // über und unter dem Ziel zwei verschiedene Spiele
    const before = out[out.length - 1];
    const after = shuffled(pool).find((g) => g.id !== before.id) ?? pool[0];
    return { items: [...out, final, after], finalIdx: out.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final.id]);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const row = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect().height ?? 60;
    const end = -(finalIdx - 1) * row;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof el.animate !== 'function') {
      el.style.transform = `translateY(${end}px)`;
      setWon(true);
      doneRef.current?.();
      return;
    }
    setPulled(true);
    const anims: Animation[] = [];
    const start = setTimeout(() => {
      const over = row * 0.28;
      const a = el.animate(
        [
          { transform: 'translateY(0px)', easing: 'cubic-bezier(0.32, 0, 0.12, 1)' },
          { transform: `translateY(${end - over}px)`, offset: 0.9, easing: 'ease-in-out' },
          { transform: `translateY(${end}px)` },
        ],
        { duration: spin, fill: 'forwards' },
      );
      anims.push(a);
      anims.push(
        el.animate(
          [{ filter: 'blur(0px)' }, { filter: 'blur(2.5px)', offset: 0.18 }, { filter: 'blur(1.2px)', offset: 0.55 }, { filter: 'blur(0px)', offset: 0.8 }, { filter: 'blur(0px)' }],
          { duration: spin, fill: 'forwards' },
        ),
      );
      a.onfinish = () => {
        setWon(true);
        doneRef.current?.();
      };
    }, 320);
    return () => {
      clearTimeout(start);
      anims.forEach((a) => a.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final.id]);

  return (
    <div className={`sm-wrap ${size} ${won ? 'won' : ''}`}>
      {won && <Confetti duration={2200} />}
      <div className="sm-machine">
        <div className="sm-top">
          <div className="sm-bulbs">
            {Array.from({ length: BULBS }, (_, i) => (
              <span key={i} className="sm-bulb" style={{ animationDelay: `${(i % 2) * 0.35}s`, ['--i' as string]: i }} />
            ))}
          </div>
          <div className="sm-title">{title}</div>
        </div>
        <div className="sm-window">
          <div className="sm-reel">
            <div className="sm-strip" ref={strip}>
              {items.map((g, i) => (
                <div key={i} className={`sm-item ${i === finalIdx && won ? 'hit' : ''}`}>
                  <span className="sm-icon">{GAME_ICON[g.id] ?? '🎮'}</span>
                  <span className={`sm-name ${g.name.length > 17 ? 'xs' : g.name.length > 13 ? 'sm' : ''}`}>{g.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="sm-glass" />
          <div className="sm-payline">
            <span className="sm-arrow l" />
            <span className="sm-arrow r" />
          </div>
        </div>
        <div className="sm-bottom">
          <span className="sm-coin" />
          <span className="sm-star">★</span>
          <span className="sm-coin" />
        </div>
      </div>
      <div className={`sm-lever ${pulled ? 'pull' : ''}`} aria-hidden>
        <div className="sm-lever-arm">
          <span className="sm-lever-ball" />
        </div>
        <div className="sm-lever-base" />
      </div>
    </div>
  );
}
