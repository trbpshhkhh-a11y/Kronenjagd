/**
 * Spielansicht auf dem Handy (Modus 2), sobald das Spiel läuft und kein Minispiel ist:
 * Querformat, das Brett füllt den Bildschirm, alle Infos kompakt am Rand,
 * Würfel / Ereigniskarte / Spielertausch / Sieg als Overlays.
 * Die Richtung wird direkt auf dem Brett angetippt.
 */
import { useEffect, useState } from 'react';
import { PlayerView, BOARD, gameById } from '@kronen/shared';
import { BoardLayer, CrownTable, statusText, useLeft, playerName, displayName, tokenLetter, useViewport, RotateHint, BonusAnsage } from '../common';
import { Die, Dot, FieldBadge } from '../../components/ui';
import { CrownSvg } from '../../components/icons';
import { AvatarFace } from '../../components/Avatar';
import { AvatarEditor } from '../../components/AvatarEditor';
import { Confetti } from '../../components/Decor';
import { EventCardScene } from '../../components/EventCard';

type Send = (m: any) => void;
const ASPECT = BOARD.data.width / BOARD.data.height;

export function BoardGame({ v, send, onExit, onClose }: { v: PlayerView; send: Send; onExit: () => void; onClose: () => void }) {
  const { w, h } = useViewport();
  const land = w > h;
  const ph = v.phase;
  const myTurn = v.turnPlayerId === v.me.id;
  const picking = myTurn && ph.k === 'richtung';

  // Brettgröße: so groß wie möglich, Platz für die Randspalte lassen
  let bw: number;
  let bh: number;
  let sideW = 0;
  if (land) {
    const minSide = Math.min(280, Math.max(150, w * 0.2));
    bh = h;
    bw = h * ASPECT;
    if (w - bw < minSide) {
      bw = w - minSide;
      bh = bw / ASPECT;
    }
    sideW = w - bw;
  } else {
    bw = w;
    bh = w / ASPECT;
  }

  const boardView = ph.k === 'intro' ? { ...v, players: v.players.map((p) => ({ ...p, pos: 0 })) } : v;
  const board = (
    <div style={{ position: 'relative', width: bw, height: bh, flexShrink: 0 }}>
      <BoardLayer
        view={boardView}
        highlight={ph.k === 'intro' ? null : v.turnPlayerId}
        jump={ph.k === 'karte'}
        previews={ph.k === 'richtung' ? ph.options : undefined}
        onPick={picking ? (key) => send({ t: 'act', a: { t: 'direction', key } }) : undefined}
      />
      {picking && <div className="pick-hint">Tippe auf einen leuchtenden Weg</div>}
    </div>
  );

  const side = <Side v={v} send={send} land={land} />;

  return (
    <div className="game-screen" style={{ height: land ? h : undefined, minHeight: h }}>
      {land ? (
        <div style={{ display: 'flex', height: h }}>
          <div style={{ width: bw, height: h, display: 'flex', alignItems: 'center' }}>{board}</div>
          <div className="game-side" style={{ width: sideW, height: h }}>{side}</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10, paddingBottom: 20 }}>
          <div style={{ padding: '10px 10px 0' }}><RotateHint /></div>
          {board}
          <div style={{ padding: '0 12px' }}>{side}</div>
        </div>
      )}
      {ph.k === 'intro' && <IntroOverlay v={v} send={send} />}
      {ph.k === 'gewuerfelt' && <DiceOverlay v={v} land={land} />}
      {ph.k === 'bonusStart' && <div className="phone-overlay" style={{ background: 'rgba(10,5,2,.35)', pointerEvents: 'none' }}><BonusAnsage v={v} /></div>}
      {(ph.k === 'karteZiehen' || ph.k === 'karte') && <CardOverlay v={v} send={send} land={land} h={h} />}
      {ph.k === 'sieg' && <VictoryOverlay v={v} send={send} onExit={onExit} onClose={onClose} land={land} />}
    </div>
  );
}

/* --------------------------- Randspalte ----------------------------- */

function Side({ v, send, land }: { v: PlayerView; send: Send; land: boolean }) {
  const ph = v.phase;
  const me = v.me;
  const myTurn = v.turnPlayerId === me.id;
  const left = useLeft(v, ph.k === 'richtung' ? ph.until : null);
  const [rolling, setRolling] = useState(false);
  const [figur, setFigur] = useState(false);
  useEffect(() => {
    if (ph.k !== 'wuerfeln') setRolling(false);
  }, [ph.k]);
  // Schütteln zum Würfeln (optional)
  useEffect(() => {
    if (ph.k !== 'wuerfeln' || !myTurn) return;
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
  }, [ph.k, myTurn, send]);

  return (
    <div className="stack" style={{ gap: land ? 8 : 10 }}>
      <div className="side-me">
        <button className="side-face" onClick={() => setFigur(true)} aria-label="Figur ändern" title="Figur ändern"><AvatarFace a={me.avatar} color={me.color} /><span className="ptile-pen">✎</span></button>
        <span className="grow" style={{ minWidth: 0 }}>
          <b className="head ellipsis">{me.name}</b>
          {v.iAmLeader && <span className="badge" style={{ fontSize: '0.65em', marginLeft: 4 }}>Leitung</span>}
          <span className="row" style={{ gap: 6, fontSize: '0.95em' }}>
            <span className="row head" style={{ gap: 3 }}><CrownSvg size="1.1em" /> {me.kronen}<span className="muted small">/{v.settings.kronenZumSieg}</span></span>
            {me.bonus > 0 && <span className="badge green" style={{ fontSize: '0.75em' }}>+{me.bonus} Bonus</span>}
          </span>
        </span>
      </div>
      {v.bonusRunde && <div className="side-bonus">Bonusrunde – Sonderfelder ruhen</div>}
      <div className="side-status">{myTurn && ph.k === 'wuerfeln' ? 'Du bist dran!' : myTurn && v.bonusRunde && ph.k === 'richtung' ? 'Deine Bonusfelder!' : statusText(v)}</div>
      {myTurn && ph.k === 'wuerfeln' && (
        <>
          <button className="btn red big block" disabled={rolling} onClick={() => { setRolling(true); send({ t: 'act', a: { t: 'roll' } }); }}>
            {rolling ? <Die value={1} rolling size="0.9em" /> : null} Würfeln
          </button>
          <span className="small muted center">Tippen oder Handy schütteln</span>
        </>
      )}
      {myTurn && ph.k === 'richtung' && (
        <div className="side-pick">
          Tippe auf das Brett, um die Richtung zu wählen – noch <b>{ph.remaining}</b> {ph.remaining === 1 ? 'Feld' : 'Felder'}
          {left !== null && <span className="badge" style={{ marginLeft: 6 }}>{left}s</span>}
        </div>
      )}
      {figur && (
        <AvatarEditor
          initial={me.avatar}
          color={me.color}
          onClose={() => setFigur(false)}
          onSave={(av) => {
            send({ t: 'avatar', avatar: av });
            setFigur(false);
          }}
        />
      )}
      <details className="side-crowns" open>
        <summary className="head">Kronentafel</summary>
        <CrownTable view={v} compact />
      </details>
      <span className="small muted center">Lobby {v.code}{v.hostConnected ? ' · Hauptscreen verbunden' : ''}</span>
    </div>
  );
}

/* ----------------------------- Overlays ----------------------------- */

function Overlay({ children, dim = 0.55 }: { children: React.ReactNode; dim?: number }) {
  return (
    <div className="phone-overlay" style={{ background: `rgba(15,7,2,${dim})` }}>
      {children}
    </div>
  );
}

function IntroOverlay({ v, send }: { v: PlayerView; send: Send }) {
  return (
    <Overlay dim={0.7}>
      <div className="panel stack" style={{ maxWidth: 520, width: '100%', gap: 8 }}>
        <h3 className="gold center">Startfelder & Reihenfolge</h3>
        <div className="intro-grid">
          {v.order.map((id, i) => {
            const p = v.players.find((x) => x.id === id)!;
            return (
              <div key={id} className="list-item" style={{ animation: `cardIn .4s ${i * 0.25}s both`, padding: '4px 8px' }}>
                <b className="head gold">{i + 1}.</b>
                <span style={{ width: '1.8em', height: '1.8em' }}><AvatarFace a={p.avatar} color={p.color} /></span>
                <span className="grow head ellipsis">{displayName(p)}{p.id === v.me.id ? ' (du)' : ''}</span>
                <FieldBadge n={p.start} showIcon={false} />
              </div>
            );
          })}
        </div>
        {v.iAmLeader && <button className="btn ghost sm" onClick={() => send({ t: 'host', a: { t: 'weiter' } })}>Überspringen</button>}
      </div>
    </Overlay>
  );
}

function DiceOverlay({ v, land }: { v: PlayerView; land: boolean }) {
  const ph = v.phase;
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRolling(false), 1000);
    return () => clearTimeout(t);
  }, []);
  if (ph.k !== 'gewuerfelt') return null;
  return (
    <Overlay dim={0.3}>
      <div className={land ? 'row' : 'stack'} style={{ gap: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Die value={ph.wurf} rolling={rolling} size={land ? '4.5em' : '5em'} />
        <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
          <span className="head">{playerName(v, v.turnPlayerId)} würfelt …</span>
          {!rolling && <span className="head gold" style={{ fontSize: '2.2em', animation: 'pop .4s' }}>{ph.bonus ? `${ph.wurf} + ${ph.bonus} = ${ph.total}` : `${ph.wurf}!`}</span>}
        </div>
      </div>
    </Overlay>
  );
}

function CardOverlay({ v, send, land, h }: { v: PlayerView; send: Send; land: boolean; h: number }) {
  const ph = v.phase;
  const myTurn = v.turnPlayerId === v.me.id;
  const left = useLeft(v, ph.k === 'karteZiehen' || ph.k === 'karte' ? ph.until : null);
  const cardW = Math.round(Math.max(90, Math.min(170, (land ? h : h * 0.5) * 0.36)));
  const feld = ph.k === 'karte' && !!ph.feld;
  const choosing = myTurn && ph.k === 'karte' && ph.stage === 'wahl';
  return (
    <Overlay dim={0.6}>
      <div className={land ? 'row' : 'stack'} style={{ gap: land ? 28 : 16, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <EventCardScene
          width={feld ? Math.round(cardW * 1.15) : cardW}
          card={ph.k === 'karte' ? ph.card : null}
          feld={feld}
          ziel={ph.k === 'karte' ? ph.ziel : undefined}
          info={ph.k === 'karte' ? ph.info : undefined}
          drawing={ph.k === 'karteZiehen'}
          onDeckClick={myTurn && ph.k === 'karteZiehen' ? () => send({ t: 'act', a: { t: 'drawCard' } }) : undefined}
          deckHint={myTurn && ph.k === 'karteZiehen' ? 'Tippe auf den Stapel' : undefined}
        />
        <div className="stack" style={{ gap: 6, maxWidth: 360, width: land ? 'auto' : '100%' }}>
          {!myTurn && <p className="head center">{playerName(v, v.turnPlayerId)} {ph.k === 'karteZiehen' ? 'zieht eine Ereigniskarte …' : feld ? 'darf tauschen …' : ''}</p>}
          {choosing && ph.card === 'tausch' && (
            <>
              <b>Mit wem tauschst du? {left !== null && <span className="badge">{left}s</span>}</b>
              <div className="choice-list">
                {v.players.filter((p) => p.id !== v.me.id).map((p) => (
                  <button key={p.id} className="btn sm block" style={{ justifyContent: 'flex-start' }} onClick={() => send({ t: 'act', a: { t: 'tauschWahl', target: p.id } })}>
                    <Dot color={p.color} /> <span className="grow ellipsis" style={{ textAlign: 'left' }}>{displayName(p)}</span> <span className="small">Feld {p.pos}</span>
                  </button>
                ))}
              </div>
              <button className="btn sm ghost block" onClick={() => send({ t: 'act', a: { t: 'tauschWahl', target: null } })}>✋ Nicht tauschen</button>
            </>
          )}
          {choosing && ph.card === 'spielWahl' && (
            <>
              <b>Welches Minispiel? {left !== null && <span className="badge">{left}s</span>}</b>
              <div className="choice-list two">
                {v.playableGames.map((g) => (
                  <button key={g} className="btn sm block" onClick={() => send({ t: 'act', a: { t: 'spielWahl', game: g } })}>{gameById(g).name}</button>
                ))}
              </div>
            </>
          )}
          {myTurn && ph.k === 'karteZiehen' && left !== null && <span className="small center">Automatisch in {left}s</span>}
        </div>
      </div>
    </Overlay>
  );
}

function VictoryOverlay({ v, send, onExit, onClose, land }: { v: PlayerView; send: Send; onExit: () => void; onClose: () => void; land: boolean }) {
  const ph = v.phase;
  if (ph.k !== 'sieg') return null;
  const won = ph.winner === v.me.id;
  return (
    <Overlay dim={0.85}>
      <Confetti duration={6000} gold={won} />
      <div className={land ? 'row' : 'stack'} style={{ gap: 24, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 900 }}>
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <CrownSvg size={land ? 90 : 120} big className="crown-big" />
          <h2 className="gold center">{won ? 'Du hast gewonnen!' : `${playerName(v, ph.winner)} gewinnt!`}</h2>
        </div>
        <div className="stack" style={{ gap: 8, minWidth: 240, flex: 1 }}>
          <div className="panel list" style={{ padding: 8, gap: 4 }}>
            {[...v.players].sort((a, b) => b.kronen - a.kronen).map((p, i) => (
              <div key={p.id} className="list-item" style={{ padding: '3px 8px' }}><b>{i + 1}.</b><Dot color={p.color} /><span className="grow ellipsis">{displayName(p)}</span>{p.kronen}</div>
            ))}
          </div>
          {v.iAmLeader ? (
            <>
              <button className="btn red block" onClick={() => send({ t: 'host', a: { t: 'neueRunde' } })}>Neue Runde mit denselben Spielern</button>
              <button className="btn ghost sm block" onClick={onClose}>Lobby beenden</button>
            </>
          ) : (
            <>
              <span className="small center">{v.screenMode && v.hostConnected ? 'Der Hauptscreen' : 'Die Lobby-Leitung'} kann eine neue Runde starten.</span>
              <button className="btn ghost sm" onClick={onExit}>Spiel verlassen</button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
