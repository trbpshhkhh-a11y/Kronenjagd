import { useState } from 'react';
import {
  BaseView, GAMES, GameId, TIMER_LABELS, TimerSettings, BOT_LEVELS, BOT_LEVEL_LABEL, MAX_SPIELER, requiredHumans,
} from '@kronen/shared';
import { Stepper, Die, Modal } from '../components/ui';
import { TokenSvg, CrownSvg } from '../components/icons';
import { QR } from '../components/QR';
import { absoluteUrl } from '../lib/router';
import { tokenLetter } from './common';

type Send = (m: any) => void;

/**
 * Spielerleiste der Lobby: Figuren auf einem Holzsims.
 * Die Lobby-Leitung kann Bots hinzufügen (+ Bot), ihre Schwierigkeit umschalten (Antippen) und Spieler entfernen.
 */
export function PlayerShelf({ v, send, canEdit, meId, big }: { v: BaseView; send: Send; canEdit: boolean; meId?: string; big?: boolean }) {
  const full = v.players.length >= MAX_SPIELER;
  const many = v.players.length + (canEdit ? 1 : 0) > 6;
  const nextLevel = (l: (typeof BOT_LEVELS)[number]) => BOT_LEVELS[(BOT_LEVELS.indexOf(l) + 1) % BOT_LEVELS.length];
  const showLeader = !v.screenMode || !v.hostConnected;
  return (
    <div className={`shelf ${big ? 'big' : ''} ${many ? 'many' : ''}`}>
      <div className="shelf-head">
        <span className="head">Mitspieler</span>
        <span className="shelf-count">{v.players.length}/{MAX_SPIELER}</span>
      </div>
      <div className="shelf-grid">
        {v.players.map((p) => (
          <div key={p.id} className={`ptile ${p.id === meId ? 'me' : ''}`}>
            <span className="ptile-token"><TokenSvg color={p.color} letter={tokenLetter(p)} /></span>
            <span className="ptile-name">
              <span className="ellipsis">{p.bot ? p.name.replace(/^Bot /, '') : p.name}</span>
              {p.bot ? (
                canEdit ? (
                  <button className="lvl" onClick={() => send({ t: 'botLevel', playerId: p.id, level: nextLevel(p.bot!) })} title="Schwierigkeit ändern (antippen)">
                    {BOT_LEVEL_LABEL[p.bot]} ⟳
                  </button>
                ) : (
                  <span className="lvl ro">{BOT_LEVEL_LABEL[p.bot]}</span>
                )
              ) : (
                <span className={`conn ${p.connected ? 'on' : ''}`}>
                  {showLeader && p.id === v.leaderId ? <><CrownSvg size="1em" /> Leitung</> : p.connected ? 'da' : 'getrennt'}
                </span>
              )}
            </span>
            {canEdit && p.id !== meId && (
              <button className="ptile-x" onClick={() => send({ t: 'kick', playerId: p.id })} aria-label={`${p.name} entfernen`}>✕</button>
            )}
          </div>
        ))}
        {canEdit && !full && (
          <button className="ptile add" onClick={() => send({ t: 'addBot', level: 'mittel' })}>
            <span className="add-plus">+</span> Bot
          </button>
        )}
      </div>
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
      <div className="game-chips">
        {GAMES.map((g) => {
          const on = v.settings.aktiveSpiele.includes(g.id);
          const why = gameBlocker(v, g.id);
          return (
            <button key={g.id} disabled={!canEdit} className={`gchip ${on ? 'on' : ''} ${why ? 'warn' : ''}`} onClick={() => toggleGame(g.id)} title={why ?? ''}>
              {on ? '✓' : '–'} {g.name}
              {why && on && <span className="gchip-why">{why}</span>}
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

/** Kurze Zusammenfassung der Einstellungen + Button, der sie in einem eigenen Fenster öffnet */
export function SettingsButton({ v, send, canEdit, className = '', showSummary }: { v: BaseView; send: Send; canEdit: boolean; className?: string; showSummary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${className}`} onClick={() => setOpen(true)} title={`${v.settings.kronenZumSieg} Kronen zum Sieg · ${v.settings.aktiveSpiele.length} Spiele aktiv`}>
        ⚙ Einstellungen{showSummary && <span className="small" style={{ fontWeight: 400 }}> · {v.settings.kronenZumSieg} Kronen · {v.settings.aktiveSpiele.length} Spiele</span>}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="panel stack">
            <h2>Einstellungen</h2>
            {!canEdit && <p className="small">Nur die Lobby-Leitung kann die Einstellungen ändern.</p>}
            <LobbySettings v={v} send={send} canEdit={canEdit} />
            <button className="btn gold" onClick={() => setOpen(false)}>Fertig</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Lobby-Code als Geschenkanhänger, QR-Code auf Wunsch oder direkt */
export function GiftTag({ code, qr = false, qrSize = 220 }: { code: string; qr?: boolean; qrSize?: number }) {
  const [showQr, setShowQr] = useState(false);
  const url = absoluteUrl('/beitreten?c=' + code);
  return (
    <div className={`gift-tag ${qr ? 'with-qr' : ''}`}>
      <span className="gift-hole" aria-hidden />
      <span className="gift-main">
        <span className="gift-label">Lobby-Code</span>
        <span className="gift-code">{code}</span>
        {qr && <span className="gift-hint">Code eingeben oder QR-Code scannen</span>}
      </span>
      {qr ? <QR text={url} size={qrSize} /> : <button className="btn sm gift-qr" onClick={() => setShowQr(true)}>QR</button>}
      {showQr && (
        <Modal onClose={() => setShowQr(false)}>
          <div className="card stack center" style={{ alignItems: 'center' }}>
            <h2>{code}</h2>
            <QR text={url} size={260} />
            <p>Mit der Handy-Kamera scannen</p>
            <button className="btn" onClick={() => setShowQr(false)}>Schließen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
