import { ReactNode, useEffect, useState } from 'react';
import { gameById } from '@kronen/shared';
import { useM1, M1State, nameOf } from '../store';
import { RulesButton } from '../../components/Rules';
import { QR } from '../../components/QR';
import { HoldReveal, TimerRing, Modal } from '../../components/ui';
import { absoluteUrl } from '../../lib/router';
import { encodeSecret, SecretPayload } from '../../lib/secret';
import { useCountdown } from '../../lib/hooks';

/** Kopf jedes Spielscreens: Name, Teams, Regeln-Button */
export function GameShell({ children, showTeams = true }: { children: ReactNode; showTeams?: boolean }) {
  const { s, update } = useM1();
  const g = gameById(s.game!.id);
  const [abort, setAbort] = useState(false);
  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="gold" style={{ fontSize: 'clamp(1.8rem, 3vw + 1rem, 3.4rem)' }}>{g.name}</h1>
        <div className="row">
          <RulesButton id={g.id} />
          <button className="btn ghost sm" onClick={() => setAbort(true)}>Abbrechen</button>
        </div>
      </div>
      {showTeams && g.teamMode !== 'einzel' && <TeamLine s={s} />}
      {children}
      {abort && (
        <Modal onClose={() => setAbort(false)}>
          <div className="card stack center">
            <h2>Spiel abbrechen?</h2>
            <p>Es werden keine Bonusfelder vergeben.</p>
            <div className="row center">
              <button className="btn red big" onClick={() => update((d) => { d.game = null; d.phase = 'overview'; })}>Ja, abbrechen</button>
              <button className="btn big" onClick={() => setAbort(false)}>Weiterspielen</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function TeamLine({ s, active }: { s: M1State; active?: number }) {
  return (
    <div className="row">
      {s.game!.teams.map((t, i) => (
        <span key={i} className="chip" style={active === i ? { borderColor: 'var(--gold)', background: 'rgba(242,177,52,.25)' } : undefined}>
          <b className="gold">{t.name}:</b> {t.members.map((m) => nameOf(s, m)).join(' & ')}
        </span>
      ))}
    </div>
  );
}

/**
 * Geheimansicht: QR-Code + Link (Inhalt Base64 in der URL, ohne Backend)
 * und optional "Auf diesem Gerät anzeigen" mit gedrückt halten.
 */
export function SecretShare({ payload, who }: { payload: SecretPayload; who: string }) {
  const [local, setLocal] = useState(false);
  const url = absoluteUrl('/geheim?d=' + encodeSecret(payload));
  return (
    <div className="panel stack" style={{ alignItems: 'center' }}>
      <h3 className="center">🤫 Nur für {who}: QR-Code mit dem eigenen Handy scannen</h3>
      <div className="row center" style={{ alignItems: 'flex-start' }}>
        <QR text={url} size={220} />
        <div className="stack" style={{ maxWidth: 360 }}>
          <p className="small">Die geheimen Inhalte erscheinen nur auf dem Handy, das den Code scannt – nie auf dem Hauptscreen.</p>
          <button className="btn sm" onClick={() => navigator.clipboard?.writeText(url)}>🔗 Link kopieren</button>
          <a className="small" href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-light)', wordBreak: 'break-all' }}>Link öffnen</a>
        </div>
      </div>
      {!local ? (
        <button className="btn ghost sm" onClick={() => setLocal(true)}>⚠ Auf diesem Gerät anzeigen (Achtung bei Spiegelung)</button>
      ) : (
        <div style={{ width: '100%' }}>
          <HoldReveal>
            <SecretContent p={payload} />
          </HoldReveal>
        </div>
      )}
    </div>
  );
}

export function SecretContent({ p }: { p: SecretPayload }) {
  if (p.t === 'zahl') return <div className="mega" style={{ color: 'var(--red-dark)', fontSize: 'clamp(5rem,25vw,12rem)' }}>{p.zahl}</div>;
  return (
    <div className="stack" style={{ width: '100%' }}>
      {(p.items ?? []).map((b, i) => (
        <div key={i} className="head" style={{ fontSize: '1.5em', padding: '4px 0', borderBottom: '1px dashed rgba(90,50,25,.3)' }}>{i + 1}. {b}</div>
      ))}
    </div>
  );
}

/** 30-Sekunden-Timer mit Start-Button */
export function RoundTimer({ seconds, onFinish }: { seconds: number; onFinish?: () => void }) {
  const t = useCountdown(seconds);
  useEffect(() => {
    if (!t.finished) return;
    onFinish?.();
    try {
      navigator.vibrate?.(400);
    } catch {
      /* ok */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.finished]);
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <TimerRing left={t.left} total={seconds} size={180} />
      {t.finished ? (
        <p className="head" style={{ fontSize: '1.5em' }}>⏰ Zeit ist um!</p>
      ) : t.running ? (
        <button className="btn sm" onClick={t.pause}>⏸ Pause</button>
      ) : (
        <button className="btn green big" onClick={t.start}>▶ Start</button>
      )}
      {(t.finished || (!t.running && t.left !== seconds)) && (
        <button className="btn ghost sm" onClick={t.reset}>↺ Timer zurücksetzen</button>
      )}
    </div>
  );
}
