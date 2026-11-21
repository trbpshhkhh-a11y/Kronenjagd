import { useState } from 'react';
import { go } from '../lib/router';
import { useServerAvailable } from '../lib/server';
import { loadSession, HOST_KEY, PLAYER_KEY } from './connection';
import PlayerApp from './player/PlayerApp';

export default function Mode2Start() {
  const server = useServerAvailable();
  const host = loadSession(HOST_KEY);
  const player = loadSession(PLAYER_KEY);
  const [choose, setChoose] = useState(false);
  const [name, setName] = useState('');
  const validName = name.trim().length >= 2 && name.trim().length <= 14;
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => (choose ? setChoose(false) : go('/'))}>⬅ {choose ? 'Zurück' : 'Start'}</button>
      </div>
      <h1 className="gold center">Nur App</h1>
      {server === false && <p className="center err">Der Spielserver ist nicht erreichbar. Prüfe die Internetverbindung.</p>}
      {!choose ? (
        <>
          <p className="center">Spielt mit euren Handys – mit oder ohne Fernseher als <b>Hauptscreen</b>. Fehlen Mitspieler, könnt ihr <b>Bots</b> dazuholen.</p>
          <div className="grid2" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
            <button className="choice panel" disabled={!server} onClick={() => setChoose(true)}>
              <span className="emoji">✨</span>
              <h2>Neue Lobby erstellen</h2>
              <p>Du erstellst die Lobby und bekommst einen Code für die anderen.</p>
              <span className="btn red big">Lobby erstellen</span>
            </button>
            <button className="choice panel" disabled={!server} onClick={() => go('/beitreten')}>
              <span className="emoji">📱</span>
              <h2>Einer bestehenden Lobby beitreten</h2>
              <p>Code eingeben oder QR-Code scannen.</p>
              <span className="btn green big">Beitreten</span>
            </button>
          </div>
        </>
      ) : (
        <div className="grid2" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <div className="choice panel" style={{ cursor: 'default' }}>
            <span className="emoji">📱</span>
            <h2>Ich spiele mit</h2>
            <p>Ohne Hauptscreen: Jeder sieht alles auf seinem Handy. Du leitest die Lobby (Einstellungen, Bots, Start).</p>
            <form className="stack" style={{ width: '100%' }} onSubmit={(e) => { e.preventDefault(); if (validName) go('/spieler?neu=' + encodeURIComponent(name.trim())); }}>
              <input className="input" value={name} maxLength={14} placeholder="Dein Name" onChange={(e) => setName(e.target.value)} autoComplete="nickname" aria-label="Dein Name" />
              <button className="btn green big" type="submit" disabled={!validName}>Lobby erstellen</button>
            </form>
          </div>
          <button className="choice panel" onClick={() => go('/host?neu=1')}>
            <span className="emoji">📺</span>
            <h2>Dieses Gerät ist der Hauptscreen</h2>
            <p>Fernseher, Tablet oder Laptop zeigt das Brett für alle und spielt selbst nicht mit. Am besten im Querformat.</p>
            <span className="btn red big">Hauptscreen starten</span>
          </button>
        </div>
      )}
      <div className="row center">
        {host && <button className="btn gold" onClick={() => go('/host')}>📺 Zurück zur Lobby {host.code}</button>}
        {player && <button className="btn gold" onClick={() => go('/spieler')}>📱 Zurück ins Spiel {player.code}</button>}
      </div>
    </div>
  );
}

export function JoinScreen({ code }: { code: string }) {
  return <PlayerApp initialCode={code} />;
}
