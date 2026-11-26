import { useEffect, useState } from 'react';
import type { HostView, PlayerView } from '@kronen/shared';
import { SONG_TIPP_MAX, SONGS_PAUSE_MS } from '@kronen/shared';
import { useLeft } from '../common';
import { TimerRing } from '../../components/ui';
import { Countdown, useServerTime } from './Countdown';
import { abspielen, audioBereit, melodieDauer, onAudioState, unlockAudio, vorbereiten, Melodie } from '../../lib/melody';

type Send = (m: any) => void;
const act = (send: Send, a: any) => send({ t: 'act', a: { t: 'mini', a } });

function Timer({ v, until, total, size }: { v: HostView | PlayerView; until: number; total: number; size: number }) {
  const left = useLeft(v, until);
  if (left === null) return null;
  return <TimerRing left={left} total={total} size={size} />;
}

function useAudioBereit() {
  const [ok, setOk] = useState(audioBereit());
  useEffect(() => {
    const off = onAudioState(() => setOk(audioBereit()));
    return () => {
      off();
    };
  }, []);
  return ok;
}

/**
 * Ton für eine Runde: beim Hören läuft das Lied rückwärts in Dauerschleife (auf allen Geräten
 * gleichzeitig), bei der Auflösung einmal vorwärts.
 */
function useSongTon(inner: any, aktiv: boolean) {
  const bereit = useAudioBereit();
  const m: Melodie = inner.melodie;
  useEffect(() => {
    if (aktiv) vorbereiten(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, m.noten]);
  useEffect(() => {
    if (!aktiv || !bereit) return;
    const stops: (() => void)[] = [];
    if (inner.stage === 'hoeren') {
      const periode = melodieDauer(m) * 1000 + SONGS_PAUSE_MS;
      for (let at = inner.startAt; at < inner.until - 1500; at += periode) stops.push(abspielen(m, { rueckwaerts: true, at }));
    } else if (inner.stage === 'aufloesung') {
      stops.push(abspielen(m, { rueckwaerts: false }));
    }
    return () => stops.forEach((s) => s());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, bereit, inner.stage, inner.nr, inner.until]);
  return bereit;
}

/** Läuft gerade ein Durchgang? (für die Animation) – liefert Fortschritt 0–1 oder null */
function useLaeuft(inner: any) {
  const now = useServerTime(80);
  if (inner.stage !== 'hoeren') return null;
  const dauer = melodieDauer(inner.melodie) * 1000;
  const periode = dauer + SONGS_PAUSE_MS;
  const x = now - inner.startAt;
  if (x < 0) return null;
  const pos = x % periode;
  return pos < dauer ? pos / dauer : null;
}

function TonAn({ big }: { big?: boolean }) {
  return (
    <div className="stack" style={{ gap: 4, alignItems: 'center', width: '100%' }}>
      <button className={`btn gold ${big ? 'huge' : 'big'} block`} onClick={unlockAudio}>
        🔊 Ton einschalten
      </button>
      <span className="small muted center">Kein Ton? Lautstärke prüfen – am iPhone den Lautlos-Schalter ausschalten.</span>
    </div>
  );
}

/** Schallplatte, die sich rückwärts dreht, mit Fortschritt (läuft von rechts nach links) */
function Platte({ inner, big }: { inner: any; big?: boolean }) {
  const p = useLaeuft(inner);
  return (
    <div className={`sg-deck ${big ? 'big' : ''}`}>
      <div className={`sg-vinyl ${p !== null ? 'spin' : ''} ${inner.stage === 'aufloesung' ? 'vor' : ''}`}>
        <span className="sg-label">{inner.stage === 'aufloesung' ? '▶' : '◀◀'}</span>
      </div>
      <div className="sg-bars" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={p !== null || inner.stage === 'aufloesung' ? 'on' : ''} style={{ animationDelay: `${(i * 137) % 600}ms` }} />
        ))}
      </div>
      {inner.stage === 'hoeren' && (
        <div className="sg-progress">
          <span style={{ width: `${(1 - (p ?? 0)) * 100}%`, opacity: p === null ? 0.25 : 1 }} />
        </div>
      )}
    </div>
  );
}

function Ergebnis({ inner, big }: { inner: any; big?: boolean }) {
  return (
    <div className={`sg-results ${big ? 'big' : ''}`}>
      {inner.alle.map((a: any, i: number) => (
        <div key={a.name} className={`list-item ${a.ok ? 'ok' : ''}`} style={{ animation: `cardIn .35s ${i * 0.07}s both` }}>
          <b className="grow">{a.name}</b>
          <span className="sg-answer">{a.text ? `„${a.text}“` : '–'}</span>
          <span className={`badge ${a.ok ? 'green' : 'gray'}`}>{a.ok ? '✔ +1' : '✖'}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SongsHost({ v, inner, portrait }: { v: HostView; inner: any; portrait?: boolean }) {
  const bereit = useSongTon(inner, true);
  const t = v.settings.timer;
  if (inner.stage === 'countdown')
    return (
      <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
        <h2 style={{ fontSize: 56 }}>Lied {inner.nr} von {inner.runden}</h2>
        <p className="head" style={{ fontSize: 34 }}>Gleich läuft ein bekanntes Lied – rückwärts!</p>
        <Countdown startAt={inner.startAt} size="14rem" />
        {!bereit && <div style={{ width: 600 }}><TonAn big /></div>}
      </div>
    );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 1fr', gap: 40, flex: 1, minHeight: 0, alignItems: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 24 }}>
        <span className="head" style={{ fontSize: 40 }}>Lied {inner.nr} von {inner.runden}</span>
        <Platte inner={inner} big />
        {!bereit && <div style={{ width: 600 }}><TonAn big /></div>}
      </div>
      <div className="stack" style={{ gap: 22, fontSize: 30 }}>
        {inner.stage === 'hoeren' ? (
          <>
            <div className="row between">
              <h2 style={{ fontSize: 54 }}>Welches Lied ist das?</h2>
              <Timer v={v} until={inner.until} total={t.songs} size={150} />
            </div>
            <p>Tippt den Titel auf eurem Handy ein und loggt ihn ein.</p>
            <div className="row" style={{ gap: 12 }}>
              {inner.eingeloggt.length === 0 ? <span className="muted">Noch niemand eingeloggt …</span> : inner.eingeloggt.map((n: string) => <span key={n} className="chip">✔ {n}</span>)}
            </div>
          </>
        ) : (
          <>
            <p className="head" style={{ fontSize: 34, margin: 0 }}>Das Lied war:</p>
            <div className="card sg-title big">{inner.titel}</div>
            <Ergebnis inner={inner} big />
          </>
        )}
      </div>
    </div>
  );
}

export function SongsPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const [text, setText] = useState('');
  // Ohne Hauptscreen spielt jedes Handy das Lied selbst (alle gleichzeitig)
  const bereit = useSongTon(inner, !v.hostConnected);
  const t = v.settings.timer;
  useEffect(() => setText(''), [inner.nr]);
  const nochmal = () => {
    unlockAudio();
    abspielen(inner.melodie, { rueckwaerts: inner.stage !== 'aufloesung' });
  };
  return (
    <div className="stack sg-player">
      <p className="center small" style={{ margin: 0 }}>Lied {inner.nr} von {inner.runden}</p>
      {inner.stage === 'countdown' && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <p className="center head">Gleich läuft ein Lied rückwärts …</p>
          <Countdown startAt={inner.startAt} size="6rem" />
          {!v.hostConnected && !bereit && <TonAn />}
        </div>
      )}
      {inner.stage === 'hoeren' && (
        <>
          <Platte inner={inner} />
          {!v.hostConnected && !bereit && <TonAn />}
          {inner.meins ? (
            <div className="card center">
              <p style={{ margin: 0 }}>✔ Eingeloggt:</p>
              <div className="sg-title">„{inner.meins.text}“</div>
              <p className="small" style={{ margin: 0 }}>Warte auf die anderen …</p>
            </div>
          ) : (
            <form
              className="stack"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) act(send, { k: 'songTipp', text: text.trim() });
              }}
            >
              <input className="input" value={text} maxLength={SONG_TIPP_MAX} onChange={(e) => setText(e.target.value)} placeholder="Liedtitel, z. B. Jingle Bells" autoComplete="off" autoCapitalize="sentences" />
              <button className="btn green big block" type="submit" disabled={!text.trim()}>Einloggen</button>
            </form>
          )}
          <div className="row between" style={{ alignItems: 'center' }}>
            <button className="btn sm" type="button" onClick={nochmal}>{v.hostConnected ? '🔈 Auf dem Handy anhören' : '🔈 Nochmal anhören'}</button>
            <Timer v={v} until={inner.until} total={t.songs} size={70} />
          </div>
        </>
      )}
      {inner.stage === 'aufloesung' && (
        <>
          <div className="card center">
            <p className="small" style={{ margin: 0 }}>Das Lied war:</p>
            <div className="sg-title">{inner.titel}</div>
            {inner.meins ? (
              <p className={`badge ${inner.meins.ok ? 'green' : ''}`} style={{ fontSize: '1.05em', marginTop: 6 }}>
                {inner.meins.ok ? '✔ Richtig! +1 Punkt' : `✖ Leider falsch („${inner.meins.text}“)`}
              </p>
            ) : (
              <p className="small" style={{ margin: 0 }}>Du hast nichts eingeloggt.</p>
            )}
          </div>
          {!v.hostConnected && <Ergebnis inner={inner} />}
          <button className="btn sm" type="button" onClick={nochmal}>🔈 Vorwärts anhören</button>
        </>
      )}
    </div>
  );
}
