import { savedAvatar } from '../components/AvatarEditor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, HostView, PlayerView, Stroke } from '@kronen/shared';
import { wsUrl } from '../lib/server';
import { load, save, remove } from '../lib/storage';
import { onPong, hintServerTime } from '../lib/clock';

export interface Session {
  code: string;
  token: string;
  playerId?: string;
}

export const HOST_KEY = 'kj_host';
export const PLAYER_KEY = 'kj_player';

export const loadSession = (key: string) => load<Session | null>(key, null);

type Role = 'host' | 'player';

export interface Conn<V> {
  status: 'connecting' | 'open' | 'closed';
  view: V | null;
  error: string | null;
  closed: string | null;
  session: Session | null;
  send: (m: ClientMessage) => void;
  clearError: () => void;
  forget: () => void;
}

/**
 * WebSocket-Verbindung mit automatischem Wiederverbinden.
 * Das geheime Token liegt im localStorage; nach einem Abbruch (Handy gesperrt,
 * WLAN-Wechsel) meldet sich die App damit automatisch wieder an.
 */
export interface ConnOptions {
  /** Hauptscreen: neue Lobby erstellen */
  create?: boolean;
  /** Spieler: neue Lobby ohne Hauptscreen erstellen (mit diesem Namen) */
  createPlay?: string;
  /** Hauptscreen: einer bestehenden Lobby beitreten (Code) */
  joinScreen?: string;
  onStroke?: (s: Stroke) => void;
  /** Echtzeit-Daten der Minispiele */
  onRt?: (d: any) => void;
}

export function useConnection<V extends HostView | PlayerView>(role: Role, opts: ConnOptions = {}): Conn<V> {
  const key = role === 'host' ? HOST_KEY : PLAYER_KEY;
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(() => (opts.create || opts.createPlay || opts.joinScreen ? null : loadSession(key)));
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const createRef = useRef(!!opts.create);
  const createPlayRef = useRef(opts.createPlay ?? null);
  const joinScreenRef = useRef(opts.joinScreen ?? null);
  const strokeRef = useRef(opts.onStroke);
  strokeRef.current = opts.onStroke;
  const rtRef = useRef(opts.onRt);
  rtRef.current = opts.onRt;
  const queue = useRef<ClientMessage[]>([]);
  const stopped = useRef(false);

  const forget = useCallback(() => {
    remove(key);
    setSession(null);
    setView(null);
  }, [key]);

  useEffect(() => {
    stopped.current = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let ping: ReturnType<typeof setInterval>;
    const connect = () => {
      if (stopped.current) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus('open');
        const s = sessionRef.current;
        if (role === 'host') {
          if (s) ws.send(JSON.stringify({ t: 'resumeHost', code: s.code, token: s.token }));
          else if (joinScreenRef.current) ws.send(JSON.stringify({ t: 'joinScreen', code: joinScreenRef.current }));
          else if (createRef.current) ws.send(JSON.stringify({ t: 'create' }));
        } else if (s) ws.send(JSON.stringify({ t: 'resume', code: s.code, token: s.token }));
        else if (createPlayRef.current) ws.send(JSON.stringify({ t: 'createPlay', name: createPlayRef.current, avatar: savedAvatar() ?? undefined }));
        for (const m of queue.current.splice(0)) ws.send(JSON.stringify(m));
        // Uhr-Abgleich: anfangs schnell mehrere Pings, danach alle 10 s
        let n = 0;
        const sendPing = () => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'ping', c: Date.now() }));
        sendPing();
        ping = setInterval(() => {
          n++;
          if (n < 6 || n % 10 === 0) sendPing();
        }, 1000);
      };
      ws.onmessage = (e) => {
        let m: ServerMessage;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        switch (m.t) {
          case 'view':
            hintServerTime(m.view.serverNow);
            setView(m.view as V);
            break;
          case 'pong':
            if (typeof m.c === 'number' && typeof m.s === 'number') onPong(m.c, m.s);
            break;
          case 'rt':
            rtRef.current?.(m.d);
            break;
          case 'stroke':
            strokeRef.current?.(m.stroke);
            break;
          case 'created': {
            const s = { code: m.code, token: m.token };
            save(key, s);
            setSession(s);
            createRef.current = false;
            joinScreenRef.current = null;
            break;
          }
          case 'joined': {
            const s = { code: m.code, token: m.token, playerId: m.playerId };
            save(key, s);
            setSession(s);
            setError(null);
            createPlayRef.current = null;
            break;
          }
          case 'error':
            if (m.code === 'bad_token') {
              remove(key);
              setSession(null);
              setView(null);
              setClosed(m.message);
            } else {
              // Fehler beim Erstellen/Beitreten als Hauptscreen: nicht endlos wiederholen
              joinScreenRef.current = null;
              createPlayRef.current = null;
              setError(m.message);
            }
            break;
          case 'closed':
            remove(key);
            setSession(null);
            setView(null);
            setClosed(m.reason);
            break;
          case 'kicked':
            remove(key);
            setSession(null);
            setView(null);
            setClosed('Du wurdest vom Hauptscreen aus der Lobby entfernt.');
            break;
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        setStatus('closed');
        if (stopped.current) return;
        retry++;
        timer = setTimeout(connect, Math.min(5000, 600 * retry));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    const onVis = () => {
      // Nach dem Entsperren sofort neu verbinden
      if (document.visibilityState === 'visible' && wsRef.current && wsRef.current.readyState > 1) {
        clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped.current = true;
      clearTimeout(timer);
      clearInterval(ping);
      document.removeEventListener('visibilitychange', onVis);
      wsRef.current?.close();
    };
  }, [role, key]);

  const send = useCallback((m: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
    else queue.current.push(m);
  }, []);

  return { status, view, error, closed, session, send, clearError: () => setError(null), forget };
}
