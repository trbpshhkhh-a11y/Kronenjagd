import { describe, it, expect } from 'vitest';
import { LobbyManager, HOST_ABWESEND_MS, INAKTIV_MS, RATE_LIMIT_FEHLVERSUCHE } from '../src/lobbies';
import { seededRng, CODE_ALPHABET, startGame, setConnected, addBot, canLead } from '@kronen/shared';

function mk() {
  const clock = { now: 1_000_000 };
  const m = new LobbyManager(seededRng(1), () => clock.now);
  return { m, clock };
}

describe('Lobby-Codes', () => {
  it('5 Zeichen aus dem lesbaren Alphabet, ohne 0/O/1/I/L, eindeutig und nie wiederverwendet', () => {
    const { m } = mk();
    const codes = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const l = m.create();
      expect(l.code).toMatch(/^[A-Z2-9]{5}$/);
      for (const ch of l.code) expect(CODE_ALPHABET).toContain(ch);
      expect(l.code).not.toMatch(/[01OIL]/);
      expect(codes.has(l.code)).toBe(false);
      codes.add(l.code);
      m.close(l.code);
    }
    // nach dem Schließen bleibt der Code gesperrt
    expect(m.usedCodes.size).toBe(3000);
  });

  it('Code ist nach dem Start gesperrt, Wiederverbinden mit Token bleibt möglich', () => {
    const { m, clock } = mk();
    const l = m.create();
    const a = m.join(l.code, 'Anna', 'ip1');
    m.join(l.code.toLowerCase(), 'Ben', 'ip2');
    startGame(l.state, { rng: seededRng(2), now: clock.now });
    expect(() => m.join(l.code, 'Carla', 'ip3')).toThrow(/begonnen/);
    setConnected(l.state, a.playerId, false, clock.now);
    const r = m.resume(l.code, a.token);
    expect(r.playerId).toBe(a.playerId);
    expect(() => m.resume(l.code, 'falsch')).toThrow();
  });

  it('falscher Code gibt freundliche Fehlermeldung und wird begrenzt', () => {
    const { m, clock } = mk();
    m.create();
    for (let i = 0; i < RATE_LIMIT_FEHLVERSUCHE; i++) expect(() => m.join('ZZZZZ', 'Anna', 'ipX')).toThrow(/gibt es nicht/);
    expect(() => m.join('ZZZZZ', 'Anna', 'ipX')).toThrow(/Zu viele/);
    // andere IP nicht betroffen
    expect(() => m.join('ZZZZZ', 'Anna', 'ipY')).toThrow(/gibt es nicht/);
    clock.now += 61_000;
    expect(() => m.join('ZZZZZ', 'Anna', 'ipX')).toThrow(/gibt es nicht/);
  });

  it('Namen müssen eindeutig sein', () => {
    const { m } = mk();
    const l = m.create();
    m.join(l.code, 'Anna', 'ip');
    expect(() => m.join(l.code, 'ANNA', 'ip')).toThrow(/vergeben/);
  });

  it('Host weg > 10 Minuten oder 4 Stunden inaktiv -> Lobby wird gelöscht', () => {
    const { m, clock } = mk();
    const a = m.create();
    const b = m.create();
    m.hostConnected(a, 1);
    m.hostConnected(b, 1);
    m.hostConnected(a, -1);
    clock.now += HOST_ABWESEND_MS - 1000;
    expect(m.cleanup()).toEqual([]);
    m.hostConnected(a, 1); // Host kommt zurück
    m.hostConnected(a, -1);
    clock.now += HOST_ABWESEND_MS + 1000;
    expect(m.cleanup()).toEqual([a.code]);
    b.state.lastActivity = clock.now;
    clock.now += INAKTIV_MS + 1;
    expect(m.cleanup()).toEqual([b.code]);
  });

  it('Verlassen vor dem Start entfernt den Spieler und sein Token', () => {
    const { m } = mk();
    const l = m.create();
    const a = m.join(l.code, 'Anna', 'ip');
    m.leave(l, a.playerId);
    expect(l.state.players).toHaveLength(0);
    expect(() => m.resume(l.code, a.token)).toThrow();
  });

  it('Lobby ohne Hauptscreen: Ersteller spielt mit und leitet', () => {
    const { m } = mk();
    const { lobby, playerId, token } = m.createAsPlayer('Anna');
    expect(lobby.state.screenMode).toBe(false);
    expect(lobby.state.hostConnected).toBe(false);
    expect(lobby.state.leaderId).toBe(playerId);
    expect(canLead(lobby.state, playerId)).toBe(true);
    expect(m.resume(lobby.code, token).playerId).toBe(playerId);
    const b = m.join(lobby.code, 'Ben', 'ip2');
    expect(canLead(lobby.state, b.playerId)).toBe(false);
    expect(() => m.createAsPlayer('X')).toThrow(/2 bis 14/);
  });

  it('Hauptscreen kann sich auch nach dem Start dazuschalten, Spieler nicht', () => {
    const { m, clock } = mk();
    const { lobby } = m.createAsPlayer('Anna');
    addBot(lobby.state, 'mittel');
    startGame(lobby.state, { rng: seededRng(1), now: clock.now });
    expect(() => m.join(lobby.code, 'Ben', 'ip')).toThrow(/begonnen/);
    expect(m.joinScreen(lobby.code.toLowerCase(), 'ip').code).toBe(lobby.code);
    expect(() => m.joinScreen('ZZZZZ', 'ip')).toThrow(/gibt es nicht/);
  });

  it('Lobby bleibt bestehen, solange ein Mensch verbunden ist, sonst nach 10 Minuten weg', () => {
    const { m, clock } = mk();
    const { lobby, playerId } = m.createAsPlayer('Anna');
    clock.now += HOST_ABWESEND_MS * 2;
    lobby.state.lastActivity = clock.now;
    expect(m.cleanup()).toEqual([]);
    setConnected(lobby.state, playerId, false, clock.now);
    expect(m.cleanup()).toEqual([]);
    clock.now += HOST_ABWESEND_MS + 1000;
    lobby.state.lastActivity = clock.now;
    expect(m.cleanup()).toEqual([lobby.code]);
  });
});

