import { BOARD } from '@kronen/shared';
import { boardImg } from '../mode2/common';

const COLORS: Record<string, string> = { normal: '#ffffff', plus2: '#4caf50', minus2: '#f44336', ereignis: '#2196f3', wiederholung: '#ffeb3b', minispiel: '#9c27b0' };

/** Debug-Overlay: Nummern, Typen und Verbindungen über dem Brettbild */
export default function BoardDebug() {
  const f = BOARD.data.fields;
  const W = BOARD.data.width;
  const H = BOARD.data.height;
  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ fontSize: 20 }}>Board-Debug – {f.length} Felder · Linien = Verbindungen, pink = an Weichen · <a href="#/dev/feld-editor" style={{ color: '#ffd970' }}>Feld-Editor</a></h2>
      <div style={{ position: 'relative', width: '100%', maxWidth: 1586 }} id="board-debug">
        <img src={boardImg} style={{ width: '100%', display: 'block' }} alt="Spielbrett" />
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill="#00e5ff" />
            </marker>
          </defs>
          {f.flatMap((a) =>
            a.neighbors.filter((n) => n > a.id).map((n) => {
              const b = BOARD.byId.get(n)!;
              const x1 = (a.x / 100) * W, y1 = (a.y / 100) * H, x2 = (b.x / 100) * W, y2 = (b.y / 100) * H;
              const branch = (BOARD.adj.get(a.id)?.length ?? 0) > 2 || (BOARD.adj.get(n)?.length ?? 0) > 2;
              return <line key={`${a.id}-${n}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={branch ? '#ff4081' : '#00e5ff'} strokeWidth={branch ? 4 : 3} />;
            }),
          )}
          {f.map((a) => (
            <g key={a.id}>
              <circle cx={(a.x / 100) * W} cy={(a.y / 100) * H} r={13} fill="rgba(0,0,0,.65)" stroke={COLORS[a.type]} strokeWidth={4} />
              <text x={(a.x / 100) * W} y={(a.y / 100) * H + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill="#fff">{a.id}</text>
            </g>
          ))}
        </svg>
      </div>
      <p style={{ fontSize: 16 }}>Felder mit mehr als zwei Nachbarn sind Weichen: Dort entscheidet der Spieler die Richtung neu.</p>
    </div>
  );
}
