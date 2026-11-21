/** Nachrichtenprotokoll zwischen Client und Server (Modus 2). */
import type { HostAction, PlayerAction } from './mode2/engine';
import type { HostView, PlayerView } from './mode2/views';
import type { Settings } from './mode2/types';
import type { Stroke } from './mode2/minigames';
import type { BotLevel } from './mode2/constants';

export type ClientMessage =
  | { t: 'create' }
  /** Lobby ohne Hauptscreen erstellen: dieses Gerät spielt mit und leitet die Lobby */
  | { t: 'createPlay'; name: string }
  /** Als Hauptscreen einer bestehenden Lobby beitreten (auch nach dem Start) */
  | { t: 'joinScreen'; code: string }
  | { t: 'addBot'; level?: BotLevel }
  | { t: 'botLevel'; playerId: string; level: BotLevel }
  | { t: 'resumeHost'; code: string; token: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'resume'; code: string; token: string }
  | { t: 'leave' }
  | { t: 'rename'; name: string }
  | { t: 'kick'; playerId: string }
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'host'; a: HostAction }
  | { t: 'act'; a: PlayerAction }
  | { t: 'close' }
  /** Uhr-Abgleich: c = Gerätezeit beim Senden */
  | { t: 'ping'; c?: number };

export type ServerMessage =
  | { t: 'created'; code: string; token: string }
  | { t: 'joined'; code: string; token: string; playerId: string }
  | { t: 'view'; view: HostView | PlayerView }
  | { t: 'stroke'; stroke: Stroke }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'closed'; reason: string }
  | { t: 'kicked' }
  /** c = Gerätezeit aus dem Ping, s = Serverzeit */
  | { t: 'pong'; c?: number; s?: number }
  /** Echtzeit-Daten für Minispiele (Hüpfer, Autos …), ohne vollen Zustand */
  | { t: 'rt'; d: unknown };

export type ErrorCode = 'bad_code' | 'rate_limited' | 'game' | 'bad_token' | 'invalid' | 'not_allowed';

/** Lesbare Zeichen für Lobby-Codes: ohne 0/O/1/I/L */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export function normalizeCode(code: string): string {
  return String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}
