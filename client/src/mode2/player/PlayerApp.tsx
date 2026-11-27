import { useEffect, useState } from 'react';
import { PlayerView, normalizeCode, CODE_LENGTH } from '@kronen/shared';
import { useConnection, loadSession, PLAYER_KEY } from '../connection';
import { go, useRoute } from '../../lib/router';
import { useWakeLock } from '../../lib/hooks';
import { ConnBanner, useToast } from '../common';
import { emitStroke } from '../LiveDrawing';
import { emitRt } from '../rtBus';
import { PlayerShelf, SettingsButton, GiftTag } from '../LobbyParts';
import { Modal, Confirm } from '../../components/ui';
import { PlayerMini } from './PlayerMini';
import { AvatarEditor, savedAvatar } from '../../components/AvatarEditor';
import { BoardGame } from './BoardGame';

export default function PlayerApp({ initialCode = '' }: { initialCode?: string }) {
  const r = useRoute();
  const createName = r.query.get('neu') ?? undefined;
  const conn = useConnection<PlayerView>('player', { createPlay: createName, onStroke: emitStroke, onRt: emitRt });
  useWakeLock(!!conn.view);
  useEffect(() => {
    if (createName && conn.session) history.replaceState(null, '', '#/spieler');
  }, [createName, conn.session]);
  const v = conn.view;
  const toast = useToast(v);
  if (conn.closed && !v && !loadSession(PLAYER_KEY)) {
    return <JoinForm initialCode={initialCode} conn={conn} notice={conn.closed} />;
  }
  if (!v) {
    if (createName && !conn.error) return <div className="screen center"><h2>Lobby wird erstellt …</h2></div>;
    if (createName && conn.error) return <div className="screen center"><h2 className="err">{conn.error}</h2><button className="btn" onClick={() => go('/nur-app')}>Zurück</button></div>;
    if (conn.session) return <div className="screen center"><h2>Verbinde mit Lobby {conn.session.code} …</h2><button className="btn ghost" onClick={conn.forget}>Abbrechen</button></div>;
    return <JoinForm initialCode={initialCode} conn={conn} />;
  }
  const leave = () => { conn.send({ t: 'leave' }); conn.forget(); go('/nur-app'); };
  const exit = () => { conn.forget(); go('/'); };
  const close = () => { conn.send({ t: 'close' }); conn.forget(); go('/'); };
  const common = (
    <>
      {toast && <div className={`toast mobile-toast ${toast.kind}`}>{toast.text}</div>}
      {conn.error && <Modal onClose={conn.clearError}><div className="card stack center"><p className="head" style={{ fontSize: '1.2em' }}>{conn.error}</p><button className="btn" onClick={conn.clearError}>OK</button></div></Modal>}
      <ConnBanner status={conn.status} />
    </>
  );
  // Laufendes Spiel: Minispiel-Ansicht oder bildschirmfüllendes Brett
  if (v.started) {
    if (v.phase.k === 'minispiel' && v.mini)
      return (
        <div className="mini-screen">
          <PlayerMini v={v} send={conn.send} />
          {common}
        </div>
      );
    return (
      <>
        <BoardGame v={v} send={conn.send} onExit={exit} onClose={close} />
        {common}
      </>
    );
  }
  return (
    <div className="lobby-phone">
      <WaitingRoom v={v} send={conn.send} onLeave={leave} />
      {common}
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
    <div className="screen join-screen" style={{ maxWidth: 560, justifyContent: 'center' }}>
      <div className="topbar"><button className="btn ghost sm" onClick={() => go('/nur-app')}>⬅ Zurück</button></div>
      <h1 className="gold center">Lobby beitreten</h1>
      {notice && <p className="center err">{notice}</p>}
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); if (!valid) return; setBusy(true); conn.clearError(); conn.send({ t: 'join', code, name: name.trim(), avatar: savedAvatar() ?? undefined }); }}>
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
      <div className="panel stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p className="small">Dieses Gerät soll das Brett für alle zeigen (Fernseher, Tablet, Laptop) und nicht mitspielen?</p>
        <button className="btn" disabled={code.length !== CODE_LENGTH} onClick={() => go('/host?c=' + code)}>Als Hauptscreen beitreten</button>
      </div>
    </div>
  );
}

function WaitingRoom({ v, send, onLeave }: { v: PlayerView; send: Send; onLeave: () => void }) {
  const [figur, setFigur] = useState(false);
  const [ask, setAsk] = useState(false);
  const leader = v.players.find((p) => p.id === v.leaderId);
  const humans = v.players.filter((p) => !p.bot).length;
  const canStart = v.players.length >= 2 && humans >= 1;
  return (
    <>
      <div className="lobby-title">
        <span className="head gold">Kronen sammeln</span>
      </div>
      <GiftTag code={v.code} />
      <PlayerShelf v={v} send={send} canEdit={v.iAmLeader} meId={v.me.id} onEditMe={() => setFigur(true)} />
      {!v.iAmLeader && (
        <p className="center small lobby-wait">
          {v.screenMode && v.hostConnected ? 'Warte, bis der Hauptscreen das Spiel startet …' : `Warte, bis ${leader ? leader.name : 'die Lobby-Leitung'} das Spiel startet …`}
        </p>
      )}
      <div className="lobby-actions">
        <SettingsButton v={v} send={send} canEdit={v.iAmLeader} className="sm" />
        <button className="btn sm gold" onClick={() => setFigur(true)}>✎ Figur</button>
        <button className="btn sm ghost" onClick={() => setAsk(true)}>Verlassen</button>
      </div>
      {v.iAmLeader && (
        <button className="btn red big block" disabled={!canStart} onClick={() => send({ t: 'start' })}>
          {v.players.length < 2 ? 'Füge Mitspieler oder Bots hinzu' : 'Spiel starten'}
        </button>
      )}
      {v.iAmLeader && !v.hostConnected && <p className="small center muted lobby-note">Gespielt wird im Querformat · ein Fernseher kann sich mit dem Code dazuschalten</p>}
      {figur && (
        <AvatarEditor
          initial={v.me.avatar}
          color={v.me.color}
          name={v.me.name}
          onClose={() => setFigur(false)}
          onSave={(a, nm) => {
            send({ t: 'avatar', avatar: a });
            if (nm && nm !== v.me.name) send({ t: 'rename', name: nm });
            setFigur(false);
          }}
        />
      )}
      {ask && <Confirm text="Lobby verlassen?" yes="Verlassen" onYes={onLeave} onNo={() => setAsk(false)} />}
    </>
  );
}
