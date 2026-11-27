import { useEffect, useState } from 'react';
import { HostView } from '@kronen/shared';
import { useConnection } from '../connection';
import { useRoute, go } from '../../lib/router';
import { useWakeLock } from '../../lib/hooks';
import { load, save } from '../../lib/storage';
import { Stage, BoardLayer, CrownTable, statusText, useLeft, playerName, playerOf, useToast, usePortrait, displayName, tokenLetter, RotateHint, BonusAnsage } from '../common';
import { Die, Dot, FieldBadge, Confirm } from '../../components/ui';
import { CrownSvg } from '../../components/icons';
import { AvatarFace } from '../../components/Avatar';
import { Snow, Confetti } from '../../components/Decor';
import { SlotRoller, FIELD_NUMBERS } from '../../components/Roller';
import { HostMini } from './HostMini';
import { EventCardScene } from '../../components/EventCard';
import { emitStroke } from '../LiveDrawing';
import { emitRt } from '../rtBus';
import { PlayerShelf, SettingsButton, GiftTag } from '../LobbyParts';

export default function HostApp() {
  const r = useRoute();
  const create = r.query.get('neu') === '1';
  const joinCode = r.query.get('c') ?? undefined;
  const conn = useConnection<HostView>('host', { create, joinScreen: joinCode, onStroke: emitStroke, onRt: emitRt });
  useWakeLock(true);
  useEffect(() => {
    if ((create || joinCode) && conn.session) history.replaceState(null, '', '#/host');
  }, [create, joinCode, conn.session]);
  const v = conn.view;
  return (
    <div className="host-root">
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
            {conn.error && <p className="err">{conn.error}</p>}
            {(conn.error || (!create && !joinCode && !conn.session)) && <button className="btn big" onClick={() => go('/nur-app')}>Zurück</button>}
          </Centered>
        ) : !v.started ? (
          <Lobby v={v} send={conn.send} error={conn.error} clearError={conn.clearError} onClose={() => { conn.send({ t: 'close' }); conn.forget(); go('/nur-app'); }} />
        ) : (
          <Game v={v} send={conn.send} onExit={() => { conn.forget(); go('/'); }} />
        )}
        {conn.status !== 'open' && v && (
          <div className="badge red" style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 24, zIndex: 50 }}>Verbindung wird wiederhergestellt …</div>
        )}
      </Stage>
      {!v?.started && <PortraitTip />}
    </div>
  );
}

/** Kleiner, schließbarer Hinweis im Hochformat */
function PortraitTip() {
  const [hidden, setHidden] = useState(() => load('kj_hochformat_tipp', false));
  const [portrait, setPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (!portrait || hidden) return null;
  return (
    <div className="portrait-tip badge">
      🔄 Im Querformat sieht es am besten aus
      <button className="btn sm ghost" style={{ minHeight: 28, padding: '0 8px', color: 'var(--ink)', borderColor: 'var(--ink)' }} onClick={() => { setHidden(true); save('kj_hochformat_tipp', true); }} aria-label="Hinweis schließen">✕</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', padding: 40 }}>{children}</div>;
}

type Send = ReturnType<typeof useConnection>['send'];

/* ------------------------------ Lobby ------------------------------ */

function Lobby({ v, send, error, clearError, onClose }: { v: HostView; send: Send; error: string | null; clearError: () => void; onClose: () => void }) {
  const portrait = usePortrait();
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);
  const humans = v.players.filter((p) => !p.bot).length;
  const canStart = v.players.length >= 2 && humans >= 1;
  return (
    <div className="host-lobby" style={portrait ? { padding: 40, display: 'flex', flexDirection: 'column', gap: 30 } : { position: 'absolute', inset: 0, padding: '50px 70px', display: 'grid', gridTemplateColumns: '600px 1fr', gap: 60, alignItems: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 24 }}>
        <div className="lobby-title" style={{ fontSize: 34 }}>
          <span className="head gold">Kronen sammeln</span>
          <span className="small">Nur App · Hauptscreen</span>
        </div>
        <GiftTag code={v.code} qr qrSize={portrait ? 300 : 320} />
      </div>
      <div className="stack" style={{ gap: 24, fontSize: 30 }}>
        <PlayerShelf v={v} send={send} canEdit big />
        {error && <p className="err">{error}</p>}
        <div className="row" style={{ gap: 16 }}>
          <SettingsButton v={v} send={send} canEdit className="grow" showSummary />
          <button className="btn ghost" onClick={() => setAsk(true)}>Lobby schließen</button>
        </div>
        <button className="btn red huge block" disabled={!canStart} onClick={() => send({ t: 'start' })}>
          {v.players.length < 2 ? 'Mindestens 2 Spieler nötig' : humans < 1 ? 'Mindestens 1 Mensch nötig' : 'Spiel starten'}
        </button>
      </div>
      {ask && <Confirm text="Lobby wirklich schließen?" yes="Ja, schließen" onYes={onClose} onNo={() => setAsk(false)} />}
    </div>
  );
}

/* ------------------------------ Spiel ------------------------------ */

function Game({ v, send, onExit }: { v: HostView; send: Send; onExit: () => void }) {
  const portrait = usePortrait();
  const toast = useToast(v);
  const ph = v.phase;
  const cur = playerOf(v, v.turnPlayerId);
  const showMini = ph.k === 'minispiel' && v.mini;
  const boardView = ph.k === 'intro' ? { ...v, players: v.players.map((p) => ({ ...p, pos: 0 })) } : v;
  const board = <BoardLayer view={boardView} highlight={ph.k === 'intro' ? null : v.turnPlayerId} jump={ph.k === 'karte'} previews={ph.k === 'richtung' ? ph.options : undefined} />;
  const status = (
    <div className="panel dark" style={portrait ? { display: 'flex', alignItems: 'center', gap: 20, padding: '12px 24px' } : { position: 'absolute', left: 16, right: 16, bottom: 8, height: 112, zIndex: 20, display: 'flex', alignItems: 'center', gap: 24, padding: '8px 28px' }}>
      {cur && <span style={{ width: 74, height: 74, flexShrink: 0 }}><AvatarFace a={cur.avatar} color={cur.color} /></span>}
      <span className="head grow" style={{ fontSize: portrait ? 36 : 40 }}>{statusText(v)}</span>
      {v.bonusRunde && <span className="badge green" style={{ fontSize: 28 }}>Bonusrunde · Sonderfelder ruhen</span>}
      {ph.k === 'gewuerfelt' && <Die value={ph.wurf} size="52px" />}
      {ph.k === 'richtung' && <DirTimer v={v} until={ph.until} />}
    </div>
  );
  const table = <CrownTable view={ph.k === 'intro' ? { ...v, turnPlayerId: null } : v} />;
  const overlays = (
    <>
      {toast && <div className={`toast ${toast.kind}`} style={portrait ? { whiteSpace: 'normal', maxWidth: 1000, textAlign: 'center' } : undefined}>{toast.text}</div>}
      {ph.k === 'intro' && <Intro v={v} send={send} />}
      {ph.k === 'gewuerfelt' && <DiceOverlay v={v} />}
      {ph.k === 'bonusStart' && <Overlay dim={0.3}><BonusAnsage v={v} big /></Overlay>}
      {(ph.k === 'karteZiehen' || ph.k === 'karte') && <CardOverlay v={v} />}
      {showMini && <HostMini v={v} send={send} />}
      {ph.k === 'sieg' && <Victory v={v} send={send} onExit={onExit} />}
    </>
  );
  if (portrait) {
    return (
      <div style={{ position: 'relative', minHeight: 'inherit' }}>
        <div style={{ padding: '20px 20px 10px' }}><RotateHint big /></div>
        <div className="row between" style={{ padding: '8px 20px' }}>
          <span className="head gold" style={{ fontSize: 40 }}>Kronen sammeln</span>
          <span className="badge" style={{ fontSize: 26 }}>Code {v.code}</span>
        </div>
        <div style={{ width: 1080 }}>{board}</div>
        <div className="stack" style={{ padding: 20, gap: 20, fontSize: 30 }}>
          {status}
          {table}
        </div>
        {overlays}
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Brett füllt den größten Teil der Bühne */}
      <div style={{ position: 'absolute', top: 0, left: 200, width: 1519 }}>{board}</div>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, fontSize: 26 }}>{table}</div>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }} className="badge" title="Lobby-Code">Code {v.code}</div>
      {status}
      {overlays}
    </div>
  );
}

function DirTimer({ v, until }: { v: HostView; until: number }) {
  const left = useLeft(v, until);
  return <span className="head" style={{ fontSize: 40 }}>⏱ {left}</span>;
}

export function Overlay({ children, dim = 0.6 }: { children: React.ReactNode; dim?: number }) {
  const portrait = usePortrait();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: `rgba(15,7,2,${dim})`, display: 'flex', alignItems: 'center', justifyContent: portrait ? 'flex-start' : 'center', flexDirection: 'column', gap: 30, animation: 'fade .3s', overflowY: 'auto', padding: portrait ? '60px 30px' : 0, textAlign: 'center' }}>
      {children}
    </div>
  );
}

function Intro({ v, send }: { v: HostView; send: Send }) {
  const portrait = usePortrait();
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, 340px)', gap: 20, width: portrait ? '100%' : 1600, justifyContent: 'center' }}>
          {players.map((p, i) => (
            <div key={p.id} className="panel row between" style={{ opacity: i <= step ? 1 : 0.35, fontSize: 30 }}>
              <span className="row"><Dot color={p.color} /> <b>{displayName(p)}</b></span>
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
                <span style={{ width: 80, height: 80 }}><AvatarFace a={p.avatar} color={p.color} /></span>
                <b>{displayName(p)}</b>
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
  const portrait = usePortrait();
  const ph = v.phase;
  const name = playerName(v, v.turnPlayerId);
  const feld = ph.k === 'karte' && !!ph.feld;
  return (
    <Overlay dim={0.55}>
      <div className={portrait ? 'stack' : 'row'} style={{ gap: 70, alignItems: 'center' }}>
        <EventCardScene
          width={feld ? 380 : portrait ? 300 : 330}
          card={ph.k === 'karte' ? ph.card : null}
          feld={feld}
          ziel={ph.k === 'karte' ? ph.ziel : undefined}
          info={ph.k === 'karte' ? ph.info : undefined}
          drawing={ph.k === 'karteZiehen'}
        />
        <div className="panel dark stack" style={{ maxWidth: 560, fontSize: 36 }}>
          <h2 className="gold">{name}</h2>
          {ph.k === 'karteZiehen' && <p>zieht eine Ereigniskarte …</p>}
          {feld && ph.k === 'karte' && ph.stage !== 'fertig' && <p>ist auf einem gelben Feld gelandet und darf die Position mit einem Mitspieler tauschen.</p>}
          {ph.k === 'karte' && ph.stage === 'wahl' && ph.card === 'tausch' && <p>wählt, mit wem getauscht wird …</p>}
          {ph.k === 'karte' && ph.stage === 'wahl' && ph.card === 'spielWahl' && <p>sucht ein Minispiel aus …</p>}
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
      <h1 className="gold" style={{ fontSize: 130 }}>{w ? displayName(w) : '?'} gewinnt!</h1>
      <p className="head" style={{ fontSize: 48 }}>mit {w?.kronen} Kronenpunkten</p>
      <div className="row center" style={{ gap: 20 }}>
        {[...v.players].sort((a, b) => b.kronen - a.kronen).map((p, i) => (
          <span key={p.id} className="chip" style={{ fontSize: 30 }}>{i + 1}. <Dot color={p.color} /> {displayName(p)} · {p.kronen} 👑</span>
        ))}
      </div>
      <div className="row center" style={{ gap: 24 }}>
        <button className="btn red big" onClick={() => send({ t: 'host', a: { t: 'neueRunde' } })}>🔁 Neue Runde mit denselben Spielern</button>
        <button className="btn big" onClick={onExit}>Zum Startscreen</button>
      </div>
    </Overlay>
  );
}
