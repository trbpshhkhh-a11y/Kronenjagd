import { useState } from 'react';
import { go } from '../lib/router';
import { useServerAvailable } from '../lib/server';
import { loadSession, HOST_KEY, PLAYER_KEY } from './connection';
import PlayerApp from './player/PlayerApp';
import { CrownSvg, TokenSvg } from '../components/icons';

/** Kompakte Auswahlzeile im Holzschild-Look */
function Choice({ icon, title, text, onClick, disabled, children }: { icon: React.ReactNode; title: string; text: string; onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="choice-row" onClick={onClick} disabled={disabled}>
      <span className="choice-icon">{icon}</span>
      <span className="choice-text">
        <b className="head">{title}</b>
        <span className="small">{text}</span>
        {children}
      </span>
      {onClick && <span className="choice-arrow" aria-hidden>›</span>}
    </Tag>
  );
}

export default function Mode2Start() {
  const server = useServerAvailable();
  const host = loadSession(HOST_KEY);
  const player = loadSession(PLAYER_KEY);
  const [choose, setChoose] = useState(false);
  const [name, setName] = useState('');
  const validName = name.trim().length >= 2 && name.trim().length <= 14;
  return (
    <div className="screen m2-start">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => (choose ? setChoose(false) : go('/'))}>⬅ {choose ? 'Zurück' : 'Start'}</button>
      </div>
      <div className="m2-hero">
        <CrownSvg size={64} className="crown-big" />
        <h1 className="gold">Nur App</h1>
        <p className="small">{choose ? 'Wie möchtest du spielen?' : 'Mit Handys spielen – mit oder ohne Fernseher. Fehlen Mitspieler, spielen Bots mit.'}</p>
      </div>
      {server === false && <p className="center err">Der Spielserver ist nicht erreichbar. Prüfe die Internetverbindung.</p>}
      <div className="choice-list-m2">
        {!choose ? (
          <>
            <Choice icon={<span className="choice-emblem red">+</span>} title="Neue Lobby erstellen" text="Du bekommst einen Code für die anderen." disabled={!server} onClick={() => setChoose(true)} />
            <Choice icon={<span className="choice-emblem green">→</span>} title="Einer Lobby beitreten" text="Code eingeben oder QR-Code scannen." disabled={!server} onClick={() => go('/beitreten')} />
          </>
        ) : (
          <>
            <Choice icon={<span style={{ width: 40, height: 46, display: 'block' }}><TokenSvg color="#e53935" letter="?" /></span>} title="Ich spiele mit" text="Ohne Hauptscreen – jeder sieht alles auf seinem Handy. Du leitest die Lobby.">
              <form className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (validName) go('/spieler?neu=' + encodeURIComponent(name.trim())); }}>
                <input className="input" style={{ minHeight: 44, fontSize: '1em', flex: 1, minWidth: 0 }} value={name} maxLength={14} placeholder="Dein Name" onChange={(e) => setName(e.target.value)} autoComplete="nickname" aria-label="Dein Name" />
                <button className="btn green sm" type="submit" disabled={!validName}>Los</button>
              </form>
            </Choice>
            <Choice icon={<span className="choice-emblem blue">TV</span>} title="Dieses Gerät ist der Hauptscreen" text="Zeigt das Brett für alle und spielt nicht mit. Am besten im Querformat." onClick={() => go('/host?neu=1')} />
          </>
        )}
      </div>
      <div className="row center">
        {host && <button className="btn gold sm" onClick={() => go('/host')}>Zurück zur Lobby {host.code} (Hauptscreen)</button>}
        {player && <button className="btn gold sm" onClick={() => go('/spieler')}>Zurück ins Spiel {player.code}</button>}
      </div>
    </div>
  );
}

export function JoinScreen({ code }: { code: string }) {
  return <PlayerApp initialCode={code} />;
}
