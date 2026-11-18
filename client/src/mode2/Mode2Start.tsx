import { go } from '../lib/router';
import { useServerAvailable } from '../lib/server';
import { loadSession, HOST_KEY, PLAYER_KEY } from './connection';
import PlayerApp from './player/PlayerApp';

export default function Mode2Start() {
  const server = useServerAvailable();
  const host = loadSession(HOST_KEY);
  const player = loadSession(PLAYER_KEY);
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => go('/')}>⬅ Start</button>
      </div>
      <h1 className="gold center">Nur App</h1>
      <p className="center">Ein Gerät im Querformat (Fernseher, Monitor, Laptop) ist der <b>Hauptscreen</b>. Jeder Mitspieler steuert mit seinem eigenen <b>Handy</b>.</p>
      {server === false && <p className="center err">Der Spielserver ist nicht erreichbar. Prüfe die Internetverbindung.</p>}
      <div className="grid2" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <button className="choice panel" disabled={!server} onClick={() => go('/host?neu=1')}>
          <span className="emoji">📺</span>
          <h2>Neue Lobby erstellen</h2>
          <p>Auf dem Gerät, das das Brett zeigt (Querformat). Dieses Gerät spielt nicht selbst mit.</p>
          <span className="btn red big">Lobby erstellen</span>
        </button>
        <button className="choice panel" disabled={!server} onClick={() => go('/beitreten')}>
          <span className="emoji">📱</span>
          <h2>Einer bestehenden Lobby beitreten</h2>
          <p>Auf deinem Handy: Code eingeben oder QR-Code scannen.</p>
          <span className="btn green big">Beitreten</span>
        </button>
      </div>
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
