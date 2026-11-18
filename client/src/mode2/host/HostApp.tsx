import { useEffect, useRef, useState } from 'react';
import { HostView, GAMES, GameId, TIMER_LABELS, TimerSettings, CARD_TEXT, Stroke } from '@kronen/shared';
import { useConnection } from '../connection';
import { useRoute, go, absoluteUrl } from '../../lib/router';
import { useWakeLock } from '../../lib/hooks';
import { Stage, BoardLayer, CrownTable, statusText, useLeft, playerName, playerOf, useToast } from '../common';
import { QR } from '../../components/QR';
import { Stepper, Die, Dot, FieldBadge, Confirm } from '../../components/ui';
import { CrownSvg, TokenSvg } from '../../components/icons';
import { Snow, Confetti } from '../../components/Decor';
import { SlotRoller, FIELD_NUMBERS } from '../../components/Roller';
import { HostMini } from './HostMini';

export default function HostApp() {
  const r = useRoute();
  const create = r.query.get('neu') === '1';
  const strokeListeners = useRef(new Set<(s: Stroke) => void>());
  const conn = useConnection<HostView>('host', { create, onStroke: (s) => strokeListeners.current.forEach((f) => f(s)) });
  useWakeLock(true);
  useEffect(() => {
    if (create && conn.session) history.replaceState(null, '', '#/host');
  }, [create, conn.session]);
  const v = conn.view;
  return (
    <div className="host-root">
      <div className="rotate-hint">
        <div style={{ fontSize: '4rem' }}>🔄</div>
        <h2>Bitte Gerät drehen</h2>
        <p>Der Hauptscreen ist für das Querformat gemacht.</p>
      </div>
      <Stage>
        <Snow count={30} edgeOnly />
        {conn.closed && !v ? (
          <Centered>
            <h1 className="gold">Lobby beendet</h1>
            <p>{conn.closed}</p>
            <button className="btn big" onClick={() => go('/nur-app')}>Zurück</button>
          </Centered>
        ) : !v ? (
          <Centered>
            <h1 className="gold">Verbinde …</h1>
            {conn.status !== 'open' && <p>Server wird gesucht …</p>}
            {!create && !conn.session && <button className="btn big" onClick={() => go('/host?neu=1')}>Neue Lobby erstellen</button>}
          </Centered>
        ) : !v.started ? (
          <Lobby v={v} send={conn.send} error={conn.error} clearError={conn.clearError} onClose={() => { conn.send({ t: 'close' }); conn.forget(); go('/nur-app'); }} />
        ) : (
          <Game v={v} send={conn.send} strokeListeners={strokeListeners.current} onExit={() => { conn.send({ t: 'close' }); conn.forget(); go('/'); }} />
        )}
        {conn.status !== 'open' && v && (
          <div className="badge red" style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 24 }}>Verbindung wird wiederhergestellt …</div>
        )}
      </Stage>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center' }}>{children}</div>;
}

type Send = ReturnType<typeof useConnection>['send'];

/* ------------------------------ Lobby ------------------------------ */

function Lobby({ v, send, error, clearError, onClose }: { v: HostView; send: Send; error: string | null; clearError: () => void; onClose: () => void }) {
  const url = absoluteUrl('/beitreten?c=' + v.code);
  const [ask, setAsk] = useState(false);
  const setTimer = (k: keyof TimerSettings, val: number) => send({ t: 'settings', settings: { timer: { ...v.settings.timer, [k]: val } } });
  const toggleGame = (id: GameId) => {
    const on = v.settings.aktiveSpiele.includes(id);
    const list = on ? v.settings.aktiveSpiele.filter((g) => g !== id) : [...v.settings.aktiveSpiele, id];
    send({ t: 'settings', settings: { aktiveSpiele: list } });
  };
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 40, display: 'grid', gridTemplateColumns: '560px 1fr 640px', gap: 32 }}>
      <div className="panel stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2>Lobby-Code</h2>
        <div className="head gold" style={{ fontSize: 132, letterSpacing: '0.12em', lineHeight: 1, textShadow: '0 6px 0 rgba(0,0,0,.4)' }}>{v.code}</div>
        <QR text={url} size={330} />
        <p style={{ fontSize: 24 }}>QR-Code scannen oder auf dem Handy<br />„Nur App“ → „Beitreten“ wählen und den Code eingeben.</p>
        <div className="grow" />
        <button className="btn ghost sm" onClick={() => setAsk(true)}>Lobby schließen</button>
      </div>
      <div className="panel stack">
        <div className="row between">
          <h2>Mitspieler ({v.players.length}/10)</h2>
          <CrownSvg size={70} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {v.players.map((p) => (
            <div key={p.id} className="list-item" style={{ fontSize: 34 }}>
              <span style={{ width: 56, height: 64 }}><TokenSvg color={p.color} letter={p.name.slice(0, 1).toUpperCase()} /></span>
              <span className="head grow">{p.name}</span>
              <span className={`badge ${p.connected ? 'green' : 'gray'}`}>{p.connected ? 'verbunden' : 'getrennt'}</span>
              <button className="btn sm red" onClick={() => send({ t: 'kick', playerId: p.id })}>Entfernen</button>
            </div>
          ))}
          {v.players.length === 0 && <p style={{ fontSize: 30 }} className="muted">Noch niemand da. Scannt den QR-Code!</p>}
        </div>
        <div className="grow" />
        {error && <p className="err">{error}</p>}
        <button className="btn red huge" disabled={v.players.length < 2} onClick={() => send({ t: 'start' })}>
          {v.players.length < 2 ? 'Mindestens 2 Spieler nötig' : '🎲 Spiel starten'}
        </button>
      </div>
      <div className="panel stack" style={{ fontSize: 22, overflow: 'hidden' }}>
        <h2>Einstellungen</h2>
        <div className="row between"><b>Kronen zum Sieg</b><Stepper value={v.settings.kronenZumSieg} min={3} max={15} onChange={(k) => send({ t: 'settings', settings: { kronenZumSieg: k } })} /></div>
        <div className="row between"><b>Würfel</b><span className="row"><Die value={6} size="1.2em" /> 1 Würfel, Augen 1 bis 6</span></div>
        <b>Aktive Spiele</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {GAMES.map((g) => {
            const on = v.settings.aktiveSpiele.includes(g.id);
            const ok = v.players.length >= g.minPlayers;
            return (
              <button key={g.id} className={`btn sm ${on ? 'green' : 'ghost'}`} onClick={() => toggleGame(g.id)} title={ok ? '' : `ab ${g.minPlayers} Spielern`} style={{ justifyContent: 'flex-start', opacity: ok ? 1 : 0.6 }}>
                {on ? '✔' : '✖'} {g.name}
              </button>
            );
          })}
        </div>
        <b>Timer (Sekunden)</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', alignItems: 'center', fontSize: 18 }}>
          {(Object.keys(TIMER_LABELS) as (keyof TimerSettings)[]).map((k) => (
            <TimerRow key={k} label={TIMER_LABELS[k]} value={v.settings.timer[k]} onChange={(n) => setTimer(k, n)} />
          ))}
        </div>
      </div>
      {ask && <Confirm text="Lobby wirklich schließen?" yes="Ja, schließen" onYes={onClose} onNo={() => setAsk(false)} />}
    </div>
  );
}

function TimerRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const step = value >= 60 ? 15 : 5;
  return (
    <>
      <span>{label}</span>
      <span className="row" style={{ gap: 4 }}>
        <button className="btn sm" style={{ minHeight: 34, padding: '0 10px' }} onClick={() => onChange(Math.max(5, value - step))}>−</button>
        <span className="head" style={{ minWidth: 50, textAlign: 'center' }}>{value}</span>
        <button className="btn sm" style={{ minHeight: 34, padding: '0 10px' }} onClick={() => onChange(Math.min(600, value + step))}>+</button>
      </span>
    </>
  );
}

/* ------------------------------ Spiel ------------------------------ */

function Game({ v, send, strokeListeners, onExit }: { v: HostView; send: Send; strokeListeners: Set<(s: Stroke) => void>; onExit: () => void }) {
  const toast = useToast(v);
  const ph = v.phase;
  const cur = playerOf(v, v.turnPlayerId);
  const showMini = ph.k === 'minispiel' && v.mini;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Brett füllt den größten Teil der Bühne */}
      <div style={{ position: 'absolute', top: 0, left: 200, width: 1519 }}>
        <BoardLayer view={ph.k === 'intro' ? { ...v, players: v.players.map((p) => ({ ...p, pos: 0 })) } : v} highlight={ph.k === 'intro' ? null : v.turnPlayerId} jump={ph.k === 'karte'} previews={ph.k === 'richtung' ? ph.options : undefined} />
      </div>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, fontSize: 26 }}>
        <CrownTable view={ph.k === 'intro' ? { ...v, turnPlayerId: null } : v} />
      </div>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }} className="badge" title="Lobby-Code">Code {v.code}</div>
      {/* Statusleiste */}
      <div className="panel dark" style={{ position: 'absolute', left: 16, right: 16, bottom: 8, height: 112, zIndex: 20, display: 'flex', alignItems: 'center', gap: 24, padding: '8px 28px' }}>
        {cur && <span style={{ width: 60, height: 70 }}><TokenSvg color={cur.color} letter={cur.name[0]?.toUpperCase() ?? '?'} /></span>}
        <span className="head grow" style={{ fontSize: 40 }}>{statusText(v)}</span>
        {cur && cur.bonus > 0 && ph.k === 'wuerfeln' && <span className="badge green" style={{ fontSize: 30 }}>+{cur.bonus} Bonus</span>}
        {ph.k === 'gewuerfelt' && <Die value={ph.k === 'gewuerfelt' ? ph.wurf : 1} size="52px" />}
        {ph.k === 'richtung' && <DirTimer v={v} until={ph.until} />}
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
      {ph.k === 'intro' && <Intro v={v} send={send} />}
      {ph.k === 'gewuerfelt' && <DiceOverlay v={v} />}
      {(ph.k === 'karteZiehen' || ph.k === 'karte') && <CardOverlay v={v} />}
      {showMini && <HostMini v={v} send={send} strokeListeners={strokeListeners} />}
      {ph.k === 'sieg' && <Victory v={v} send={send} onExit={onExit} />}
    </div>
  );
}

function DirTimer({ v, until }: { v: HostView; until: number }) {
  const left = useLeft(v, until);
  return <span className="head" style={{ fontSize: 40 }}>⏱ {left}</span>;
}

function Overlay({ children, dim = 0.6 }: { children: React.ReactNode; dim?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: `rgba(15,7,2,${dim})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30, animation: 'fade .3s' }}>
      {children}
    </div>
  );
}

function Intro({ v, send }: { v: HostView; send: Send }) {
  const [step, setStep] = useState(0);
  const players = v.players;
  const orderDone = step > players.length;
  useEffect(() => {
    if (step === players.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 600);
      return () => clearTimeout(t);
    }
  }, [step, players.length]);
  return (
    <Overlay dim={0.7}>
      <h1 className="gold">{orderDone ? 'Die Reihenfolge' : 'Startfelder werden ausgelost'}</h1>
      {!orderDone ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, 340px)', gap: 20, width: 1600, justifyContent: 'center' }}>
          {players.map((p, i) => (
            <div key={p.id} className="panel row between" style={{ opacity: i <= step ? 1 : 0.35, fontSize: 30 }}>
              <span className="row"><Dot color={p.color} /> <b>{p.name}</b></span>
              {i < step ? <FieldBadge n={p.start} /> : i === step ? <SlotRoller options={FIELD_NUMBERS} final={p.start} duration={1000} render={(x) => x} style={{ minWidth: 0, padding: '0 14px' }} onDone={() => setTimeout(() => setStep((s) => s + 1), 300)} /> : <span className="field">?</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="row center" style={{ gap: 24 }}>
          {v.order.map((id, i) => {
            const p = playerOf(v, id)!;
            return (
              <div key={id} className="panel stack" style={{ alignItems: 'center', animation: `cardIn .4s ${i * 0.25}s both`, fontSize: 30 }}>
                <span className="head gold" style={{ fontSize: 50 }}>{i + 1}.</span>
                <span style={{ width: 70, height: 80 }}><TokenSvg color={p.color} letter={p.name[0].toUpperCase()} /></span>
                <b>{p.name}</b>
              </div>
            );
          })}
        </div>
      )}
      <button className="btn ghost sm" onClick={() => send({ t: 'host', a: { t: 'weiter' } })}>Überspringen</button>
    </Overlay>
  );
}

function DiceOverlay({ v }: { v: HostView }) {
  const ph = v.phase;
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRolling(false), 1100);
    return () => clearTimeout(t);
  }, []);
  if (ph.k !== 'gewuerfelt') return null;
  const name = playerName(v, v.turnPlayerId);
  return (
    <Overlay dim={0.35}>
      <div className="panel stack" style={{ alignItems: 'center', padding: 50 }}>
        <h1>{name} würfelt …</h1>
        <Die value={ph.wurf} rolling={rolling} size="220px" />
        {!rolling && (
          <div className="head gold" style={{ fontSize: 90, animation: 'pop .4s' }}>
            {ph.bonus > 0 ? `${ph.wurf} + ${ph.bonus} Bonus = ${ph.total} Felder` : `${ph.wurf}!`}
          </div>
        )}
      </div>
    </Overlay>
  );
}

function CardOverlay({ v }: { v: HostView }) {
  const ph = v.phase;
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (ph.k === 'karte') {
      const t = setTimeout(() => setFlipped(true), 150);
      return () => clearTimeout(t);
    }
    setFlipped(false);
  }, [ph.k]);
  const name = playerName(v, v.turnPlayerId);
  const card = ph.k === 'karte' ? CARD_TEXT[ph.card] : null;
  return (
    <Overlay dim={0.5}>
      <div className="row" style={{ gap: 60, alignItems: 'center' }}>
        <div className={`event-card ${flipped ? 'flipped' : ''}`}>
          <div className="inner">
            <div className="face front">?!</div>
            <div className="face back">
              {card && ph.k === 'karte' && (
                <>
                  <h1 style={{ color: 'var(--blue)', fontSize: 64 }}>{card.titel}</h1>
                  <p style={{ fontSize: 34 }}>{card.text}</p>
                  {ph.card === 'sprung' && ph.ziel && <FieldBadge n={ph.ziel} size="xl" />}
                  {ph.card === 'krone' && <CrownSvg size={200} />}
                  {ph.card === 'kronenNeu' && <div className="row"><CrownSvg size={130} /><CrownSvg size={130} big /></div>}
                  {ph.card === 'tausch' && <div style={{ fontSize: 120 }}>🔄</div>}
                  {ph.card === 'spielWahl' && <div style={{ fontSize: 120 }}>🎮</div>}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="panel dark stack" style={{ maxWidth: 640, fontSize: 36 }}>
          <h2 className="gold">{name}</h2>
          {ph.k === 'karteZiehen' && <p>zieht auf dem Handy eine Ereigniskarte …</p>}
          {ph.k === 'karte' && ph.stage === 'wahl' && ph.card === 'tausch' && <p>wählt auf dem Handy, mit wem getauscht wird …</p>}
          {ph.k === 'karte' && ph.stage === 'wahl' && ph.card === 'spielWahl' && <p>sucht auf dem Handy ein Minispiel aus …</p>}
          {ph.k === 'karte' && ph.stage === 'fertig' && ph.card === 'tausch' && ph.info && <p>tauscht mit {ph.info}!</p>}
        </div>
      </div>
    </Overlay>
  );
}

function Victory({ v, send, onExit }: { v: HostView; send: Send; onExit: () => void }) {
  const ph = v.phase;
  if (ph.k !== 'sieg') return null;
  const w = playerOf(v, ph.winner);
  return (
    <Overlay dim={0.8}>
      <Confetti duration={7000} />
      <Confetti duration={7000} gold />
      <CrownSvg size={260} big className="crown-big" />
      <h1 className="gold" style={{ fontSize: 130 }}>{w?.name} gewinnt!</h1>
      <p className="head" style={{ fontSize: 48 }}>mit {w?.kronen} Kronenpunkten</p>
      <div className="row center" style={{ gap: 20 }}>
        {[...v.players].sort((a, b) => b.kronen - a.kronen).map((p, i) => (
          <span key={p.id} className="chip" style={{ fontSize: 30 }}>{i + 1}. <Dot color={p.color} /> {p.name} · {p.kronen} 👑</span>
        ))}
      </div>
      <div className="row center" style={{ gap: 24 }}>
        <button className="btn red big" onClick={() => send({ t: 'host', a: { t: 'neueRunde' } })}>🔁 Neue Runde mit denselben Spielern</button>
        <button className="btn big" onClick={onExit}>Zum Startscreen</button>
      </div>
    </Overlay>
  );
}

