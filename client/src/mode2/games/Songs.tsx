import { useEffect, useState } from 'react';
import type { HostView, PlayerView } from '@kronen/shared';
import { SONG_TIPP_MAX, SONGS_PAUSE_MS } from '@kronen/shared';
import { useLeft } from '../common';
import { TimerRing } from '../../components/ui';
import { Countdown, useServerTime } from './Countdown';
import { abspielen, audioBereit, melodieDauer, onAudioState, unlockAudio, vorbereiten, Melodie, pufferAbspielen } from '../../lib/melody';
import { ausschnitt } from '../../lib/eigeneLieder';

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

/** Länge eines Durchgangs in ms (App-Melodie oder Ausschnitt eines eigenen Liedes) */
const durchgangMs = (inner: any) => (inner.melodie ? melodieDauer(inner.melodie) * 1000 : (inner.dauer ?? 12) * 1000);

/** Spielt dieses Gerät den Ton? Eigene Lieder nur das Gerät mit den Dateien, App-Lieder je nach Hauptscreen */
export function spieltHier(inner: any, rolle: 'host' | string, hostDa: boolean) {
  if (inner.eigen) return inner.eigen.von === rolle;
  return rolle === 'host' ? true : !hostDa;
}

/**
 * Ton für eine Runde: beim Hören läuft das Lied rückwärts in Dauerschleife (gleichzeitig auf allen
 * abspielenden Geräten), bei der Auflösung einmal vorwärts.
 */
function useSongTon(inner: any, aktiv: boolean) {
  const bereit = useAudioBereit();
  const m: Melodie | null = inner.melodie;
  const eigenId: string | null = inner.eigen?.id ?? null;
  const [puffer, setPuffer] = useState<{ id: string; vor: AudioBuffer; rueck: AudioBuffer } | null>(null);
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => {
    if (!aktiv) return;
    if (m) vorbereiten(m);
    if (!eigenId) return;
    let ok = true;
    setFehlt(false);
    // eigenes Lied schon während des Countdowns vorbereiten
    ausschnitt(eigenId)
      .then((a) => ok && setPuffer({ id: eigenId, vor: a.vor, rueck: a.rueck }))
      .catch(() => ok && setFehlt(true));
    return () => {
      ok = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, m?.noten, eigenId]);
  const fertig = !eigenId || puffer?.id === eigenId;
  useEffect(() => {
    if (!aktiv || !bereit || !fertig) return;
    const play = (rueckwaerts: boolean, at?: number) =>
      m ? abspielen(m, { rueckwaerts, at }) : puffer ? pufferAbspielen(rueckwaerts ? puffer.rueck : puffer.vor, { at }) : () => {};
    const stops: (() => void)[] = [];
    if (inner.stage === 'hoeren') {
      const periode = durchgangMs(inner) + SONGS_PAUSE_MS;
      for (let at = inner.startAt; at < inner.until - 1500; at += periode) stops.push(play(true, at));
    } else if (inner.stage === 'aufloesung') {
      stops.push(play(false));
    }
    return () => stops.forEach((x) => x());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, bereit, fertig, inner.stage, inner.nr, inner.until]);
  return { bereit, fehlt, nochmal: (rueckwaerts: boolean) => (m ? abspielen(m, { rueckwaerts }) : puffer ? pufferAbspielen(rueckwaerts ? puffer.rueck : puffer.vor, {}) : () => {}) };
}

/** Läuft gerade ein Durchgang? (für die Animation) – liefert Fortschritt 0–1 oder null */
function useLaeuft(inner: any) {
  const now = useServerTime(80);
  if (inner.stage !== 'hoeren') return null;
  const dauer = durchgangMs(inner);
  const periode = dauer + SONGS_PAUSE_MS;
  const x = now - inner.startAt;
  if (x < 0) return null;
  const pos = x % periode;
  return pos < dauer ? pos / dauer : null;
}

/** Hinweis für Geräte, die ein eigenes Lied nicht selbst abspielen */
function WoLaeuft({ v, inner }: { v: HostView | PlayerView; inner: any }) {
  if (!inner.eigen) return null;
  const wer = inner.eigen.von === 'host' ? 'auf dem Hauptscreen' : `bei ${v.players.find((p) => p.id === inner.eigen.von)?.name ?? 'der Lobby-Leitung'}`;
  return <p className="small center muted" style={{ margin: 0 }}>🔊 Das Lied läuft {wer}.</p>;
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
  const hier = spieltHier(inner, 'host', true);
  const ton = useSongTon(inner, hier);
  const bereit = ton.bereit || !hier;
  const t = v.settings.timer;
  if (inner.stage === 'countdown')
    return (
      <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
        <h2 style={{ fontSize: 56 }}>Lied {inner.nr} von {inner.runden}</h2>
        <p className="head" style={{ fontSize: 34 }}>Gleich läuft ein bekanntes Lied – rückwärts!</p>
        <Countdown startAt={inner.startAt} size="14rem" />
        {!bereit && <div style={{ width: 600 }}><TonAn big /></div>}
        <WoLaeuft v={v} inner={inner} />
      </div>
    );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 1fr', gap: 40, flex: 1, minHeight: 0, alignItems: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 24 }}>
        <span className="head" style={{ fontSize: 40 }}>Lied {inner.nr} von {inner.runden}</span>
        <Platte inner={inner} big />
        {!bereit && <div style={{ width: 600 }}><TonAn big /></div>}
        {hier && ton.fehlt && <p className="err" style={{ fontSize: 26 }}>Dieses eigene Lied ist auf diesem Gerät nicht mehr gespeichert.</p>}
        {!hier && <div style={{ fontSize: 30 }}><WoLaeuft v={v} inner={inner} /></div>}
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
            <div className="card sg-title big">{inner.titel}{inner.kuenstler ? <div className="sg-kuenstler">{inner.kuenstler}</div> : null}</div>
            <Ergebnis inner={inner} big />
          </>
        )}
      </div>
    </div>
  );
}

export function SongsPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const [text, setText] = useState('');
  // App-Lieder: ohne Hauptscreen spielt jedes Handy (alle gleichzeitig); eigene Lieder: nur das Gerät mit den Dateien
  const hier = spieltHier(inner, v.me.id, v.hostConnected);
  const ton = useSongTon(inner, hier);
  const bereit = ton.bereit;
  const t = v.settings.timer;
  useEffect(() => setText(''), [inner.nr]);
  // Nochmal anhören geht bei eigenen Liedern nur auf dem Gerät mit den Dateien
  const kannHoeren = !inner.eigen || inner.eigen.von === v.me.id;
  const nochmal = () => {
    unlockAudio();
    ton.nochmal(inner.stage !== 'aufloesung');
  };
  return (
    <div className="stack sg-player">
      <p className="center small" style={{ margin: 0 }}>Lied {inner.nr} von {inner.runden}</p>
      {inner.stage === 'countdown' && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <p className="center head">Gleich läuft ein Lied rückwärts …</p>
          <Countdown startAt={inner.startAt} size="6rem" />
          {hier && !bereit && <TonAn />}
        </div>
      )}
      {inner.stage === 'hoeren' && (
        <>
          <Platte inner={inner} />
          {!hier && <WoLaeuft v={v} inner={inner} />}
          {hier && ton.fehlt && <p className="err small center" style={{ margin: 0 }}>Dieses eigene Lied ist auf diesem Gerät nicht mehr gespeichert.</p>}
          {hier && !bereit && <TonAn />}
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
            {kannHoeren ? <button className="btn sm" type="button" onClick={nochmal}>{v.hostConnected && !inner.eigen ? '🔈 Auf dem Handy anhören' : '🔈 Nochmal anhören'}</button> : <span />}
            <Timer v={v} until={inner.until} total={t.songs} size={70} />
          </div>
        </>
      )}
      {inner.stage === 'aufloesung' && (
        <>
          <div className="card center">
            <p className="small" style={{ margin: 0 }}>Das Lied war:</p>
            <div className="sg-title">{inner.titel}</div>
            {inner.kuenstler && <div className="sg-kuenstler">{inner.kuenstler}</div>}
            {inner.meins ? (
              <p className={`badge ${inner.meins.ok ? 'green' : ''}`} style={{ fontSize: '1.05em', marginTop: 6 }}>
                {inner.meins.ok ? '✔ Richtig! +1 Punkt' : `✖ Leider falsch („${inner.meins.text}“)`}
              </p>
            ) : (
              <p className="small" style={{ margin: 0 }}>Du hast nichts eingeloggt.</p>
            )}
          </div>
          {!v.hostConnected && <Ergebnis inner={inner} />}
          {kannHoeren && <button className="btn sm" type="button" onClick={nochmal}>🔈 Vorwärts anhören</button>}
        </>
      )}
    </div>
  );
}
