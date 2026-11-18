import { useRef, useState } from 'react';
import { BOARD, BoardData, BoardField, FieldType } from '@kronen/shared';
import { boardImg } from '../mode2/common';

const TYPES: FieldType[] = ['normal', 'plus2', 'minus2', 'ereignis', 'wiederholung', 'minispiel'];

/**
 * Entwickler-Werkzeug: Felder 1 bis 76 nacheinander anklicken (oder einzelne korrigieren)
 * und die board.json exportieren. Vorbelegt mit den aktuellen Koordinaten.
 */
export default function FeldEditor() {
  const [fields, setFields] = useState<BoardField[]>(() => structuredClone(BOARD.data.fields));
  const [cur, setCur] = useState(1);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const click = (e: React.MouseEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 10000) / 100;
    const y = Math.round(((e.clientY - r.top) / r.height) * 10000) / 100;
    setFields((fs) => fs.map((f) => (f.id === cur ? { ...f, x, y } : f)));
    setCur((c) => (c >= fields.length ? c : c + 1));
  };
  const data: BoardData = { ...BOARD.data, fields };
  const json = JSON.stringify(data, null, 1);
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'board.json';
    a.click();
  };
  const f = fields.find((x) => x.id === cur)!;
  return (
    <div style={{ padding: 10, fontSize: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <b>Feld-Editor</b>
        <span>Nächster Klick setzt Feld</span>
        <input type="number" min={1} max={fields.length} value={cur} onChange={(e) => setCur(Number(e.target.value))} style={{ width: 70 }} />
        <select value={f.type} onChange={(e) => setFields((fs) => fs.map((x) => (x.id === cur ? { ...x, type: e.target.value as FieldType } : x)))}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label>Nachbarn (vorwärts): <input value={f.next.join(',')} onChange={(e) => setFields((fs) => fs.map((x) => (x.id === cur ? { ...x, next: e.target.value.split(',').map(Number).filter(Boolean) } : x)))} style={{ width: 90 }} /></label>
        <button className="btn sm" onClick={download}>⬇ board.json</button>
        <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(json); setCopied(true); }}>{copied ? 'Kopiert!' : 'JSON kopieren'}</button>
        <a href="#/dev/board-debug" style={{ color: '#ffd970' }}>Debug-Ansicht</a>
      </div>
      <div style={{ position: 'relative', maxWidth: 1586, cursor: 'crosshair' }} onClick={click}>
        <img ref={imgRef} src={boardImg} style={{ width: '100%', display: 'block' }} alt="Spielbrett" draggable={false} />
        {fields.map((x) => (
          <span key={x.id} style={{ position: 'absolute', left: `${x.x}%`, top: `${x.y}%`, transform: 'translate(-50%,-50%)', width: 24, height: 24, borderRadius: '50%', background: x.id === cur ? '#ff4081' : 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #00e5ff', pointerEvents: 'none' }}>{x.id}</span>
        ))}
      </div>
      <p>Speichere die exportierte Datei als <code>client/src/board/board.json</code>.</p>
    </div>
  );
}
