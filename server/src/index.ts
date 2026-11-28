/**
 * Kronen sammeln – Server für Modus 2 ("Nur App").
 * Liefert den gebauten Client aus und synchronisiert Hauptscreen und Handys per WebSocket.
 * Der Server ist maßgeblich: Er hält den Spielzustand und verschickt nur Ansichten je Rolle.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ClientMessage, ServerMessage, viewForHost, viewForPlayer, startGame, updateSettings, renamePlayer, playerAction, hostAction,
  tick, setConnected, GameError, cryptoRng, startMinigame, GameId, addBot, setBotLevel, canLead, removePlayer, realtimeTick, startBonusRunde, setAvatar, setEigeneLieder,
} from '@kronen/shared';
import { LobbyManager, Lobby, LobbyError } from './lobbies';

const PORT = Number(process.env.PORT ?? 8787);
const here = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(here, '../../client/dist');

const manager = new LobbyManager(cryptoRng, Date.now);

/* ------------------------------ HTTP -------------------------------- */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, lobbies: manager.lobbies.size }));
    return;
  }
  let file = path.normalize(path.join(STATIC_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC_DIR, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Kronen sammeln Server läuft. Der Client wurde noch nicht gebaut (npm run build).');
    return;
  }
  const ext = path.extname(file);
  const noCache = ext === '.html' || file.endsWith('sw.js') || ext === '.webmanifest';
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': noCache ? 'no-cache' : 'public, max-age=31536000, immutable' });
  fs.createReadStream(file).pipe(res);
});

/* ---------------------------- WebSocket ----------------------------- */

interface Conn {
  ws: WebSocket;
  ip: string;
  lobby: Lobby | null;
  role: 'host' | 'player' | null;
  playerId: string | null;
  bucket: number;
  lastRefill: number;
}

const conns = new Set<Conn>();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

function send(c: Conn, msg: ServerMessage) {
  if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
}

function sendView(c: Conn) {
  if (!c.lobby) return;
  const now = Date.now();
  if (c.role === 'host') send(c, { t: 'view', view: viewForHost(c.lobby.state, now) });
  else if (c.role === 'player' && c.playerId) {
    const v = viewForPlayer(c.lobby.state, c.playerId, now);
    if (v) send(c, { t: 'view', view: v });
  }
}

function broadcast(lobby: Lobby, force = false) {
  if (!force && lobby.lastBroadcastVersion === lobby.state.version) return;
  lobby.lastBroadcastVersion = lobby.state.version;
  for (const c of conns) if (c.lobby === lobby) sendView(c);
}

function attachHost(c: Conn, lobby: Lobby) {
  detach(c);
  c.lobby = lobby;
  c.role = 'host';
  manager.hostConnected(lobby, 1);
}

function attachPlayer(c: Conn, lobby: Lobby, playerId: string) {
  detach(c);
  c.lobby = lobby;
  c.role = 'player';
  c.playerId = playerId;
  setConnected(lobby.state, playerId, true, Date.now());
}

function detach(c: Conn) {
  const lobby = c.lobby;
  if (!lobby) return;
  if (c.role === 'host') manager.hostConnected(lobby, -1);
  if (c.role === 'player' && c.playerId) {
    const stillConnected = [...conns].some((o) => o !== c && o.lobby === lobby && o.playerId === c.playerId);
    if (!stillConnected) setConnected(lobby.state, c.playerId, false, Date.now());
  }
  c.lobby = null;
  c.role = null;
  c.playerId = null;
  broadcast(lobby);
}

/** Lobby-Leiter: der Hauptscreen oder (ohne Hauptscreen) der leitende Spieler */
function requireLeader(c: Conn): Lobby {
  if (c.lobby && c.role === 'host') return c.lobby;
  if (c.lobby && c.role === 'player' && canLead(c.lobby.state, c.playerId)) return c.lobby;
  throw new GameError('Das darf nur die Lobby-Leitung.');
}
function closeLobby(lobby: Lobby, reason: string, except?: Conn) {
  manager.close(lobby.code);
  for (const o of conns) if (o.lobby === lobby) {
    if (o !== except) send(o, { t: 'closed', reason });
    o.lobby = null;
    o.role = null;
    o.playerId = null;
  }
}
function requirePlayer(c: Conn): { lobby: Lobby; playerId: string } {
  if (c.role !== 'player' || !c.lobby || !c.playerId) throw new GameError('Nicht in einer Lobby.');
  return { lobby: c.lobby, playerId: c.playerId };
}

function handle(c: Conn, msg: ClientMessage) {
  const now = Date.now();
  const ctx = { rng: cryptoRng, now };
  switch (msg.t) {
    case 'ping':
      return send(c, { t: 'pong', c: typeof msg.c === 'number' ? msg.c : undefined, s: Date.now() });
    case 'create': {
      const lobby = manager.create();
      attachHost(c, lobby);
      send(c, { t: 'created', code: lobby.code, token: lobby.hostToken });
      return broadcast(lobby, true);
    }
    case 'createPlay': {
      const { lobby, playerId, token } = manager.createAsPlayer(String(msg.name ?? ''));
      if (msg.avatar) try { setAvatar(lobby.state, playerId, msg.avatar); } catch { /* ungültig: Zufallsfigur behalten */ }
      attachPlayer(c, lobby, playerId);
      send(c, { t: 'joined', code: lobby.code, token, playerId });
      return broadcast(lobby, true);
    }
    case 'joinScreen': {
      const lobby = manager.joinScreen(String(msg.code), c.ip);
      attachHost(c, lobby);
      send(c, { t: 'created', code: lobby.code, token: lobby.hostToken });
      return broadcast(lobby, true);
    }
    case 'addBot': {
      const lobby = requireLeader(c);
      addBot(lobby.state, msg.level ?? 'mittel', now);
      return broadcast(lobby);
    }
    case 'botLevel': {
      const lobby = requireLeader(c);
      setBotLevel(lobby.state, String(msg.playerId), msg.level);
      return broadcast(lobby);
    }
    case 'resumeHost': {
      const lobby = manager.resumeHost(String(msg.code), String(msg.token));
      attachHost(c, lobby);
      send(c, { t: 'created', code: lobby.code, token: lobby.hostToken });
      return broadcast(lobby, true);
    }
    case 'join': {
      const { lobby, playerId, token } = manager.join(String(msg.code), String(msg.name ?? ''), c.ip);
      if (msg.avatar) try { setAvatar(lobby.state, playerId, msg.avatar); } catch { /* ungültig: Zufallsfigur behalten */ }
      attachPlayer(c, lobby, playerId);
      send(c, { t: 'joined', code: lobby.code, token, playerId });
      return broadcast(lobby, true);
    }
    case 'resume': {
      const { lobby, playerId } = manager.resume(String(msg.code), String(msg.token));
      attachPlayer(c, lobby, playerId);
      send(c, { t: 'joined', code: lobby.code, token: String(msg.token), playerId });
      return broadcast(lobby, true);
    }
    case 'leave': {
      const { lobby, playerId } = requirePlayer(c);
      manager.leave(lobby, playerId);
      c.lobby = null;
      c.role = null;
      c.playerId = null;
      // Kein Mensch und kein Hauptscreen mehr in einer offenen Lobby: Lobby schließen
      if (!lobby.state.started && lobby.hostConnections === 0 && !lobby.state.players.some((p) => !p.bot)) {
        return closeLobby(lobby, 'Alle haben die Lobby verlassen.');
      }
      return broadcast(lobby, true);
    }
    case 'eigeneLieder': {
      const lobby = requireLeader(c);
      setEigeneLieder(lobby.state, c.role === 'host' ? 'host' : String(c.playerId), Array.isArray(msg.lieder) ? msg.lieder : []);
      return broadcast(lobby);
    }
    case 'avatar': {
      const { lobby, playerId } = requirePlayer(c);
      setAvatar(lobby.state, playerId, msg.avatar);
      return broadcast(lobby);
    }
    case 'rename': {
      const { lobby, playerId } = requirePlayer(c);
      renamePlayer(lobby.state, playerId, msg.name);
      return broadcast(lobby);
    }
    case 'kick': {
      const lobby = requireLeader(c);
      const pid = String(msg.playerId);
      if (pid === c.playerId) throw new GameError('Du kannst dich nicht selbst entfernen.');
      const target = lobby.state.players.find((p) => p.id === pid);
      if (target?.bot) {
        removePlayer(lobby.state, pid, now);
        return broadcast(lobby);
      }
      manager.kick(lobby, pid);
      for (const o of conns) if (o.lobby === lobby && o.playerId === pid) {
        send(o, { t: 'kicked' });
        o.lobby = null;
        o.role = null;
        o.playerId = null;
      }
      return broadcast(lobby);
    }
    case 'settings': {
      const lobby = requireLeader(c);
      updateSettings(lobby.state, msg.settings ?? {});
      return broadcast(lobby);
    }
    case 'start': {
      const lobby = requireLeader(c);
      if (lobby.state.started) return;
      startGame(lobby.state, ctx);
      return broadcast(lobby);
    }
    case 'host': {
      const lobby = requireLeader(c);
      hostAction(lobby.state, msg.a, ctx);
      return broadcast(lobby);
    }
    case 'act': {
      const { lobby, playerId } = requirePlayer(c);
      playerAction(lobby.state, playerId, msg.a, ctx);
      const act = msg.a;
      if (act?.t === 'mini' && act.a?.k === 'strich') {
        // Striche live nur an den Hauptscreen (leichtgewichtig, ohne vollen Zustand)
        const strich = act.a;
        const inner = lobby.state.mini?.inner;
        if (inner?.game === 'montagsmaler') {
          const st = inner.strokes.find((x) => x.id === strich.id);
          // Ohne Hauptscreen sehen alle anderen Handys die Zeichnung live
          const toPlayers = !lobby.state.hostConnected;
          if (st)
            for (const o of conns)
              if (o.lobby === lobby && (o.role === 'host' || (toPlayers && o.role === 'player' && o.playerId !== playerId)))
                send(o, { t: 'stroke', stroke: { ...st, pts: strich.pts } });
        }
        return;
      }
      if (act?.t === 'mini' && (act.a?.k === 'hop' || act.a?.k === 'raus')) {
        // Hühnerhüpfer: aktuellen Stand des Huhns sofort an alle anderen (Geister)
        const inner = lobby.state.mini?.inner;
        const r = inner?.game === 'huehner' ? inner.runners[playerId] : undefined;
        if (r)
          for (const o of conns)
            if (o.lobby === lobby && o !== c)
              send(o, { t: 'rt', d: { g: 'h', id: playerId, row: r.row, col: r.col, out: r.out, best: r.best, s: now } });
        return;
      }
      return broadcast(lobby);
    }
    case 'debugMini' as string: {
      // Nur für Entwickler-Tests (KJ_DEBUG=1): ein bestimmtes Minispiel sofort starten
      if (process.env.KJ_DEBUG !== '1') throw new GameError('Unbekannte Nachricht');
      const lobby = requireLeader(c);
      startMinigame(lobby.state, (msg as unknown as { game: GameId }).game, null, ctx);
      lobby.state.version++;
      return broadcast(lobby);
    }
    case 'debugPhase' as string: {
      if (process.env.KJ_DEBUG !== '1') throw new GameError('Unbekannte Nachricht');
      const lobby = requireLeader(c);
      const d = msg as unknown as { card?: number; winner?: boolean; pos?: number };
      if (d.pos) {
        const cur = lobby.state.players.find((p) => p.id === lobby.state.order[lobby.state.turn]);
        if (cur) cur.pos = d.pos;
        lobby.state.phase = { k: 'wuerfeln' };
      } else if (d.winner) lobby.state.phase = { k: 'sieg', winner: lobby.state.order[0] };
      else {
        lobby.state.cardDeck = { size: lobby.state.cardDeck.size, remaining: [d.card ?? 0] };
        lobby.state.phase = { k: 'karteZiehen', until: now + 30000 };
      }
      lobby.state.version++;
      return broadcast(lobby);
    }
    case 'debugBonus' as string: {
      // Nur für Entwickler-Tests (KJ_DEBUG=1): Bonusrunde mit vorgegebenen Bonusfeldern starten
      if (process.env.KJ_DEBUG !== '1') throw new GameError('Unbekannte Nachricht');
      const lobby = requireLeader(c);
      const bonus = (msg as unknown as { bonus: number[] }).bonus ?? [];
      lobby.state.order.forEach((id, i) => {
        const p = lobby.state.players.find((x) => x.id === id);
        if (p) p.bonus = Math.max(0, Math.min(10, Number(bonus[i]) || 0));
      });
      startBonusRunde(lobby.state, ctx);
      lobby.state.version++;
      return broadcast(lobby);
    }
    case 'close': {
      const lobby = requireLeader(c);
      return closeLobby(lobby, 'Die Lobby wurde beendet.', c);
    }
    default:
      throw new GameError('Unbekannte Nachricht');
  }
}

wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?').split(',')[0].trim();
  const c: Conn = { ws, ip, lobby: null, role: null, playerId: null, bucket: 120, lastRefill: Date.now() };
  conns.add(c);
  ws.on('message', (data) => {
    // einfache Drosselung: max. ~120 Nachrichten pro Sekunde
    const now = Date.now();
    c.bucket = Math.min(240, c.bucket + ((now - c.lastRefill) / 1000) * 120);
    c.lastRefill = now;
    if (c.bucket < 1) return;
    c.bucket--;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data));
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') throw new Error();
    } catch {
      return send(c, { t: 'error', code: 'invalid', message: 'Ungültige Nachricht' });
    }
    try {
      handle(c, msg);
    } catch (e) {
      if (e instanceof LobbyError) send(c, { t: 'error', code: e.code, message: e.message });
      else if (e instanceof GameError) send(c, { t: 'error', code: 'game', message: e.message });
      else {
        console.error(e);
        send(c, { t: 'error', code: 'invalid', message: 'Da ist etwas schiefgelaufen.' });
      }
    }
  });
  ws.on('close', () => {
    conns.delete(c);
    detach(c);
  });
});

/* ------------------------------ Timer ------------------------------- */

setInterval(() => {
  const now = Date.now();
  for (const lobby of manager.lobbies.values()) {
    try {
      tick(lobby.state, { rng: cryptoRng, now });
    } catch (e) {
      console.error('tick', lobby.code, e);
    }
    broadcast(lobby);
  }
}, 100);

// Echtzeit-Minispiele (Autorennen): ca. 60× pro Sekunde rechnen, gleichmäßig 20× pro Sekunde verteilen
const lastRt = new WeakMap<Lobby, number>();
setInterval(() => {
  const now = Date.now();
  for (const lobby of manager.lobbies.values()) {
    let snap: unknown | null = null;
    try {
      snap = realtimeTick(lobby.state, { rng: cryptoRng, now });
    } catch (e) {
      console.error('realtime', lobby.code, e);
    }
    if (!snap || now - (lastRt.get(lobby) ?? 0) < 48) continue;
    lastRt.set(lobby, now);
    const msg = JSON.stringify({ t: 'rt', d: snap });
    for (const c of conns) if (c.lobby === lobby && c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
  }
}, 16);

setInterval(() => {
  for (const code of manager.cleanup()) {
    for (const c of conns) if (c.lobby?.code === code) {
      send(c, { t: 'closed', reason: 'Die Lobby ist abgelaufen.' });
      c.lobby = null;
      c.role = null;
      c.playerId = null;
    }
  }
}, 30_000);

// Verbindungen lebendig halten (z. B. hinter Proxys von Render/Fly)
setInterval(() => {
  for (const c of conns) if (c.ws.readyState === WebSocket.OPEN) c.ws.ping();
}, 25_000);

server.listen(PORT, () => console.log(`Kronen sammeln Server läuft auf http://localhost:${PORT}`));
