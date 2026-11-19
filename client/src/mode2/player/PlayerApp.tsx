import { useEffect, useState } from 'react';
import { PlayerView, normalizeCode, CODE_LENGTH, CARD_TEXT, gameById, fieldType } from '@kronen/shared';
import { useConnection, loadSession, PLAYER_KEY } from '../connection';
import { go } from '../../lib/router';
import { useWakeLock } from '../../lib/hooks';
import { BoardSnippet, OPTION_COLORS, statusText, useLeft, playerName, ConnBanner, useToast } from '../common';
import { Die, Dot, FieldBadge, Modal, Confirm } from '../../components/ui';
import { CrownSvg, FieldIcon, TokenSvg, FIELD_TYPE_LABEL } from '../../components/icons';
import { Confetti } from '../../components/Decor';
import { EventCardScene } from '../../components/EventCard';
import { PlayerMini } from './PlayerMini';

export default function PlayerApp({ initialCode = '' }: { initialCode?: string }) {
  const conn = useConnection<PlayerView>('player');
  useWakeLock(!!conn.view);
  const v = conn.view;
  const toast = useToast(v);
  if (conn.closed && !v && !loadSession(PLAYER_KEY)) {
    return <JoinForm initialCode={initialCode} conn={conn} notice={conn.closed} />;
  }
  if (!v) {
    if (conn.session) return <div className="screen center"><h2>Verbinde mit Lobby {conn.session.code} …</h2><button className="btn ghost" onClick={conn.forget}>Abbrechen</button></div>;
    return <JoinForm initialCode={initialCode} conn={conn} />;
  }
  return (
    <div className="screen" style={{ maxWidth: 680, gap: 14, paddingTop: 30 }}>
      <Header v={v} />
      {toast && <div className={`toast mobile-toast ${toast.kind}`}>{toast.text}</div>}
      {conn.error && <Modal onClose={conn.clearError}><div className="card stack center"><p className="head" style={{ fontSize: '1.2em' }}>{conn.error}</p><button className="btn" onClick={conn.clearError}>OK</button></div></Modal>}
      {!v.started ? <WaitingRoom v={v} send={conn.send} onLeave={() => { conn.send({ t: 'leave' }); conn.forget(); go('/nur-app'); }} /> : <Playing v={v} send={conn.send} onExit={() => { conn.forget(); go('/'); }} />}
      <ConnBanner status={conn.status} hostConnected={v.hostConnected} />
    </div>
  );
}

type Send = ReturnType<typeof useConnection>['send'];

function JoinForm({ initialCode, conn, notice }: { initialCode: string; conn: ReturnType<typeof useConnection<PlayerView>>; notice?: string }) {
  const [code, setCode] = useState(normalizeCode(initialCode));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (conn.error) setBusy(false);
  }, [conn.error]);
  const valid = code.length === CODE_LENGTH && name.trim().length >= 2 && name.trim().length <= 14;
  return (
    <div className="screen" style={{ maxWidth: 560, justifyContent: 'center' }}>
      <div className="topbar"><button className="btn ghost sm" onClick={() => go('/nur-app')}>⬅ Zurück</button></div>
      <h1 className="gold center">Lobby beitreten</h1>
      {notice && <p className="center err">{notice}</p>}
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); if (!valid) return; setBusy(true); conn.clearError(); conn.send({ t: 'join', code, name: name.trim() }); }}>
        <label className="stack" style={{ gap: 6 }}>
          <b>Lobby-Code (steht auf dem Hauptscreen)</b>
          <input className="input code" value={code} maxLength={CODE_LENGTH} autoCapitalize="characters" autoComplete="off" inputMode="text" onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="ABCDE" />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <b>Dein Name (2 bis 14 Zeichen)</b>
          <input className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="z. B. Marie" autoComplete="nickname" />
        </label>
        {conn.error && <p className="err">{conn.error}</p>}
        <button className="btn green big" type="submit" disabled={!valid || busy}>{busy ? 'Trete bei …' : 'Beitreten'}</button>
      </form>
    </div>
  );
}

function Header({ v }: { v: PlayerView }) {
  const me = v.me;
  return (
    <div className="panel dark row between" style={{ padding: '10px 14px' }}>
      <span className="row" style={{ gap: 10 }}>
        <span style={{ width: 44, height: 52 }}><TokenSvg color={me.color} letter={me.name[0]?.toUpperCase() ?? '?'} /></span>
        <b className="head" style={{ fontSize: '1.25em' }}>{me.name}</b>
      </span>
      <span className="row" style={{ gap: 8 }}>
        {me.bonus > 0 && <span className="badge green">+{me.bonus} Bonus</span>}
        <span className="row head" style={{ gap: 4, fontSize: '1.3em' }}><CrownSvg size="1.3em" /> {me.kronen}<span className="small muted">/{v.settings.kronenZumSieg}</span></span>
      </span>
    </div>
  );
}

function WaitingRoom({ v, send, onLeave }: { v: PlayerView; send: Send; onLeave: () => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(v.me.name);
  const [ask, setAsk] = useState(false);
  return (
    <>
      <div className="card center">
        <h2>Du bist in Lobby {v.code}</h2>
        <p>Warte, bis der Hauptscreen das Spiel startet.</p>
      </div>
      <div className="panel stack">
        <h3>Mitspieler ({v.players.length})</h3>
        {v.players.map((p) => (
          <div key={p.id} className="list-item">
            <Dot color={p.color} />
            <b className="grow">{p.name}{p.id === v.me.id ? ' (du)' : ''}</b>
            <span className={`badge ${p.connected ? 'green' : 'gray'}`}>{p.connected ? 'da' : 'getrennt'}</span>
          </div>
        ))}
      </div>
      {edit ? (
        <form className="panel row" onSubmit={(e) => { e.preventDefault(); send({ t: 'rename', name }); setEdit(false); }}>
          <input className="input" style={{ flex: 1 }} value={name} maxLength={14} onChange={(e) => setName(e.target.value)} />
          <button className="btn green" type="submit">OK</button>
        </form>
      ) : (
        <div className="row center">
          <button className="btn" onClick={() => setEdit(true)}>✏️ Namen ändern</button>
          <button className="btn ghost" onClick={() => setAsk(true)}>Lobby verlassen</button>
        </div>
      )}
      {ask && <Confirm text="Lobby verlassen?" yes="Verlassen" onYes={onLeave} onNo={() => setAsk(false)} />}
    </>
  );
}

function Playing({ v, send, onExit }: { v: PlayerView; send: Send; onExit: () => void }) {
  const ph = v.phase;
  const myTurn = v.turnPlayerId === v.me.id;
  const left = useLeft(v, 'until' in ph ? (ph as { until: number }).until : null);
  if (ph.k === 'sieg') {
    const won = ph.winner === v.me.id;
    return (
      <div className="stack center" style={{ alignItems: 'center' }}>
        <Confetti duration={6000} gold={won} />
        <CrownSvg size={160} big className="crown-big" />
        <h1 className="gold">{won ? 'Du hast gewonnen!' : `${playerName(v, ph.winner)} gewinnt!`}</h1>
        <div className="panel list" style={{ width: '100%' }}>
          {[...v.players].sort((a, b) => b.kronen - a.kronen).map((p, i) => <div key={p.id} className="list-item"><b>{i + 1}.</b><Dot color={p.color} /><span className="grow">{p.name}</span>👑 {p.kronen}</div>)}
        </div>
        <p className="small">Der Hauptscreen kann eine neue Runde starten.</p>
        <button className="btn ghost" onClick={onExit}>Spiel verlassen</button>
      </div>
    );
  }
  if (ph.k === 'minispiel' && v.mini) return <PlayerMini v={v} send={send} />;
  return (
    <>
      <div className="card center" style={{ padding: 14 }}>
        <p className="head" style={{ fontSize: '1.2em', color: 'var(--red-dark)' }}>{myTurn && ph.k === 'wuerfeln' ? 'Du bist dran!' : statusText(v)}</p>
      </div>
      {myTurn ? <MyTurn v={v} send={send} left={left} /> : <Spectate v={v} />}
    </>
  );
}

function Spectate({ v }: { v: PlayerView }) {
  const ph = v.phase;
  return (
    <>
      {ph.k === 'gewuerfelt' && (
        <div className="row center"><Die value={ph.wurf} size="4em" /><span className="head" style={{ fontSize: '2em' }}>{ph.bonus ? `${ph.wurf}+${ph.bonus}=${ph.total}` : ph.wurf}</span></div>
      )}
      {ph.k === 'karte' && <div className="row center"><EventCardScene width={ph.feld ? 170 : 120} card={ph.card} feld={ph.feld} ziel={ph.ziel} info={ph.info} /></div>}
      <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={2.6} />
      <p className="center small">Deine Figur steht auf Feld {v.me.pos}.</p>
    </>
  );
}

function MyTurn({ v, send, left }: { v: PlayerView; send: Send; left: number | null }) {
  const ph = v.phase;
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (ph.k !== 'wuerfeln') setRolling(false);
  }, [ph.k]);
  // Schütteln zum Würfeln (optional)
  useEffect(() => {
    if (ph.k !== 'wuerfeln') return;
    let last = 0;
    const on = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (mag > 38 && Date.now() - last > 2000) {
        last = Date.now();
        setRolling(true);
        send({ t: 'act', a: { t: 'roll' } });
      }
    };
    window.addEventListener('devicemotion', on);
    return () => window.removeEventListener('devicemotion', on);
  }, [ph.k, send]);
  switch (ph.k) {
    case 'wuerfeln':
      return (
        <div className="stack" style={{ alignItems: 'center' }}>
          {v.me.bonus > 0 && <p className="badge green" style={{ fontSize: '1.1em' }}>+{v.me.bonus} Bonusfelder kommen automatisch dazu</p>}
          <button className="btn red huge block" disabled={rolling} onClick={() => { setRolling(true); send({ t: 'act', a: { t: 'roll' } }); }}>
            {rolling ? <Die value={1} rolling size="1em" /> : '🎲'} Würfeln
          </button>
          <p className="small muted">Tippen oder Handy schütteln</p>
          <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={2.6} />
        </div>
      );
    case 'gewuerfelt':
      return (
        <div className="stack" style={{ alignItems: 'center' }}>
          <Die value={ph.wurf} size="6em" />
          <h1 className="gold">{ph.bonus > 0 ? `${ph.wurf} + ${ph.bonus} Bonus = ${ph.total}` : `${ph.wurf}!`}</h1>
          <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={2.6} />
        </div>
      );
    case 'richtung':
      return (
        <div className="stack">
          <p className="center head">Noch {ph.remaining} {ph.remaining === 1 ? 'Feld' : 'Felder'} – wohin? {left !== null && <span className="badge">⏱ {left}s</span>}</p>
          <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={1.6} previews={ph.options} aspect={1} />
          <div className="stack" style={{ gap: 10 }}>
            {ph.options.map((o, i) => {
              const type = fieldType(o.target);
              const crownOnPath = v.crowns.filter((c) => o.path.includes(c.field));
              const col = OPTION_COLORS[i % OPTION_COLORS.length];
              return (
                <button key={o.key} className="btn big block" style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', borderColor: col, boxShadow: `0 5px 0 ${col}, inset 0 0 0 3px ${col}` }} onClick={() => send({ t: 'act', a: { t: 'direction', key: o.key } })}>
                  <span style={{ fontSize: '1.6em', width: '1.3em' }}>{o.arrow}</span>
                  <span className="stack" style={{ gap: 2, alignItems: 'flex-start', textAlign: 'left' }}>
                    <span>{o.label[0].toUpperCase() + o.label.slice(1)}</span>
                    <span className="small row" style={{ gap: 6 }}>
                      {o.final ? 'Ziel:' : 'bis Weiche:'} <FieldBadge n={o.target} showIcon={false} /> {o.final && type !== 'normal' && <FieldIcon type={type} size="1em" />}
                      {o.final && type !== 'normal' ? FIELD_TYPE_LABEL[type] : ''}
                      {crownOnPath.length > 0 ? ` 👑×${crownOnPath.reduce((s, c) => s + c.value, 0)}` : ''}
                    </span>
                    {!o.final && <span className="small muted">dann noch {ph.remaining - o.path.length} – neu entscheiden</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    case 'karteZiehen':
      return (
        <div className="stack" style={{ alignItems: 'center', gap: 20 }}>
          <h2>Ereigniskarte!</h2>
          <EventCardScene width={150} card={null} drawing deckHint="Tippe auf den Stapel" onDeckClick={() => send({ t: 'act', a: { t: 'drawCard' } })} />
          {left !== null && <p className="small" style={{ marginTop: 24 }}>Automatisch in {left}s</p>}
        </div>
      );
    case 'karte': {
      return (
        <div className="stack">
          <div className="row center">
            <EventCardScene width={ph.feld ? 200 : 140} card={ph.card} feld={ph.feld} ziel={ph.ziel} info={ph.info} />
          </div>
          {ph.stage === 'wahl' && ph.card === 'tausch' && (
            <div className="panel stack">
              <h3>Mit wem tauschst du? {left !== null && <span className="badge">⏱ {left}s</span>}</h3>
              {v.players.filter((p) => p.id !== v.me.id).map((p) => (
                <button key={p.id} className="btn big block" style={{ justifyContent: 'flex-start' }} onClick={() => send({ t: 'act', a: { t: 'tauschWahl', target: p.id } })}>
                  <Dot color={p.color} /> {p.name} <span className="grow" /> <FieldBadge n={p.pos} />
                </button>
              ))}
            </div>
          )}
          {ph.stage === 'wahl' && ph.card === 'spielWahl' && (
            <div className="panel stack">
              <h3>Welches Minispiel? {left !== null && <span className="badge">⏱ {left}s</span>}</h3>
              {v.playableGames.map((g) => (
                <button key={g} className="btn big block" onClick={() => send({ t: 'act', a: { t: 'spielWahl', game: g } })}>🎮 {gameById(g).name}</button>
              ))}
            </div>
          )}
          <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={2.6} />
        </div>
      );
    }
    default:
      return <BoardSnippet view={v} center={v.me.pos} highlight={v.me.id} zoom={2.6} />;
  }
}
