import { useState } from 'react';
import { Avatar, AvatarTeil, AVATAR_LABELS, AVATAR_TEILE, avatarAnzahl, randomAvatar, sanitizeAvatar, cryptoRng } from '@kronen/shared';
import { AvatarFace, Figur, HAAR, HAUT } from './Avatar';
import { Modal } from './ui';

const KEY = 'kj_avatar';

/** Zuletzt gestaltete Figur dieses Geräts (für die nächste Lobby) */
export function savedAvatar(): Avatar | null {
  try {
    return sanitizeAvatar(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
}
function saveAvatar(a: Avatar) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* privater Modus */
  }
}

/**
 * Figur gestalten: große Vorschau (Porträt + Spielfigur), Kategorien als Reiter,
 * Auswahl als kleine Vorschaubilder. Optional mit Namensfeld.
 */
export function AvatarEditor({ initial, color, name, onSave, onClose }: {
  initial: Avatar;
  color: string;
  /** mit Namensfeld (Lobby) */
  name?: string;
  onSave: (a: Avatar, name?: string) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<Avatar>(initial);
  const [tab, setTab] = useState<AvatarTeil>('kopf');
  const [nm, setNm] = useState(name ?? '');
  const n = avatarAnzahl(tab);
  const swatch = (i: number) => {
    if (tab === 'haut') return <span className="av-color" style={{ background: HAUT[i] }} />;
    if (tab === 'haar') return <span className="av-color" style={{ background: HAAR[i] }} />;
    return <AvatarFace a={{ ...a, [tab]: i }} color={color} />;
  };
  const save = () => {
    saveAvatar(a);
    onSave(a, name !== undefined ? nm.trim() : undefined);
  };
  return (
    <Modal onClose={onClose}>
      <div className="panel av-editor">
        <div className="av-preview">
          <span className="av-face"><AvatarFace a={a} color={color} /></span>
          <span className="av-figur"><Figur a={a} color={color} /></span>
          <div className="av-side">
            <h3 style={{ margin: 0 }}>Deine Figur</h3>
            {name !== undefined && (
              <input className="input" value={nm} maxLength={14} onChange={(e) => setNm(e.target.value)} placeholder="Dein Name" aria-label="Name" />
            )}
            <button className="btn sm" onClick={() => setA(randomAvatar(cryptoRng))}>🎲 Zufall</button>
          </div>
        </div>
        <div className="av-tabs" role="tablist">
          {AVATAR_TEILE.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className={`av-tab ${t === tab ? 'on' : ''}`} onClick={() => setTab(t)}>
              {AVATAR_LABELS[t].titel}
            </button>
          ))}
        </div>
        <div className="av-grid">
          {Array.from({ length: n }, (_, i) => (
            <button key={i} className={`av-opt ${a[tab] === i ? 'on' : ''}`} onClick={() => setA({ ...a, [tab]: i })} title={AVATAR_LABELS[tab].namen[i]}>
              {swatch(i)}
              <span className="av-opt-name">{AVATAR_LABELS[tab].namen[i]}</span>
            </button>
          ))}
        </div>
        <div className="row center" style={{ gap: 10 }}>
          <button className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn green" onClick={save} disabled={name !== undefined && (nm.trim().length < 2 || nm.trim().length > 14)}>Fertig</button>
        </div>
      </div>
    </Modal>
  );
}
