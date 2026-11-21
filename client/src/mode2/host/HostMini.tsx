import { useMemo } from 'react';
import { HostView, GAMES, gameById, formatNumber } from '@kronen/shared';
import { useLeft, playerName, playerOf, usePortrait, displayName } from '../common';
import { LiveDrawing } from '../LiveDrawing';
import { FlunkerHost } from '../games/Flunker';
import { HuehnerHost } from '../games/Huehner';
import { SlotRoller } from '../../components/Roller';
import { RulesContent } from '../../components/Rules';
import { TimerRing, Dot } from '../../components/ui';
import { Confetti } from '../../components/Decor';
import { Tiles } from '../../mode1/games';

type Send = (m: any) => void;

export function HostMini({ v, send }: { v: HostView; send: Send }) {
  const P = usePortrait();
  const m = v.mini!;
  const g = gameById(m.game);
  const left = useLeft(v, m.until);
  const names = useMemo(() => GAMES.map((x) => x.name), []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(25,12,4,0.95)', padding: P ? '30px 30px 80px' : '30px 50px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: P ? 'auto' : 'hidden' }}>
      <div className="row between">
        <h1 className="gold" style={{ fontSize: P ? 60 : 72 }}>🎮 {g.name}</h1>
        <div className="row" style={{ gap: 16 }}>
          {m.stage === 'bereit' && left !== null && <span className="head" style={{ fontSize: 34 }}>Start in {left}s</span>}
          {(m.stage === 'bereit' || m.stage === 'ergebnis' || m.stage === 'teams') && (
            <button className="btn gold" onClick={() => send({ t: 'host', a: { t: 'weiter' } })}>{m.stage === 'bereit' ? 'Los geht’s' : 'Weiter'}</button>
          )}
          {m.stage === 'spiel' && m.game === 'game7' && <button className="btn ghost sm" onClick={() => send({ t: 'host', a: { t: 'beenden' } })}>Spiel beenden</button>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {m.stage === 'auslosung' && (
          <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 40 }}>
            <h2 style={{ fontSize: 60 }}>{m.chosenBy ? `${playerName(v, m.chosenBy)} hat ausgesucht:` : 'Das Minispiel ist …'}</h2>
            {m.chosenBy ? <div className="slot done"><div className="slot-text">{g.name}</div></div> : <SlotRoller options={names} final={g.name} duration={3000} render={(x) => x} style={{ width: P ? '100%' : 1100 }} />}
          </div>
        )}
        {m.stage === 'teams' && <TeamsView v={v} />}
        {m.stage === 'bereit' && (
          <div style={{ display: 'grid', gridTemplateColumns: P ? '1fr' : '1.3fr 1fr', gap: 30, fontSize: 30 }}>
            <RulesContent id={m.game} mode2 />
            <div className="stack">
              <TeamsView v={v} small />
              <div className="panel stack">
                <h3>Alle bereit? (auf dem Handy bestätigen)</h3>
                <div className="row">
                  {v.players.map((p) => (
                    <span key={p.id} className="chip" style={{ opacity: m.ready.includes(p.id) ? 1 : 0.45 }}>
                      {m.ready.includes(p.id) ? '✔' : '…'} <Dot color={p.color} /> {displayName(p)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {m.stage === 'spiel' && m.inner && <GameView v={v} inner={m.inner} />}
        {m.stage === 'ergebnis' && m.result && (
          <div className="stack" style={{ alignItems: 'center', gap: 20 }}>
            <Confetti duration={3000} />
            <h2 style={{ fontSize: 56 }}>Rangliste – Bonusfelder für den nächsten Zug</h2>
            <div className="stack" style={{ width: P ? '100%' : 1200, gap: 12 }}>
              {m.result.rows.map((r, i) => (
                <div key={i} className="list-item" style={{ fontSize: 38 }}>
                  <span className="head gold" style={{ width: 70 }}>{r.platz ?? i + 1}.</span>
                  <span className="head grow">{r.label}{r.members.length > 1 && <span className="small muted"> ({r.members.join(' & ')})</span>}</span>
                  <span>{r.anzeige ?? `${r.punkte} Punkte`}</span>
                  <span className="badge green" style={{ fontSize: 34 }}>+{r.bonus} Felder</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamsView({ v, small }: { v: HostView; small?: boolean }) {
  const P = usePortrait();
  const m = v.mini!;
  const einzel = gameById(m.game).teamMode === 'einzel';
  if (einzel)
    return (
      <div className="panel">
        <h2 style={{ fontSize: small ? 32 : 56 }}>Jeder für sich!</h2>
        <div className="row" style={{ marginTop: 10 }}>{v.players.map((p) => <span key={p.id} className="chip" style={{ fontSize: small ? 24 : 36 }}><Dot color={p.color} /> {displayName(p)}</span>)}</div>
      </div>
    );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(m.teams.length, small || P ? 2 : 3)}, 1fr)`, gap: 20 }}>
      {m.teams.map((t, i) => (
        <div key={i} className="card" style={small ? undefined : { animation: `cardIn .5s ${i * 0.3}s both` }}>
          <h2 style={{ fontSize: small ? 28 : 46 }}>{t.name}</h2>
          <div className="row" style={{ marginTop: 8 }}>
            {t.members.map((id) => {
              const p = playerOf(v, id);
              return <span key={id} className="chip head" style={{ fontSize: small ? 22 : 34, color: 'var(--cream)', background: 'rgba(60,30,10,.85)' }}><Dot color={p?.color ?? '#999'} /> {p ? displayName(p) : '?'}</span>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BigTimer({ v, until, total }: { v: HostView; until: number; total: number }) {
  const left = useLeft(v, until);
  if (left === null) return null;
  return <TimerRing left={left} total={total} size={190} />;
}

function GameView({ v, inner }: { v: HostView; inner: any }) {
  const P = usePortrait();
  const t = v.settings.timer;
  switch (inner.game) {
    case 'game7':
      return (
        <div className="stack" style={{ gap: 30 }}>
          <h2 className="center" style={{ fontSize: 56 }}>
            {inner.finished ? 'Fertig!' : <>Dran: <span className="gold">{inner.teams[inner.current]?.label}</span> – exakt <span className="gold">{inner.target}</span> {inner.target === 1 ? 'Aufprall' : 'Aufpraller'}</>}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(P ? 2 : 5, inner.teams.length)}, 1fr)`, gap: 20 }}>
            {inner.teams.map((tm: any, i: number) => (
              <div key={i} className="card stack" style={i === inner.current && !inner.finished ? { boxShadow: '0 0 0 8px #66bb6a' } : undefined}>
                <h2 style={{ fontSize: 40 }}>{tm.label}</h2>
                <p style={{ fontSize: 26 }}>{tm.members.join(' & ')}</p>
                <div className="head" style={{ fontSize: 120, color: 'var(--red-dark)', textAlign: 'center' }}>{tm.stage}</div>
                {tm.locked && <span className="badge green" style={{ fontSize: 26 }}>🔒 eingeloggt</span>}
              </div>
            ))}
          </div>
        </div>
      );
    case 'kopfrechnen':
      return (
        <div className="stack" style={{ gap: 26 }}>
          <div className="row between"><span className="head" style={{ fontSize: 36 }}>Aufgabe {inner.nr} von 5</span>{inner.stage === 'frage' && <BigTimer v={v} until={inner.until} total={t.kopfrechnen} />}</div>
          <div className="card"><div className="task" style={{ fontSize: 150 }}>{inner.text} = {inner.loesung !== null ? <span style={{ color: 'var(--green)' }}>{formatNumber(inner.loesung)}</span> : '?'}</div></div>
          {inner.stage === 'loesung' && <h2 className="center gold" style={{ fontSize: 56 }}>{inner.winner ? `🏆 ${inner.winner} war am schnellsten!` : 'Niemand hatte es richtig.'}</h2>}
          <div className="row center" style={{ fontSize: 30 }}>
            {inner.scores.map((s: any) => <span key={s.name} className="chip" style={{ opacity: inner.raus.includes(s.name) ? 0.4 : 1 }}>{inner.raus.includes(s.name) ? '✖ ' : ''}{s.name}: <b className="gold">{s.punkte}</b></span>)}
          </div>
        </div>
      );
    case 'stirnraten':
    case 'begriffe': {
      const total = inner.game === 'stirnraten' ? t.stirnraten : t.begriffe;
      const who = inner.game === 'stirnraten' ? `Rater: ${inner.rater}` : `Erklärer: ${inner.erklaerer}`;
      return (
        <div className="stack" style={{ alignItems: 'center', gap: 30 }}>
          {inner.game === 'begriffe' && <span className="head" style={{ fontSize: 30 }}>Durchgang {inner.durchgang} von {inner.durchgaenge}</span>}
          <h2 style={{ fontSize: 70 }}>{inner.team}</h2>
          <h2 className="gold" style={{ fontSize: 56 }}>{who}</h2>
          {inner.stage === 'start' && <p className="head" style={{ fontSize: 44 }}>Gleich geht’s los … Handys bereit!</p>}
          {inner.stage === 'laeuft' && <BigTimer v={v} until={inner.until} total={total} />}
          {inner.stage === 'pause' && <p className="head" style={{ fontSize: 50 }}>⏰ Zeit ist um!</p>}
          {inner.botInfo && inner.stage === 'laeuft' && <BotLine info={inner.botInfo} />}
          <div className="row center" style={{ fontSize: 40 }}>
            {inner.correct.map((c: any, i: number) => <span key={i} className="chip" style={i === inner.teamIdx ? { borderColor: 'var(--gold)' } : undefined}>{c.label}: <b className="gold">{c.n}</b> richtig</span>)}
          </div>
        </div>
      );
    }
    case 'gegenstaende':
      return (
        <div className="stack" style={{ alignItems: 'center', gap: 24 }}>
          {inner.stage === 'start' && <h2 style={{ fontSize: 70, marginTop: 140 }}>Alle Augen auf den Bildschirm! 👀</h2>}
          {inner.stage === 'zeigen' && (
            <>
              <BigTimer v={v} until={inner.until} total={10} />
              <div style={{ width: P ? '100%' : 1500 }}><Tiles items={inner.items} /></div>
            </>
          )}
          {inner.stage === 'abfrage' && (
            <>
              <span className="head" style={{ fontSize: 34 }}>Frage {inner.frageNr} von 10</span>
              <h2 className="mega">Was war auf Feld <span className="gold">{inner.nr}</span>?</h2>
              <BigTimer v={v} until={inner.until} total={t.gegenstaende} />
              <p style={{ fontSize: 30 }}>Geantwortet: {inner.beantwortet.join(', ') || '–'}</p>
            </>
          )}
          {inner.stage === 'aufloesung' && (
            <>
              <div style={{ width: P ? '100%' : 1300 }}><Tiles items={inner.items} /></div>
              <div className="row center" style={{ fontSize: 32 }}>{inner.scores?.map((r: any) => <span key={r.label} className="chip">{r.label}: <b className="gold">{r.punkte}</b>/10</span>)}</div>
            </>
          )}
        </div>
      );
    case 'slf':
      return inner.stage !== 'pruefung' ? (
        <div style={{ display: 'grid', gridTemplateColumns: P ? '1fr' : '520px 1fr 260px', gap: 40, alignItems: 'center' }}>
          <div className="card center"><div className="head" style={{ fontSize: 340, lineHeight: 1, color: 'var(--red-dark)' }}>{inner.letter}</div></div>
          <div className="stack" style={{ fontSize: 48 }}>
            {inner.cats.map((c: string, i: number) => <div key={i} className="list-item head">{i + 1}. {c}</div>)}
            {inner.stopBy && <h2 className="gold" style={{ fontSize: 50 }}>✋ STOPP von {inner.stopBy}! Noch 10 Sekunden …</h2>}
          </div>
          <div className="stack" style={{ alignItems: 'center' }}>
            <BigTimer v={v} until={inner.until} total={inner.stopBy ? 10 : t.slf} />
            <p style={{ fontSize: 24 }} className="center">Schreiben: {inner.abgegeben.length}/{v.players.length}</p>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="row between">
            <h2 style={{ fontSize: 44 }}>Buchstabe <span className="gold">{inner.letter}</span> – Antworten prüfen (auf dem Handy ungültige markieren)</h2>
            <BigTimer v={v} until={inner.until} total={90} />
          </div>
          <table className="tbl" style={{ fontSize: 26 }}>
            <thead><tr><th>Spieler</th>{inner.cats.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {inner.tabelle.map((row: any) => (
                <tr key={row.id}>
                  <td className="head">{row.name}{inner.fertig.includes(row.name) ? ' ✔' : ''}</td>
                  {row.antworten.map((a: any, i: number) => (
                    <td key={i} className={a.status === 'ok' ? '' : 'strike'} title={a.status}>
                      {a.text || '–'} {a.status === 'doppelt' && <span className="badge gray">doppelt</span>}{a.status === 'buchstabe' && <span className="badge red">Buchstabe</span>}{a.flags > 0 && <span className="badge red">👎{a.flags}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'schaetzen':
      return (
        <div className="stack" style={{ gap: 24 }}>
          <div className="row between"><span className="head" style={{ fontSize: 36 }}>Frage {inner.nr} von 5</span>{inner.stage === 'frage' && <BigTimer v={v} until={inner.until} total={t.schaetzen} />}</div>
          <div className="card"><div className="question" style={{ fontSize: 70 }}>{inner.frage}</div></div>
          {inner.stage === 'frage' ? (
            <p className="center" style={{ fontSize: 34 }}>Geschätzt: {inner.geschaetzt.join(', ') || '–'}</p>
          ) : (
            <>
              <h2 className="center gold" style={{ fontSize: 90 }}>{formatNumber(inner.loesung)} {inner.einheit}</h2>
              <div className="row center" style={{ fontSize: 32 }}>
                {inner.alle.map((a: any) => <span key={a.name} className="chip" style={a.sieger ? { borderColor: 'var(--gold)', background: 'rgba(242,177,52,.3)' } : undefined}>{a.sieger ? '🏆 ' : ''}{a.name}: {a.wert === null ? '–' : formatNumber(a.wert)}</span>)}
              </div>
            </>
          )}
        </div>
      );
    case 'montagsmaler':
      return <MalHost v={v} inner={inner} />;
    case 'flunker':
      return <FlunkerHost v={v} inner={inner} portrait={P} />;
    case 'huehner':
      return <HuehnerHost v={v} inner={inner} portrait={P} />;
    case 'zahlen':
      return (
        <div className="stack" style={{ alignItems: 'center', gap: 26 }}>
          {inner.stage === 'raten' && <BigTimer v={v} until={inner.until} total={t.zahlen} />}
          {inner.stage === 'raten' && <p className="head center" style={{ fontSize: 34 }}>Rater nennen abwechselnd eine Kategorie, Kenner nennen einen passenden Begriff (1 = winzig, 10 = riesig).</p>}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(P ? 2 : 5, inner.teams.length)}, 1fr)`, gap: 20, width: '100%' }}>
            {inner.teams.map((tm: any, i: number) => (
              <div key={i} className="card" style={{ fontSize: 28 }}>
                <h2>{tm.label}</h2>
                <p>🔎 Rater: <b>{tm.rater}</b> {tm.hatGetippt && inner.stage === 'raten' ? '✔ getippt' : ''}</p>
                <p>🧠 Kenner: <b>{tm.kenner.join(', ')}</b></p>
                {inner.stage === 'aufgedeckt' && <p className="head" style={{ fontSize: 40 }}>Tipp: {tm.tipp ?? '–'} → <span style={{ color: 'var(--green)' }}>+{tm.bonus}</span></p>}
                {(inner.hints as any[]).filter((h) => h.team === i).map((h, k) => <p key={k}>💬 {h.name}: <b>{h.kategorie} → {h.begriff}</b></p>)}
              </div>
            ))}
          </div>
          {inner.stage === 'aufgedeckt' && <><h2 style={{ fontSize: 50 }}>Die geheime Zahl war</h2><div className="mega gold" style={{ fontSize: 220 }}>{inner.zahl}</div></>}
        </div>
      );
    case 'wissen':
      return (
        <div className="stack" style={{ gap: 22 }}>
          <div className="row between"><span className="head" style={{ fontSize: 36 }}>Frage {inner.nr} von 5</span>{inner.stage === 'frage' && <BigTimer v={v} until={inner.until} total={t.wissen} />}</div>
          <div className="card"><div className="question" style={{ fontSize: 64 }}>{inner.frage}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {inner.options.map((o: string, i: number) => (
              <div key={i} className="list-item head" style={{ fontSize: 44, background: inner.richtig === i ? 'rgba(102,187,106,.45)' : undefined, borderColor: inner.richtig === i ? '#66bb6a' : undefined }}>
                <span className="badge" style={{ fontSize: 34 }}>{'ABCD'[i]}</span> {o}
              </div>
            ))}
          </div>
          <div className="row center" style={{ fontSize: 30 }}>
            {inner.teams.map((tm: any, i: number) => (
              <span key={i} className="chip">{tm.label}: {inner.stage === 'loesung' ? (tm.teamWahl === null ? '–' : `${'ABCD'[tm.teamWahl]} ${tm.teamWahl === inner.richtig ? '✔' : '✖'}`) : tm.gesperrt ? '🔒' : '…'} · <b className="gold">{tm.punkte}</b></span>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** Montagsmaler: Zeichnung live auf dem Hauptscreen */
function MalHost({ v, inner }: { v: HostView; inner: any }) {
  const P = usePortrait();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: P ? '1fr' : '1fr 460px', gap: 30, flex: 1, minHeight: 0 }}>
      <div style={{ width: P ? '100%' : 1040, justifySelf: 'center' }}>
        <LiveDrawing strokes={inner.strokes} resetKey={`${inner.round}-${inner.lastSolved}`} style={{ borderWidth: 6, borderRadius: 18 }} />
      </div>
      <div className="stack" style={{ fontSize: 30 }}>
        <h2 style={{ fontSize: 48 }}>{inner.team}</h2>
        <p>✏️ Zeichner: <b className="gold">{inner.drawer}</b></p>
        {inner.stage === 'start' && <p className="head" style={{ fontSize: 40 }}>Gleich geht’s los …</p>}
        {inner.stage === 'laeuft' && <BigTimer v={v} until={inner.until} total={v.settings.timer.montagsmaler} />}
        {inner.stage === 'pause' && <p className="head" style={{ fontSize: 40 }}>⏰ Zeit ist um!</p>}
        {inner.lastSolved && <p className="head" style={{ color: '#a5e89a' }}>✔ Erraten: {inner.lastSolved}</p>}
        <div className="stack" style={{ gap: 4 }}>
          {inner.guesses.slice(-6).map((g: any, i: number) => <span key={i} style={{ color: g.ok ? '#a5e89a' : undefined }}>{g.name}: {g.text} {g.ok ? '✔' : ''}</span>)}
        </div>
        <div className="grow" />
        {inner.correct.map((c: any, i: number) => <span key={i} className="chip">{c.label}: <b className="gold">{c.n}</b></span>)}
      </div>
    </div>
  );
}

/** Was ein Bot gerade „gesagt“ hat (z. B. beim Raten) */
export function BotLine({ info }: { info: { seq: number; name: string; text: string; ok: boolean } }) {
  return (
    <p key={info.seq} className="head" style={{ fontSize: '1.3em', color: info.ok ? '#a5e89a' : '#ffcc80', animation: 'pop .4s' }}>
      {info.name} {info.text}
    </p>
  );
}
