import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOARD, BaseView, PublicPlayer, Crown, MoveOption, gameById, CARD_TEXT } from '@kronen/shared';
import boardImg from '@assets/spielbrett.png';
import { TokenSvg, CrownSvg, ControllerSvg } from '../components/icons';
import { useServerClock } from '../lib/hooks';

export { boardImg };

/** true = der Hauptscreen läuft im Hochformat */
const PortraitCtx = createContext(false);
export const usePortrait = () => useContext(PortraitCtx);

/**
 * Bühne für den Hauptscreen.
 * Querformat: feste 16:9-Bühne (1920×1080), die auf jede Bildschirmgröße skaliert wird.
 * Hochformat: 1080 px breite Spalte, skaliert auf die Gerätebreite, nach unten scrollbar.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [dim, setDim] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    const on = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (dim.h > dim.w) {
    const scale = dim.w / 1080;
    return (
      <PortraitCtx.Provider value={true}>
        <div className="pstage-outer">
          <div className="pstage" style={{ zoom: scale, minHeight: dim.h / scale } as React.CSSProperties}>{children}</div>
        </div>
      </PortraitCtx.Provider>
    );
  }
  const scale = Math.min(dim.w / 1920, dim.h / 1080);
  return (
    <PortraitCtx.Provider value={false}>
      <div className="stage-outer">
        <div className="stage" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
    </PortraitCtx.Provider>
  );
}

/** Restzeit in Sekunden bis zu einem Server-Zeitpunkt */
export function useLeft(view: BaseView | null, until: number | null | undefined): number | null {
  const now = useServerClock(view?.serverNow);
  if (!until || until < 0 || until > 1e14) return null;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Anzeigename mit Bot-Symbol */
export const displayName = (p: { name: string; bot?: unknown }) => (p.bot ? '🤖 ' + p.name : p.name);
/** Buchstabe bzw. Symbol auf der Spielfigur */
export const tokenLetter = (p: { name: string; bot?: unknown }) => (p.bot ? '🤖' : p.name.slice(0, 1).toUpperCase());
export const playerName = (v: BaseView, id: string | null | undefined) => {
  const p = v.players.find((x) => x.id === id);
  return p ? displayName(p) : '?';
};
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
  /** Richtung durch Antippen des Bretts wählen (Schlüssel der Option) */
  onPick?: (key: string) => void;
}

/** Farben für die Richtungsoptionen auf dem Brett */
export const OPTION_COLORS = ['#66bb6a', '#4fc3f7', '#ffb74d', '#f06292'];

/** Felder, die im Brettbild noch nicht als Sonderfeld gemalt sind (App zeichnet sie) */
const MARKED = BOARD.data.fields.filter((f) => f.markieren);

/**
 * Das Brett mit Figuren und Kronen (Positionen in Prozent -> passt zu jeder Auflösung).
 * Mit `onPick` kann der Spieler einen hervorgehobenen Weg direkt auf dem Brett antippen.
 */
export function BoardLayer({ view, previews, highlight, jump, onPick }: BoardProps) {
  const off = tokenOffsets(view.players);
  const pick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPick || !previews?.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // nächstes hervorgehobenes Feld; Tippfläche mind. 44 px (Radius 26 px)
    const radius = Math.max(26, r.width * 0.03);
    let best: { key: string; d: number } | null = null;
    for (const o of previews)
      for (const f of o.path) {
        const { x, y } = fieldXY(f);
        const d = Math.hypot((x / 100) * r.width - px, (y / 100) * r.height - py);
        if (d <= radius && (!best || d < best.d)) best = { key: o.key, d };
      }
    if (best) onPick(best.key);
  };
  return (
    <div className={`board-wrap ${onPick && previews?.length ? 'pickable' : ''}`} onClick={pick}>
      <img className="board-img" src={boardImg} alt="Spielbrett" draggable={false} />
      {MARKED.map((f) => (
        <span key={f.id} className={`field-mark ${f.type}`} style={{ left: `${f.x}%`, top: `${f.y}%` }} title={`Feld ${f.id}`}>
          {f.type === 'minispiel' && <ControllerSvg size="72%" />}
          <span className="field-mark-nr">{f.id}</span>
        </span>
      ))}
      {previews?.map((o, k) => {
        const col = OPTION_COLORS[k % OPTION_COLORS.length];
        const t = fieldXY(o.target);
        return (
          <div key={o.key}>
            {o.path.slice(0, -1).map((f, i) => {
              const { x, y } = fieldXY(f);
              return <span key={i} className="path-dot" style={{ left: `${x}%`, top: `${y}%`, background: col, boxShadow: `0 0 0 3px ${col}55` }} />;
            })}
            <span className={`preview-mark ${o.final ? 'final' : 'weiche'}`} style={{ left: `${t.x}%`, top: `${t.y}%`, borderColor: col, background: col + '44', boxShadow: `0 0 18px ${col}` }} />
          </div>
        );
      })}
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
            <TokenSvg color={p.color} letter={tokenLetter(p)} />
          </div>
        );
      })}
    </div>
  );
}

/** Größe des Fensters (aktualisiert bei Drehen/Größenänderung) */
export function useViewport() {
  const [d, setD] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setD({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return d;
}

/** Kann der Browser Vollbild + Querformat erzwingen? (Android/Chrome ja, iPhone nein) */
export function canLockLandscape(): boolean {
  const so = (screen as any).orientation;
  return !!(document.fullscreenEnabled && so && typeof so.lock === 'function');
}

export async function lockLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await (screen as any).orientation.lock('landscape');
  } catch {
    /* nicht erlaubt – dann bleibt es beim Hinweis */
  }
}

/** Hinweis im Hochformat während des Spiels */
export function RotateHint({ big, text }: { big?: boolean; text?: string }) {
  return (
    <div className="rotate-banner" style={big ? { fontSize: 34, padding: '18px 26px' } : undefined}>
      <span className="rotate-icon" aria-hidden>📱</span>
      <span className="grow">
        <b>Bitte Gerät drehen</b>
        <br />
        <span className="small">{text ?? 'Gespielt wird im Querformat – dann füllt das Brett den ganzen Bildschirm.'}</span>
      </span>
      {canLockLandscape() && <button className="btn sm gold" onClick={lockLandscape}>Vollbild & Querformat</button>}
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
              {view.turnPlayerId === p.id ? '▶ ' : ''}{displayName(p)}
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
      return `${cur} wählt die Richtung (noch ${ph.remaining} ${ph.remaining === 1 ? 'Feld' : 'Felder'})`;
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

export function ConnBanner({ status }: { status: string }) {
  if (status === 'open') return null;
  return (
    <div style={{ position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 80 }} className="badge red">
      Verbindung wird wiederhergestellt …
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
