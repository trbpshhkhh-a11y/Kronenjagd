import { useState } from 'react';
import type { HostView, PlayerView } from '@kronen/shared';
import { FINTE_MAX } from '@kronen/shared';
import { useLeft } from '../common';
import { TimerRing } from '../../components/ui';
import { Countdown, useServerTime } from './Countdown';

type Send = (m: any) => void;
const act = (send: Send, a: any) => send({ t: 'act', a: { t: 'mini', a } });

function Timer({ v, until, total, size }: { v: HostView | PlayerView; until: number; total: number; size: number }) {
  const left = useLeft(v, until);
  if (left === null) return null;
  return <TimerRing left={left} total={total} size={size} />;
}

/** Wie weit ist das Aufdecken? Liefert Anzahl aufgedeckter Karten (in revealOrder) */
function useRevealed(reveal: any) {
  const now = useServerTime(100);
  if (!reveal) return 0;
  const fakes = reveal.order.length - 1;
  const k = Math.floor((now - reveal.start) / reveal.step) + 1;
  if (k <= fakes) return Math.max(0, k);
  return reveal.order.length;
}

function RevealCards({ inner, big }: { inner: any; big?: boolean }) {
  const revealed = useRevealed(inner.reveal);
  const r = inner.reveal;
  const done = inner.stage === 'zwischenstand';
  return (
    <div className={`fl-grid ${big ? 'big' : ''}`}>
      {r.order.map((idx: number, k: number) => {
        const o = r.options[idx];
        const shown = done || k < revealed;
        const current = !done && k === revealed - 1;
        return (
          <div key={idx} className={`fl-card ${shown ? 'shown' : ''} ${shown && o.real ? 'real' : ''} ${current ? 'current' : ''}`}>
            <div className="fl-text">{o.text}</div>
            {shown && (
              <div className="fl-meta">
                {o.real ? <b className="fl-tag real">Die echte Antwort!</b> : <span className="fl-tag">Finte von {o.authors.join(' & ')}</span>}
                <div className="fl-voters">
                  {o.voters.length === 0 ? <span className="small muted">niemand</span> : o.voters.map((n: string) => <span key={n} className="fl-voter">{n}</span>)}
                </div>
                {o.voters.length > 0 && <span className="fl-plus">{o.real ? `+1 für jeden Treffer` : `+${o.voters.length} für ${o.authors.join(' & ')}`}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Scores({ inner, big }: { inner: any; big?: boolean }) {
  return (
    <div className={`fl-scores ${big ? 'big' : ''}`}>
      {inner.scores.map((s: any, i: number) => (
        <div key={s.name} className="list-item" style={{ animation: `cardIn .4s ${i * 0.08}s both` }}>
          <b className="gold">{i + 1}.</b>
          <span className="grow">{s.name}</span>
          {s.plus > 0 && <span className="badge green">+{s.plus}</span>}
          <b>{s.punkte}</b>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Hauptscreen ------------------------------ */

export function FlunkerHost({ v, inner, portrait }: { v: HostView; inner: any; portrait?: boolean }) {
  const t = v.settings.timer;
  if (inner.stage === 'countdown')
    return (
      <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <h2 style={{ fontSize: 56 }}>Runde 1 von {inner.rounds}</h2>
        <Countdown startAt={inner.startAt} size="16rem" />
      </div>
    );
  return (
    <div className="stack" style={{ gap: 22, flex: 1, minHeight: 0 }}>
      <div className="row between">
        <span className="head" style={{ fontSize: 34 }}>Runde {inner.round} von {inner.rounds}</span>
        {(inner.stage === 'schreiben' || inner.stage === 'abstimmen') && (
          <Timer v={v} until={inner.until} total={inner.stage === 'schreiben' ? t.flunker : t.flunkerAbstimmen} size={150} />
        )}
      </div>
      <div className="card">
        <div className="question" style={{ fontSize: inner.stage === 'schreiben' ? 70 : 50 }}>{inner.frage}</div>
        <div className="center" style={{ marginTop: 10 }}><span className="fl-hint">Gesucht: {inner.hinweis}</span></div>
      </div>
      {inner.stage === 'schreiben' && (
        <>
          <p className="center head" style={{ fontSize: 38 }}>Denkt euch eine glaubwürdige falsche Antwort aus!</p>
          <div className="row center" style={{ gap: 14 }}>
            {inner.schreiber.map((s: any) => (
              <span key={s.name} className={`chip ${s.fertig ? 'fl-done' : ''}`} style={{ fontSize: 32 }}>{s.fertig ? '✓' : '…'} {s.name}</span>
            ))}
          </div>
        </>
      )}
      {inner.stage === 'abstimmen' && (
        <>
          <div className={`fl-grid big ${portrait ? 'portrait' : ''}`}>
            {inner.options.map((o: any, i: number) => (
              <div key={i} className="fl-card shown"><span className="fl-letter">{String.fromCharCode(65 + i)}</span><div className="fl-text">{o.text}</div></div>
            ))}
          </div>
          <p className="center" style={{ fontSize: 30 }}>Abgestimmt: {inner.abgestimmt.join(', ') || '–'}</p>
        </>
      )}
      {inner.stage === 'aufloesung' && <RevealCards inner={inner} big />}
      {inner.stage === 'zwischenstand' && (
        <div className={portrait ? 'stack' : 'row'} style={{ gap: 30, alignItems: 'flex-start' }}>
          <div style={{ flex: 2 }}><RevealCards inner={inner} big /></div>
          <div style={{ flex: 1, fontSize: 32 }}><h2>Zwischenstand</h2><Scores inner={inner} big /></div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Handy --------------------------------- */

export function FlunkerPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const t = v.settings.timer;
  if (inner.stage === 'countdown')
    return (
      <div className="stack" style={{ alignItems: 'center' }}>
        <h3>Runde 1 von {inner.rounds}</h3>
        <Countdown startAt={inner.startAt} />
      </div>
    );
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="small">Runde {inner.round} von {inner.rounds}</span>
        {(inner.stage === 'schreiben' || inner.stage === 'abstimmen') && <Timer v={v} until={inner.until} total={inner.stage === 'schreiben' ? t.flunker : t.flunkerAbstimmen} size={70} />}
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div className="question" style={{ fontSize: '1.25em' }}>{inner.frage}</div>
        <div className="center" style={{ marginTop: 6 }}><span className="fl-hint">Gesucht: {inner.hinweis}</span></div>
      </div>
      {inner.stage === 'schreiben' &&
        (inner.meineFinte && !edit ? (
          <div className="panel stack center" style={{ alignItems: 'center' }}>
            <span className="small">Deine Finte</span>
            <b className="head" style={{ fontSize: '1.4em' }}>{inner.meineFinte}</b>
            <span className="small muted">Warte auf die anderen …</span>
            <button className="btn sm ghost" onClick={() => { setText(inner.meineFinte); setEdit(true); }}>Ändern</button>
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              act(send, { k: 'finte', text: text.trim() });
              setEdit(false);
            }}
          >
            <label className="small">Deine falsche, aber glaubwürdige Antwort:</label>
            <input className="input" value={text} maxLength={FINTE_MAX} onChange={(e) => setText(e.target.value)} placeholder={inner.hinweis} autoComplete="off" />
            <div className="row between">
              <span className="small muted">{text.length}/{FINTE_MAX}</span>
              <button className="btn green" type="submit" disabled={!text.trim()}>Absenden</button>
            </div>
          </form>
        ))}
      {inner.stage === 'abstimmen' && (
        <div className="stack" style={{ gap: 8 }}>
          <b>Welche Antwort ist die echte?</b>
          {inner.options.map((o: any, i: number) => {
            const mine = inner.eigene.includes(i);
            const chosen = inner.meineStimme === i;
            return (
              <button key={i} disabled={mine} className={`btn block fl-opt ${chosen ? 'gold selected' : ''}`} onClick={() => act(send, { k: 'stimme', opt: i })}>
                <span className="fl-letter sm">{String.fromCharCode(65 + i)}</span>
                <span className="grow" style={{ textAlign: 'left' }}>{o.text}</span>
                {mine && <span className="small">deine Finte</span>}
                {chosen && <span>✓</span>}
              </button>
            );
          })}
        </div>
      )}
      {(inner.stage === 'aufloesung' || inner.stage === 'zwischenstand') && (
        <>
          {inner.stage === 'zwischenstand' && <div className="card center"><b>Diese Runde: +{inner.meinPlus}</b></div>}
          <RevealCards inner={inner} />
          {inner.stage === 'zwischenstand' && <Scores inner={inner} />}
        </>
      )}
    </div>
  );
}
