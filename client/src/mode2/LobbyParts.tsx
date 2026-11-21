import { useState } from 'react';
import {
  BaseView, GAMES, GameId, TIMER_LABELS, TimerSettings, BOT_LEVELS, BOT_LEVEL_LABEL, BotLevel, MAX_SPIELER, requiredHumans,
} from '@kronen/shared';
import { Stepper, Die } from '../components/ui';
import { TokenSvg } from '../components/icons';
import { QR } from '../components/QR';
import { absoluteUrl } from '../lib/router';
import { displayName, tokenLetter } from './common';

type Send = (m: any) => void;

/** Spielerliste der Lobby, mit Bots (hinzufügen, Schwierigkeit, entfernen) für die Lobby-Leitung */
export function PlayerManager({ v, send, canEdit, meId }: { v: BaseView; send: Send; canEdit: boolean; meId?: string }) {
  const [level, setLevel] = useState<BotLevel>('mittel');
  const full = v.players.length >= MAX_SPIELER;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {v.players.map((p) => (
        <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
          <span style={{ width: '1.9em', height: '2.2em', flexShrink: 0 }}><TokenSvg color={p.color} letter={tokenLetter(p)} /></span>
          <span className="head grow" style={{ minWidth: '6em' }}>
            {displayName(p)}
            {p.id === meId ? ' (du)' : ''} {p.id === v.leaderId && !p.bot && (!v.screenMode || !v.hostConnected) && <span className="leader-badge" title="leitet die Lobby">👑 Leitung</span>}
          </span>
          {p.bot ? (
            canEdit ? (
              <span className="level-btns">
                {BOT_LEVELS.map((l) => (
                  <button key={l} className={`btn sm ${p.bot === l ? 'gold' : 'ghost'}`} onClick={() => send({ t: 'botLevel', playerId: p.id, level: l })}>{BOT_LEVEL_LABEL[l]}</button>
                ))}
              </span>
            ) : (
              <span className="badge blue">{BOT_LEVEL_LABEL[p.bot]}</span>
            )
          ) : (
            <span className={`badge ${p.connected ? 'green' : 'gray'}`}>{p.connected ? 'verbunden' : 'getrennt'}</span>
          )}
          {canEdit && p.id !== meId && (
            <button className="btn sm red" onClick={() => send({ t: 'kick', playerId: p.id })} aria-label={`${p.name} entfernen`}>✕</button>
          )}
        </div>
      ))}
      {v.players.length === 0 && <p className="muted">Noch niemand da.</p>}
      {canEdit && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn blue" disabled={full} onClick={() => send({ t: 'addBot', level })}>🤖 Bot hinzufügen</button>
          <span className="level-btns">
            {BOT_LEVELS.map((l) => (
              <button key={l} className={`btn sm ${level === l ? 'gold' : 'ghost'}`} onClick={() => setLevel(l)}>{BOT_LEVEL_LABEL[l]}</button>
            ))}
          </span>
        </div>
      )}
      {canEdit && full && <p className="small muted">Die Lobby ist voll (maximal {MAX_SPIELER} Spieler).</p>}
    </div>
  );
}

/** Grund, warum ein Spiel gerade nicht ausgelost wird (oder null) */
export function gameBlocker(v: BaseView, id: GameId): string | null {
  const g = GAMES.find((x) => x.id === id)!;
  const n = v.players.length;
  const humans = v.players.filter((p) => !p.bot).length;
  if (n < g.minPlayers) return `ab ${g.minPlayers} Spielern`;
  const need = requiredHumans(id, n);
  // Ohne Menschen kann ohnehin nicht gestartet werden – dann keinen Hinweis je Spiel
  if (humans > 0 && humans < need) return `braucht ${need} ${need === 1 ? 'Mensch' : 'Menschen'} (Bots können nicht zeichnen/erklären)`;
  return null;
}

/** Einstellungen der Lobby (nur die Leitung kann sie ändern) */
export function LobbySettings({ v, send, canEdit }: { v: BaseView; send: Send; canEdit: boolean }) {
  const setTimer = (k: keyof TimerSettings, val: number) => send({ t: 'settings', settings: { timer: { ...v.settings.timer, [k]: val } } });
  const toggleGame = (id: GameId) => {
    const on = v.settings.aktiveSpiele.includes(id);
    const list = on ? v.settings.aktiveSpiele.filter((g) => g !== id) : [...v.settings.aktiveSpiele, id];
    send({ t: 'settings', settings: { aktiveSpiele: list } });
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <b>Kronen zum Sieg</b>
        {canEdit ? <Stepper value={v.settings.kronenZumSieg} min={3} max={15} onChange={(k) => send({ t: 'settings', settings: { kronenZumSieg: k } })} /> : <b className="gold">{v.settings.kronenZumSieg}</b>}
      </div>
      <div className="row between">
        <b>Würfel</b>
        <span className="row"><Die value={6} size="1.1em" /> 1 Würfel, Augen 1 bis 6</span>
      </div>
      <b>Aktive Spiele</b>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11em, 1fr))', gap: 6 }}>
        {GAMES.map((g) => {
          const on = v.settings.aktiveSpiele.includes(g.id);
          const why = gameBlocker(v, g.id);
          return (
            <button key={g.id} disabled={!canEdit} className={`btn sm ${on ? 'green' : 'ghost'}`} onClick={() => toggleGame(g.id)} title={why ?? ''} style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', opacity: why ? 0.65 : 1, gap: 0 }}>
              <span>{on ? '✔' : '✖'} {g.name}</span>
              {why && on && <span style={{ fontSize: '0.7em', fontWeight: 400 }}>{why}</span>}
            </button>
          );
        })}
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Timer (Sekunden)</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'center', marginTop: 8, fontSize: '0.85em' }}>
          {(Object.keys(TIMER_LABELS) as (keyof TimerSettings)[]).map((k) => (
            <TimerRow key={k} label={TIMER_LABELS[k]} value={v.settings.timer[k]} canEdit={canEdit} onChange={(n) => setTimer(k, n)} />
          ))}
        </div>
      </details>
    </div>
  );
}

function TimerRow({ label, value, onChange, canEdit }: { label: string; value: number; onChange: (n: number) => void; canEdit: boolean }) {
  const step = value >= 60 ? 15 : 5;
  return (
    <>
      <span>{label}</span>
      <span className="row" style={{ gap: 4 }}>
        {canEdit && <button className="btn sm" style={{ minHeight: '1.6em', padding: '0 0.5em' }} onClick={() => onChange(Math.max(5, value - step))}>−</button>}
        <span className="head" style={{ minWidth: '2.2em', textAlign: 'center' }}>{value}</span>
        {canEdit && <button className="btn sm" style={{ minHeight: '1.6em', padding: '0 0.5em' }} onClick={() => onChange(Math.min(600, value + step))}>+</button>}
      </span>
    </>
  );
}

/** Code + QR-Code zum Beitreten */
export function JoinCode({ code, qrSize = 220, big }: { code: string; qrSize?: number; big?: boolean }) {
  const [qr, setQr] = useState(!!big);
  const url = absoluteUrl('/beitreten?c=' + code);
  return (
    <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
      <span className="small">Lobby-Code</span>
      <div className="head gold" style={{ fontSize: big ? '4.7em' : '2.6em', letterSpacing: '0.12em', lineHeight: 1, textShadow: '0 4px 0 rgba(0,0,0,.4)' }}>{code}</div>
      {qr ? <QR text={url} size={qrSize} /> : <button className="btn sm" onClick={() => setQr(true)}>QR-Code zeigen</button>}
      <p className="small">QR-Code scannen oder „Nur App“ → „Beitreten“ wählen und den Code eingeben.</p>
    </div>
  );
}
