import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import { LiedMeta, liederLaden, liederHinzufuegen, liedSpeichern, liedLoeschen, ausschnitt } from '../lib/eigeneLieder';
import { pufferAbspielen, unlockAudio } from '../lib/melody';

const zeit = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Eigene Lieder verwalten: Musikdateien auswählen (bleiben auf diesem Gerät), Titel prüfen,
 * Ausschnitt wählen und rückwärts probehören. onFertig bekommt die aktuelle Liste.
 */
export function EigeneLiederFenster({ onFertig, onClose }: { onFertig: (l: LiedMeta[]) => void; onClose: () => void }) {
  const [lieder, setLieder] = useState<LiedMeta[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string[]>([]);
  const [spielt, setSpielt] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    liederLaden().then(setLieder);
    return () => stop.current?.();
  }, []);

  const hinzu = async (files: FileList | null) => {
    if (!files?.length) return;
    unlockAudio();
    setFehler([]);
    const { neu, fehler } = await liederHinzufuegen([...files], (f, g) => setBusy(`Lese Lieder … ${f}/${g}`));
    setBusy(null);
    setFehler(fehler);
    if (neu.length) setLieder(await liederLaden());
  };
  const aendern = (m: LiedMeta) => setLieder((l) => l?.map((x) => (x.id === m.id ? m : x)) ?? null);
  const speichern = (m: LiedMeta) => liedSpeichern(m).catch(() => {});
  const hoeren = async (m: LiedMeta, rueckwaerts: boolean) => {
    stop.current?.();
    unlockAudio();
    if (spielt === m.id + rueckwaerts) {
      setSpielt(null);
      return;
    }
    try {
      setSpielt(m.id + rueckwaerts);
      const a = await ausschnitt(m.id, m.start, m.laenge);
      stop.current = pufferAbspielen(rueckwaerts ? a.rueck : a.vor, {});
      setTimeout(() => setSpielt((x) => (x === m.id + rueckwaerts ? null : x)), m.laenge * 1000);
    } catch {
      setSpielt(null);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="panel stack el-fenster">
        <div className="row between" style={{ flexWrap: 'nowrap' }}>
          <h3 style={{ margin: 0 }}>Eigene Lieder</h3>
          <span className="badge">{lieder?.length ?? 0}</span>
        </div>
        <p className="small" style={{ margin: 0 }}>
          Wähle Musikdateien aus, die dir gehören. Sie bleiben auf <b>diesem Gerät</b> und werden nur hier abgespielt – zum Server geht nur der Titel.
          Für jedes Lied läuft ein Ausschnitt rückwärts.
        </p>
        <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple hidden onChange={(e) => { hinzu(e.target.files); e.target.value = ''; }} />
        <button className="btn gold block" disabled={!!busy} onClick={() => input.current?.click()}>{busy ?? '＋ Lieder hinzufügen'}</button>
        {fehler.length > 0 && <p className="err small" style={{ margin: 0 }}>Nicht lesbar: {fehler.join(', ')}</p>}
        <div className="el-liste">
          {lieder === null && <p className="muted">Lade …</p>}
          {lieder?.length === 0 && <p className="muted center">Noch keine eigenen Lieder.</p>}
          {lieder?.map((m) => (
            <div key={m.id} className="el-lied">
              <div className="el-felder">
                <input className="input" value={m.titel} maxLength={80} onChange={(e) => aendern({ ...m, titel: e.target.value })} onBlur={() => speichern(m)} placeholder="Liedtitel" aria-label="Liedtitel" />
                <input className="input el-kuenstler" value={m.kuenstler} maxLength={60} onChange={(e) => aendern({ ...m, kuenstler: e.target.value })} onBlur={() => speichern(m)} placeholder="Künstler (optional)" aria-label="Künstler" />
              </div>
              <div className="el-ausschnitt">
                <span className="small">Ausschnitt ab {zeit(m.start)}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, Math.floor(m.gesamt - m.laenge))}
                  step={1}
                  value={m.start}
                  onChange={(e) => aendern({ ...m, start: Number(e.target.value) })}
                  onPointerUp={() => speichern(m)}
                  onKeyUp={() => speichern(m)}
                  aria-label="Start des Ausschnitts"
                />
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <button className={`btn sm ${spielt === m.id + 'true' ? 'gold' : ''}`} onClick={() => hoeren(m, true)} title="Rückwärts anhören">◀◀</button>
                <button className={`btn sm ${spielt === m.id + 'false' ? 'gold' : ''}`} onClick={() => hoeren(m, false)} title="Vorwärts anhören">▶</button>
                <button className="btn sm ghost" onClick={async () => { await liedLoeschen(m.id); setLieder(await liederLaden()); }} aria-label={`${m.titel} löschen`}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <div className="row center" style={{ gap: 10 }}>
          <button
            className="btn green"
            onClick={async () => {
              stop.current?.();
              const l = lieder ?? [];
              await Promise.all(l.map(speichern));
              onFertig(l.filter((x) => x.titel.trim().length >= 2));
            }}
          >
            Fertig
          </button>
        </div>
      </div>
    </Modal>
  );
}
