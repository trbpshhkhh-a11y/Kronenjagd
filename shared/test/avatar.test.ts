import { describe, it, expect } from 'vitest';
import {
  sanitizeAvatar, randomAvatar, avatarFromId, AVATAR_TEILE, avatarAnzahl, seededRng, setAvatar, viewForHost, viewForPlayer, GameError, createGameState, addBot,
} from '../src';
import { setup } from './helpers';

describe('Avatare', () => {
  it('Zufalls-Avatare sind immer gültig, gleiche Kennung = gleicher Avatar', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 200; i++) expect(sanitizeAvatar(randomAvatar(rng))).not.toBeNull();
    expect(avatarFromId('abc')).toEqual(avatarFromId('abc'));
    expect(JSON.stringify(avatarFromId('a'))).not.toBe(JSON.stringify(avatarFromId('b')) + 'x');
  });
  it('ungültige Werte werden abgelehnt', () => {
    const ok = { haut: 0, frisur: 0, haar: 0, augen: 0, mund: 0, kopf: 0, extra: 0 };
    expect(sanitizeAvatar(ok)).toEqual(ok);
    for (const t of AVATAR_TEILE) {
      expect(sanitizeAvatar({ ...ok, [t]: avatarAnzahl(t) })).toBeNull();
      expect(sanitizeAvatar({ ...ok, [t]: -1 })).toBeNull();
      expect(sanitizeAvatar({ ...ok, [t]: 1.5 })).toBeNull();
      expect(sanitizeAvatar({ ...ok, [t]: '1' })).toBeNull();
    }
    expect(sanitizeAvatar(null)).toBeNull();
    expect(sanitizeAvatar({ ...ok, extra: undefined })).toBeNull();
  });
  it('Figur setzen und in allen Ansichten sehen', () => {
    const { s, t } = setup(2);
    for (const p of s.players) expect(sanitizeAvatar(p.avatar)).not.toBeNull();
    const lobby = createGameState('BOT', 0);
    expect(sanitizeAvatar(addBot(lobby, 'leicht').avatar)).not.toBeNull();
    const neu = { haut: 2, frisur: 4, haar: 3, augen: 1, mund: 1, kopf: 2, extra: 1 };
    setAvatar(s, 'p1', neu);
    expect(viewForHost(s, t.now).players.find((p) => p.id === 'p1')!.avatar).toEqual(neu);
    expect(viewForPlayer(s, 'p2', t.now)!.players.find((p) => p.id === 'p1')!.avatar).toEqual(neu);
    expect(() => setAvatar(s, 'p1', { ...neu, kopf: 99 })).toThrow(GameError);
    expect(s.players.find((p) => p.id === 'p1')!.avatar).toEqual(neu);
  });
});
