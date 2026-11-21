import {
  CODE_ALPHABET, CODE_LENGTH, normalizeCode, createGameState, addPlayer, GameState, GameError, setConnected, removePlayer, cryptoRng, Rng,
} from '@kronen/shared';


export const HOST_ABWESEND_MS = 10 * 60 * 1000; // Lobby bleibt 10 Minuten bestehen, wenn niemand mehr da ist
export const LEER_LOESCHEN_MS = HOST_ABWESEND_MS;
export const INAKTIV_MS = 4 * 60 * 60 * 1000;
export const RATE_LIMIT_FEHLVERSUCHE = 8;
export const RATE_LIMIT_FENSTER_MS = 60 * 1000;

export interface Lobby {
  code: string;
  state: GameState;
  hostToken: string;
  hostConnections: number;
  hostDisconnectedAt: number | null;
  /** token -> playerId */
  tokens: Map<string, string>;
  lastBroadcastVersion: number;
  /** seit wann weder Hauptscreen noch ein Mensch verbunden ist */
  emptySince: number | null;
}

export class LobbyError extends Error {
  constructor(public code: 'bad_code' | 'rate_limited' | 'bad_token' | 'game', message: string) {
    super(message);
  }
}

function randomString(rng: Rng, alphabet: string, len: number) {
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
}

export class LobbyManager {
  lobbies = new Map<string, Lobby>();
  /** Einmal-Codes: einmal vergebene Codes werden nie wieder vergeben */
  usedCodes = new Set<string>();
  private failures = new Map<string, { count: number; since: number }>();

  constructor(private rng: Rng = cryptoRng, private now: () => number = Date.now) {}

  newCode(): string {
    for (let i = 0; i < 10000; i++) {
      const c = randomString(this.rng, CODE_ALPHABET, CODE_LENGTH);
      if (!this.usedCodes.has(c)) {
        this.usedCodes.add(c);
        return c;
      }
    }
    throw new Error('Keine freien Codes');
  }

  newToken(): string {
    return randomString(this.rng, 'abcdefghijklmnopqrstuvwxyz0123456789', 32);
  }

  create(screenMode = true): Lobby {
    const code = this.newCode();
    const lobby: Lobby = {
      code,
      state: createGameState(code, this.now(), { screenMode }),
      hostToken: this.newToken(),
      hostConnections: 0,
      hostDisconnectedAt: null,
      tokens: new Map(),
      lastBroadcastVersion: 0,
      emptySince: null,
    };
    this.lobbies.set(code, lobby);
    return lobby;
  }

  /** Rate-Limit für falsche Codes je Schlüssel (IP / Verbindung) */
  checkRate(key: string) {
    const f = this.failures.get(key);
    if (!f) return;
    if (this.now() - f.since > RATE_LIMIT_FENSTER_MS) {
      this.failures.delete(key);
      return;
    }
    if (f.count >= RATE_LIMIT_FEHLVERSUCHE) throw new LobbyError('rate_limited', 'Zu viele falsche Versuche. Bitte warte eine Minute.');
  }

  private fail(key: string) {
    const f = this.failures.get(key);
    if (!f || this.now() - f.since > RATE_LIMIT_FENSTER_MS) this.failures.set(key, { count: 1, since: this.now() });
    else f.count++;
  }

  get(code: string): Lobby | undefined {
    return this.lobbies.get(normalizeCode(code));
  }

  /** Lobby ohne Hauptscreen: Der Ersteller spielt mit und leitet die Lobby. */
  createAsPlayer(name: string): { lobby: Lobby; playerId: string; token: string } {
    const lobby = this.create(false);
    try {
      return this.addHuman(lobby, name);
    } catch (e) {
      this.lobbies.delete(lobby.code);
      throw e;
    }
  }

  private addHuman(lobby: Lobby, name: string) {
    const token = this.newToken();
    const playerId = 'p' + randomString(this.rng, 'abcdefghijkmnpqrstuvwxyz23456789', 8);
    try {
      addPlayer(lobby.state, name, playerId, token, this.now());
    } catch (e) {
      if (e instanceof GameError) throw new LobbyError('game', e.message);
      throw e;
    }
    lobby.tokens.set(token, playerId);
    return { lobby, playerId, token };
  }

  /** Als Hauptscreen beitreten – auch nach dem Start erlaubt */
  joinScreen(rawCode: string, rateKey: string): Lobby {
    this.checkRate(rateKey);
    const lobby = this.get(rawCode);
    if (!lobby) {
      this.fail(rateKey);
      throw new LobbyError('bad_code', 'Diese Lobby gibt es nicht (mehr). Bitte prüfe den Code.');
    }
    return lobby;
  }

  join(rawCode: string, name: string, rateKey: string): { lobby: Lobby; playerId: string; token: string } {
    this.checkRate(rateKey);
    const lobby = this.get(rawCode);
    if (!lobby) {
      this.fail(rateKey);
      throw new LobbyError('bad_code', 'Diese Lobby gibt es nicht (mehr). Bitte prüfe den Code.');
    }
    if (lobby.state.started) throw new LobbyError('bad_code', 'Das Spiel in dieser Lobby hat schon begonnen. Neue Spieler können nicht mehr beitreten.');
    return this.addHuman(lobby, name);
  }

  resume(rawCode: string, token: string): { lobby: Lobby; playerId: string } {
    const lobby = this.get(rawCode);
    const playerId = lobby?.tokens.get(String(token));
    if (!lobby || !playerId || !lobby.state.players.some((p) => p.id === playerId)) throw new LobbyError('bad_token', 'Die Sitzung ist abgelaufen.');
    return { lobby, playerId };
  }

  resumeHost(rawCode: string, token: string): Lobby {
    const lobby = this.get(rawCode);
    if (!lobby || lobby.hostToken !== token) throw new LobbyError('bad_token', 'Die Lobby ist abgelaufen.');
    return lobby;
  }

  leave(lobby: Lobby, playerId: string) {
    if (!lobby.state.started) {
      removePlayer(lobby.state, playerId, this.now());
      for (const [t, id] of lobby.tokens) if (id === playerId) lobby.tokens.delete(t);
    } else setConnected(lobby.state, playerId, false, this.now());
  }

  kick(lobby: Lobby, playerId: string) {
    removePlayer(lobby.state, playerId, this.now());
    for (const [t, id] of lobby.tokens) if (id === playerId) lobby.tokens.delete(t);
  }

  hostConnected(lobby: Lobby, delta: 1 | -1) {
    lobby.hostConnections = Math.max(0, lobby.hostConnections + delta);
    const connected = lobby.hostConnections > 0;
    lobby.hostDisconnectedAt = connected ? null : this.now();
    if (lobby.state.hostConnected !== connected) {
      lobby.state.hostConnected = connected;
      lobby.state.version++;
    }
  }

  close(code: string) {
    this.lobbies.delete(code);
  }

  /** Ist noch ein Mensch oder Hauptscreen da? */
  hasPresence(l: Lobby): boolean {
    return l.hostConnections > 0 || l.state.players.some((p) => !p.bot && p.connected);
  }

  /**
   * Abgelaufene Lobbys entfernen: wenn 10 Minuten lang weder Hauptscreen noch ein Mensch
   * verbunden war, oder nach 4 Stunden ohne Aktivität. Gibt die entfernten Codes zurück.
   */
  cleanup(): string[] {
    const now = this.now();
    const removed: string[] = [];
    for (const [code, l] of this.lobbies) {
      if (this.hasPresence(l)) l.emptySince = null;
      else if (l.emptySince === null) l.emptySince = now;
      const empty = l.emptySince !== null && now - l.emptySince > LEER_LOESCHEN_MS;
      const inactive = now - l.state.lastActivity > INAKTIV_MS;
      if (empty || inactive) {
        this.lobbies.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
