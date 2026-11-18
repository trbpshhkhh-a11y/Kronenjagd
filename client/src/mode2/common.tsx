import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOARD, BaseView, PublicPlayer, Crown, MoveOption, gameById, CARD_TEXT } from '@kronen/shared';
import boardImg from '@assets/spielbrett.png';
import { TokenSvg, CrownSvg } from '../components/icons';
import { useServerClock } from '../lib/hooks';

export { boardImg };

/** Feste 16:9-Bühne (1920×1080), die auf jede Bildschirmgröße skaliert wird */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const on = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return (
    <div className="stage-outer">
      <div className="stage" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

/** Restzeit in Sekunden bis zu einem Server-Zeitpunkt */
export function useLeft(view: BaseView | null, until: number | null | undefined): number | null {
  const now = useServerClock(view?.serverNow);
  if (!until || until < 0 || until > 1e14) return null;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export const playerName = (v: BaseView, id: string | null | undefined) => v.players.find((p) => p.id === id)?.name ?? '?';
export const playerOf = (v: BaseView, id: string | null | undefined) => v.players.find((p) => p.id === id);

function fieldXY(id: number) {
  const f = BOARD.byId.get(id);
  return f ? { x: f.x, y: f.y } : { x: 50, y: 50 };
}

/** Versatz für mehrere Figuren auf einem Feld */
function tokenOffsets(players: PublicPlayer[]) {
  const byField = new Map<number, string[]>();
  for (const p of players) {
    if (!p.pos) continue;
    byField.set(p.pos, [...(byField.get(p.pos) ?? []), p.id]);
  }
  const off = new Map<string, number>();
  for (const ids of byField.values()) ids.forEach((id, i) => off.set(id, (i - (ids.length - 1) / 2) * 2.1));
  return off;
}

export interface BoardProps {
  view: BaseView;
  previews?: MoveOption[];
  highlight?: string | null;
  jump?: boolean;
}

/** Das Brett mit Figuren und Kronen (Positionen in Prozent -> passt zu jeder Auflösung) */
export function BoardLayer({ view, previews, highlight, jump }: BoardProps) {
  const off = tokenOffsets(view.players);
  return (
    <div className="board-wrap">
      <img className="board-img" src={boardImg} alt="Spielbrett" draggable={false} />
      {previews?.map((o) => (
        <div key={o.key}>
          {o.path.slice(0, -1).map((f, i) => {
            const { x, y } = fieldXY(f);
            return <span key={i} className="path-dot" style={{ left: `${x}%`, top: `${y}%`, background: o.dir === 'vor' ? '#66bb6a' : '#64b5f6' }} />;
          })}
          {(() => {
            const { x, y } = fieldXY(o.target);
            return <span className="preview-mark" style={{ left: `${x}%`, top: `${y}%`, borderColor: o.dir === 'vor' ? '#66bb6a' : '#64b5f6', background: o.dir === 'vor' ? 'rgba(102,187,106,.35)' : 'rgba(100,181,246,.35)' }}>{o.dir === 'vor' ? '▶' : '◀'}</span>;
          })()}
        </div>
      ))}
      {view.crowns.map((c: Crown) => {
        const { x, y } = fieldXY(c.field);
        return (
          <div key={c.id} className={`crown-token ${c.value === 2 ? 'big' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <CrownSvg big={c.value === 2} />
            {c.value === 2 && <span className="x2">x2</span>}
          </div>
        );
      })}
      {view.players.filter((p) => p.pos > 0).map((p) => {
        const { x, y } = fieldXY(p.pos);
        const dx = off.get(p.id) ?? 0;
        return (
          <div key={p.id} className={`token ${highlight === p.id ? 'turn' : ''} ${jump ? 'jump' : ''}`} style={{ left: `${x + dx}%`, top: `${y}%` }} title={p.name}>
            <TokenSvg color={p.color} letter={p.name.slice(0, 1).toUpperCase()} />
          </div>
        );
      })}
    </div>
  );
}

/** Brettausschnitt um ein Feld (Handy) */
export function BoardSnippet({ view, center, zoom = 3, previews, highlight, aspect = 4 / 3 }: BoardProps & { center: number; zoom?: number; aspect?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const h = w / aspect;
  const innerW = w * zoom;
  const innerH = innerW * (BOARD.data.height / BOARD.data.width);
  const { x, y } = fieldXY(center);
  let left = w / 2 - (x / 100) * innerW;
  let top = h / 2 - (y / 100) * innerH;
  left = Math.min(0, Math.max(w - innerW, left));
  top = Math.min(0, Math.max(h - innerH, top));
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: h, overflow: 'hidden', borderRadius: 16, border: '4px solid var(--metal)', boxShadow: '0 8px 20px rgba(0,0,0,.5)' }}>
      <div style={{ position: 'absolute', width: innerW, left, top, transition: 'left .4s, top .4s' }}>
        <BoardLayer view={view} previews={previews} highlight={highlight} />
      </div>
    </div>
  );
}

/** Kleine Kronentafel */
export function CrownTable({ view, compact }: { view: BaseView; compact?: boolean }) {
  const sorted = [...view.players].sort((a, b) => b.kronen - a.kronen);
  return (
    <div className="panel dark" style={{ padding: compact ? 10 : 18, minWidth: 300 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="head gold">Kronen</span>
        <span className="small">Ziel: {view.settings.kronenZumSieg} 👑</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {sorted.map((p) => (
          <div key={p.id} className="row" style={{ gap: 10, opacity: p.connected ? 1 : 0.5 }}>
            <span className="dot" style={{ background: p.color }} />
            <span className="grow" style={{ fontWeight: 800, outline: view.turnPlayerId === p.id ? undefined : undefined }}>
              {view.turnPlayerId === p.id ? '▶ ' : ''}{p.name}
            </span>
            {p.bonus > 0 && <span className="badge green">+{p.bonus}</span>}
            <span className="head" style={{ minWidth: '1.6em', textAlign: 'right' }}>{p.kronen}</span>
            <CrownSvg size="1.2em" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kurzer Text: was passiert gerade? */
export function statusText(v: BaseView): string {
  const cur = playerName(v, v.turnPlayerId);
  const ph = v.phase;
  switch (ph.k) {
    case 'lobby':
      return 'Warten auf den Start …';
    case 'intro':
      return 'Startfelder und Reihenfolge werden ausgelost …';
    case 'wuerfeln':
      return `${cur} ist dran und würfelt …`;
    case 'gewuerfelt':
      return ph.bonus > 0 ? `${cur} würfelt ${ph.wurf} + ${ph.bonus} Bonus = ${ph.total} Felder` : `${cur} würfelt … ${ph.wurf}!`;
    case 'richtung':
      return `${cur} wählt die Richtung (${ph.total} Felder)`;
    case 'bewegen':
      return ph.grund === 'plus2' ? `${cur}: +2 Felder` : ph.grund === 'minus2' ? `${cur}: −2 Felder` : `${cur} zieht …`;
    case 'karteZiehen':
      return `${cur} zieht eine Ereigniskarte`;
    case 'karte':
      return `${cur}: ${CARD_TEXT[ph.card].titel}`;
    case 'minispiel':
      return v.mini ? `Minispiel: ${gameById(v.mini.game).name}` : 'Minispiel';
    case 'sieg':
      return `${playerName(v, ph.winner)} gewinnt!`;
  }
}

export function ConnBanner({ status, hostConnected }: { status: string; hostConnected?: boolean }) {
  if (status === 'open' && hostConnected !== false) return null;
  return (
    <div style={{ position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 80 }} className="badge red">
      {status !== 'open' ? 'Verbindung wird wiederhergestellt …' : 'Der Hauptscreen ist gerade nicht verbunden.'}
    </div>
  );
}

/** Toast für neue Ereignisse (Kronen usw.) */
export function useToast(view: BaseView | null) {
  const [shown, setShown] = useState<{ text: string; kind: string } | null>(null);
  const last = useRef<number>(view?.toast?.seq ?? 0);
  useEffect(() => {
    const t = view?.toast;
    if (!t || t.seq === last.current) return;
    last.current = t.seq;
    setShown({ text: t.text, kind: t.kind });
    const id = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(id);
  }, [view?.toast?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}
