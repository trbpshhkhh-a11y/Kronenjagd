import { lazy, Suspense } from 'react';
import { useRoute, go } from './lib/router';
import { Snow, Lights } from './components/Decor';
import { CrownSvg } from './components/icons';
import { useServerAvailable } from './lib/server';
import { Mode1Provider, hasSavedMode1 } from './mode1/store';
import { Mode1App } from './mode1/Mode1App';
import { SecretView } from './SecretView';

const Mode2Start = lazy(() => import('./mode2/Mode2Start'));
const JoinScreen = lazy(() => import('./mode2/Mode2Start').then((m) => ({ default: m.JoinScreen })));
const HostApp = lazy(() => import('./mode2/host/HostApp'));
const PlayerApp = lazy(() => import('./mode2/player/PlayerApp'));
const FeldEditor = lazy(() => import('./dev/FeldEditor'));
const BoardDebug = lazy(() => import('./dev/BoardDebug'));

export function App() {
  const r = useRoute();
  const page = (() => {
    switch (r.path) {
      case '/':
        return <StartScreen />;
      case '/brett':
        return (
          <Mode1Provider>
            <Mode1App />
          </Mode1Provider>
        );
      case '/geheim':
        return <SecretView d={r.query.get('d') ?? ''} />;
      case '/nur-app':
        return <Mode2Start />;
      case '/beitreten':
        return <JoinScreen code={r.query.get('c') ?? ''} />;
      case '/host':
        return <HostApp />;
      case '/spieler':
        return <PlayerApp />;
      case '/dev/feld-editor':
        return <FeldEditor />;
      case '/dev/board-debug':
        return <BoardDebug />;
      default:
        return <StartScreen />;
    }
  })();
  const quiet = r.path === '/host' || r.path.startsWith('/dev') || r.path === '/geheim';
  return (
    <>
      {!quiet && <Snow />}
      {!quiet && <Lights />}
      <Suspense fallback={<div className="screen center"><h2>Lädt …</h2></div>}>{page}</Suspense>
    </>
  );
}

function StartScreen() {
  const server = useServerAvailable();
  const saved = hasSavedMode1();
  return (
    <div className="screen" style={{ justifyContent: 'center', paddingTop: 50 }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <CrownSvg className="crown-big" />
        <h1 className="gold" style={{ textShadow: '0 5px 0 rgba(0,0,0,.4)' }}>Kronen sammeln</h1>
        <p className="head" style={{ fontSize: '1.2em' }}>Das Weihnachts-Brettspiel</p>
      </div>
      <div className="grid2" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <button className="choice panel" onClick={() => go('/brett')}>
          <span className="emoji">🎲</span>
          <h2>Mit Spielbrett</h2>
          <p>Ihr spielt am echten Brett mit Figuren und Würfel. Die App ist euer Spielleiter: Sie lost aus, zeigt Aufgaben und zählt Kronen.</p>
          {saved && <span className="badge">Laufendes Spiel fortsetzen</span>}
          <span className="btn red big" style={{ marginTop: 8 }}>Los geht’s</span>
        </button>
        <button className="choice panel" disabled={server === false} onClick={() => go('/nur-app')}>
          <span className="emoji">📺📱</span>
          <h2>Nur App</h2>
          <p>Das ganze Spiel in der App: Ein Fernseher oder Monitor zeigt das Brett, jeder steuert mit seinem Handy.</p>
          {server === null && <span className="small muted">Suche Server …</span>}
          {server === false && <span className="badge red">Kein Server erreichbar – „Nur App“ braucht Internet und den Spielserver (siehe README).</span>}
          <span className="btn green big" style={{ marginTop: 8 }}>Lobby öffnen</span>
        </button>
      </div>
    </div>
  );
}
