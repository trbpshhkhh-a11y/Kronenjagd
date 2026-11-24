import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerView, gameById, formatNumber, GAMES } from '@kronen/shared';
import { useLeft, playerOf, displayName } from '../common';
import { LiveDrawing } from '../LiveDrawing';
import { BotLine } from '../host/HostMini';
import { GameSlotMachine } from '../../components/SlotMachine';
import { Tiles } from '../../mode1/games';
import { RulesButton } from '../../components/Rules';
import { TimerRing } from '../../components/ui';
import { Confetti } from '../../components/Decor';
import { DrawCanvas } from './DrawCanvas';
import { FlunkerPlayer } from '../games/Flunker';
import { HuehnerPhone } from '../games/Huehner';
import { FlitzerPhone } from '../games/Flitzer';

type Send = (m: any) => void;
const act = (send: Send, a: any) => send({ t: 'act', a: { t: 'mini', a } });

export function PlayerMini({ v, send }: { v: PlayerView; send: Send }) {
  const m = v.mini!;
  const g = gameById(m.game);
  const myTeamIdx = m.teams.findIndex((t) => t.members.includes(v.me.id));
  const myTeam = m.teams[myTeamIdx];
  const einzel = g.teamMode === 'einzel';
  const noScreen = !v.hostConnected;
  const names = useMemo(() => GAMES.filter((x) => v.settings.aktiveSpiele.includes(x.id)).map((x) => ({ id: x.id, name: x.name })), [v.settings.aktiveSpiele]);
  const nameOf = (id: string) => {
    const p = playerOf(v, id);
    return p ? displayName(p) : '?';
  };
  // Auslosung: großer Spielautomat in der Mitte
  if (m.stage === 'auslosung')
    return (
      <div className="mini-wrap sm-stage">
        <h2>{m.chosenBy ? `${nameOf(m.chosenBy)} hat ausgesucht:` : 'Das Minispiel ist …'}</h2>
        <GameSlotMachine size="phone" games={names} final={{ id: g.id, name: g.name }} quick={!!m.chosenBy} />
      </div>
    );
  // Echtzeit-Spiele nehmen den ganzen Bildschirm ein
  if (m.stage === 'spiel' && m.inner?.game === 'huehner') return <HuehnerPhone key={m.inner.seed} v={v} send={send} inner={m.inner} />;
  if (m.stage === 'spiel' && m.inner?.game === 'flitzer') return <FlitzerPhone key={m.inner.startAt} v={v} send={send} inner={m.inner} />;
  const host = (a: any) => send({ t: 'host', a });
  const header = (
    <div className="row between mini-head">
      <h2 className="gold">{g.name}</h2>
      <RulesButton id={g.id} mode2 className="sm" />
    </div>
  );
  const teamChip = !einzel && myTeam && (
    <div className="chip" style={{ alignSelf: 'flex-start' }}>
      <b className="gold">{myTeam.name}:</b>
      {myTeam.members.map(nameOf).join(' & ')}
    </div>
  );
  // Linke Spalte (im Querformat): Infos – rechte Spalte: was ich tun muss
  const info = (
    <>
      {teamChip}
      {(m.stage === 'teams' || (m.stage === 'bereit' && noScreen)) && (
        noScreen ? <TeamList v={v} nameOf={nameOf} /> : <div className="card center"><h3>{einzel ? 'Jeder für sich!' : 'Die Teams stehen!'}</h3><p>Schau auf den Hauptscreen.</p></div>
      )}
      {m.stage === 'spiel' && m.inner && noScreen && <PublicInfo v={v} inner={m.inner} />}
      {m.stage === 'ergebnis' && m.result && (
        <div className="panel list">
          {m.result.rows.map((r, i) => <div key={i} className="list-item"><b>{r.platz ?? i + 1}.</b><span className="grow">{r.label}{r.members.length > 1 && <span className="small muted"> ({r.members.join(' & ')})</span>}</span><span>{r.anzeige ?? `${r.punkte} P.`}</span><span className="badge green">+{r.bonus}</span></div>)}
        </div>
      )}
    </>
  );
  const action = (
    <>
      {m.stage === 'bereit' && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <p className="center">Lies die Regeln und bestätige, wenn du bereit bist.</p>
          {m.ready.includes(v.me.id) ? <p className="badge green" style={{ fontSize: '1.2em' }}>✔ Du bist bereit</p> : <button className="btn green huge block" onClick={() => send({ t: 'act', a: { t: 'ready' } })}>Bereit!</button>}
          <p className="small">{m.ready.length} von {v.players.length} bereit</p>
          {v.iAmLeader && <button className="btn gold" onClick={() => host({ t: 'weiter' })}>Los geht’s (nicht warten)</button>}
        </div>
      )}
      {m.stage === 'spiel' && m.inner && <Inner v={v} send={send} inner={m.inner} />}
      {m.stage === 'spiel' && m.game === 'game7' && v.iAmLeader && <button className="btn ghost sm" onClick={() => host({ t: 'beenden' })}>Game of 7 beenden</button>}
      {m.stage === 'ergebnis' && m.result && (
        <div className="stack">
          <Confetti duration={2500} />
          <div className="card center">
            <h3>Deine Bonusfelder für den nächsten Zug</h3>
            <div className="mega" style={{ color: 'var(--green)', textShadow: 'none' }}>+{m.result.bonus[v.me.id] ?? 0}</div>
          </div>
          {v.iAmLeader && <button className="btn gold" onClick={() => host({ t: 'weiter' })}>Weiter</button>}
        </div>
      )}
    </>
  );
  return (
    <div className="mini-wrap">
      {header}
      <div className="mini-cols">
        <div className="mini-col mini-info">{info}</div>
        <div className="mini-col mini-action">{action}</div>
      </div>
    </div>
  );
}

function TeamList({ v, nameOf }: { v: PlayerView; nameOf: (id: string) => string }) {
  const m = v.mini!;
  if (gameById(m.game).teamMode === 'einzel')
    return (
      <div className="card center">
        <h3>Jeder für sich!</h3>
        <p>{v.players.map((p) => displayName(p)).join(', ')}</p>
      </div>
    );
  return (
    <div className="stack" style={{ gap: 8 }}>
      {m.teams.map((t, i) => (
        <div key={i} className="card" style={{ padding: 12, animation: `cardIn .4s ${i * 0.2}s both` }}>
          <b>{t.name}</b>: {t.members.map(nameOf).join(' & ')}
        </div>
      ))}
    </div>
  );
}

/** Was sonst nur der Hauptscreen zeigt – ohne Hauptscreen auf jedem Handy */
function PublicInfo({ v, inner }: { v: PlayerView; inner: any }) {
  const chips = (list: { label: string; n: number }[], unit = '') => (
    <div className="row center">{list.map((c, i) => <span key={i} className="chip">{c.label}: <b className="gold">{c.n}</b>{unit}</span>)}</div>
  );
  switch (inner.game) {
    case 'game7':
      return (
        <div className="panel stack" style={{ padding: 12 }}>
          {inner.teams.map((tm: any, i: number) => (
            <div key={i} className="list-item" style={i === inner.current && !inner.finished ? { borderColor: 'var(--gold)' } : undefined}>
              <span className="grow"><b>{tm.label}</b> <span className="small muted">{tm.members.join(' & ')}</span></span>
              <b className="head gold">{tm.stage}</b>{tm.locked && ' 🔒'}
            </div>
          ))}
        </div>
      );
    case 'kopfrechnen':
      return chips(inner.scores.map((x: any) => ({ label: (inner.raus.includes(x.name) ? '✖ ' : '') + x.name, n: x.punkte })));
    case 'stirnraten':
    case 'begriffe':
      return chips(inner.correct, ' richtig');
    case 'gegenstaende':
      if (inner.stage === 'zeigen' && inner.items) return <Tiles items={inner.items} />;
      if (inner.stage === 'aufloesung' && inner.scores) return chips(inner.scores.map((r: any) => ({ label: r.label, n: r.punkte })), '/10');
      if (inner.stage === 'abfrage') return <p className="center small">Geantwortet: {inner.beantwortet.join(', ') || '–'}</p>;
      return null;
    case 'schaetzen':
      return (
        <>
          {inner.stage === 'frage' && <p className="center small">Geschätzt: {inner.geschaetzt.join(', ') || '–'}</p>}
          {chips(inner.scores.map((x: any) => ({ label: x.name, n: x.punkte })))}
        </>
      );
    case 'slf':
      return inner.stage !== 'pruefung' ? <p className="center small">Schreiben: {inner.abgegeben.length}/{v.players.length}</p> : null;
    case 'zahlen':
      return (
        <div className="stack" style={{ gap: 8 }}>
          {inner.teams.map((tm: any, i: number) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <b>{tm.label}</b>: 🔎 {tm.rater} {tm.hatGetippt && inner.stage === 'raten' ? '✔' : ''} · 🧠 {tm.kenner.join(', ')}
              {inner.stage === 'aufgedeckt' && <div>Tipp: <b>{tm.tipp ?? '–'}</b> → <b style={{ color: 'var(--green)' }}>+{tm.bonus}</b></div>}
            </div>
          ))}
        </div>
      );
    case 'wissen':
      return (
        <div className="row center">
          {inner.teams.map((tm: any, i: number) => (
            <span key={i} className="chip">{tm.label}: {inner.stage === 'loesung' ? (tm.teamWahl === null ? '–' : `${'ABCD'[tm.teamWahl]} ${tm.teamWahl === inner.richtig ? '✔' : '✖'}`) : tm.gesperrt ? '🔒' : '…'} · <b className="gold">{tm.punkte}</b></span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function Timer({ v, until, total }: { v: PlayerView; until: number; total: number }) {
  const left = useLeft(v, until);
  if (left === null) return null;
  return <div className="row center"><TimerRing left={left} total={total} size={110} /></div>;
}

function NumberForm({ onSubmit, disabled, placeholder = 'Deine Zahl', decimals }: { onSubmit: (n: number) => void; disabled?: boolean; placeholder?: string; decimals?: boolean }) {
  const [val, setVal] = useState('');
  const n = Number(val.replace(/\./g, '').replace(',', '.'));
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); if (val.trim() && Number.isFinite(n)) { onSubmit(n); setVal(''); } }}>
      <input className="input" style={{ flex: 1, fontSize: '1.6em', textAlign: 'center' }} inputMode={decimals ? 'decimal' : 'numeric'} value={val} disabled={disabled} placeholder={placeholder} onChange={(e) => setVal(e.target.value.replace(/[^0-9,.\-]/g, ''))} />
      <button className="btn green big" type="submit" disabled={disabled || !val.trim()}>OK</button>
    </form>
  );
}

function Inner({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const t = v.settings.timer;
  switch (inner.game) {
    case 'game7':
      return (
        <div className="stack">
          <div className="card center">
            {inner.finished ? <h3>Fertig!</h3> : <h3>Dran: {inner.teams[inner.current]?.label} – exakt {inner.target} {inner.target === 1 ? 'Aufprall' : 'Aufpraller'}</h3>}
            <p>Euer Stand: <b>{inner.teams[inner.myTeam]?.stage ?? 0}</b> {inner.teams[inner.myTeam]?.locked ? '🔒 eingeloggt' : ''}</p>
          </div>
          {inner.canAct ? (
            <div className="stack">
              <button className="btn green huge" onClick={() => act(send, { k: 'g7', v: 'geschafft' })}>✔ Geschafft</button>
              <button className="btn red big" onClick={() => act(send, { k: 'g7', v: 'fehl' })}>✖ Fehlversuch</button>
              <button className="btn gold big" onClick={() => act(send, { k: 'g7', v: 'einloggen' })}>🔒 Einloggen</button>
            </div>
          ) : (
            <p className="center">Ein anderes Team ist dran. Schau zu!</p>
          )}
        </div>
      );
    case 'kopfrechnen':
      return (
        <div className="stack">
          <p className="center small">Aufgabe {inner.nr} von 5</p>
          <div className="card"><div className="task" style={{ fontSize: '2.4em' }}>{inner.text}</div></div>
          {inner.stage === 'frage' ? (
            inner.gesperrt ? <p className="center err">Falsch – du bist für diese Aufgabe raus.</p> : <NumberForm onSubmit={(n) => act(send, { k: 'antwort', value: n })} placeholder="Ergebnis" />
          ) : (
            <div className="card center">
              <h3>Lösung: {formatNumber(inner.loesung)}</h3>
              <p>{inner.ichGewonnen ? '🏆 Du warst am schnellsten!' : inner.winner ? `${inner.winner} war am schnellsten.` : 'Niemand hatte es richtig.'}</p>
            </div>
          )}
          {inner.stage === 'frage' && <Timer v={v} until={inner.until} total={t.kopfrechnen} />}
        </div>
      );
    case 'stirnraten':
      return (
        <div className="stack">
          <p className="center">Jetzt dran: <b>{inner.team}</b> · Rater: <b>{inner.rater}</b></p>
          {inner.role === 'rater' && <div className="card center" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="mega" style={{ color: 'var(--red-dark)', textShadow: 'none' }}>Du rätst! 🤔</div></div>}
          {inner.role === 'erklaerer' && (
            inner.stage === 'laeuft' && inner.term ? (
              <>
                <div className="card center"><p className="small">Erkläre deinem Rater:</p><div className="mega" style={{ color: 'var(--red-dark)', textShadow: 'none', fontSize: 'clamp(2rem,11vw,4.5rem)' }}>{inner.term}</div></div>
                <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className="btn green huge" onClick={() => act(send, { k: 'richtig' })}>✔ Richtig</button>
                  <button className="btn big" onClick={() => act(send, { k: 'weiter' })}>⏭ Überspringen</button>
                </div>
              </>
            ) : <p className="center">Gleich geht’s los – du erklärst!</p>
          )}
          {inner.role === 'zuschauer' && <p className="center">Das andere Team ist dran. Schau zu!</p>}
          {inner.botInfo && inner.stage === 'laeuft' && <div className="center"><BotLine info={inner.botInfo} /></div>}
          {inner.stage === 'laeuft' && <Timer v={v} until={inner.until} total={t.stirnraten} />}
        </div>
      );
    case 'gegenstaende':
      return <GegenPlayer v={v} send={send} inner={inner} />;
    case 'slf':
      return <SlfPlayer v={v} send={send} inner={inner} />;
    case 'schaetzen':
      return (
        <div className="stack">
          <p className="center small">Frage {inner.nr} von 5</p>
          <div className="card"><div className="question" style={{ fontSize: '1.5em' }}>{inner.frage}</div></div>
          {inner.stage === 'frage' ? (
            <>
              <NumberForm decimals onSubmit={(n) => act(send, { k: 'schaetzung', value: n })} placeholder={inner.einheit ? `Schätzung in ${inner.einheit}` : 'Schätzung'} />
              {inner.meine !== null && <p className="center">Deine Schätzung: <b>{formatNumber(inner.meine)} {inner.einheit}</b> (ändern möglich)</p>}
              <Timer v={v} until={inner.until} total={t.schaetzen} />
            </>
          ) : (
            <div className="card center">
              <h3>Lösung: {formatNumber(inner.loesung)} {inner.einheit}</h3>
              {inner.alle.map((a: any) => <p key={a.name}>{a.sieger ? '🏆 ' : ''}{a.name}: {a.wert === null ? '–' : formatNumber(a.wert)}</p>)}
            </div>
          )}
        </div>
      );
    case 'montagsmaler':
      return <MalPlayer v={v} send={send} inner={inner} />;
    case 'flunker':
      return <FlunkerPlayer v={v} send={send} inner={inner} />;
    case 'zahlen':
      return (
        <div className="stack">
          {inner.stage === 'raten' ? (
            inner.role === 'kenner' ? (
              <div className="card center"><p>Du bist <b>Kenner</b>. Die geheime Zahl:</p><div className="mega" style={{ color: 'var(--red-dark)', textShadow: 'none', fontSize: '8em' }}>{inner.zahl}</div><p className="small">Nenne zu jeder Kategorie einen Begriff, der zur Größe der Zahl passt.</p></div>
            ) : (
              <div className="panel stack">
                <p>Du bist <b>Rater</b>. Nenne Kategorien, hör den Kennern zu und tippe dann deine Zahl:</p>
                <div className="grid2" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={`btn big ${inner.meinTipp === n ? 'gold selected' : ''}`} onClick={() => act(send, { k: 'zahlTipp', value: n })}>{n}</button>
                  ))}
                </div>
                {inner.meinTipp !== null && <p className="center">Dein Tipp: <b>{inner.meinTipp}</b> (ändern möglich, bis alle getippt haben)</p>}
              </div>
            )
          ) : (
            <div className="card center"><h3>Die Zahl war</h3><div className="mega" style={{ color: 'var(--red-dark)', textShadow: 'none' }}>{inner.zahl}</div></div>
          )}
          {(inner.hints as any[]).length > 0 && (
            <div className="panel stack" style={{ padding: 12, gap: 4 }}>
              <b>💬 Hinweise der Bot-Kenner</b>
              {(inner.hints as any[]).map((h, i) => <span key={i}>{inner.teams[h.team]?.label}: {h.name} – {h.kategorie}: <b>{h.begriff}</b></span>)}
            </div>
          )}
          {inner.stage === 'raten' && <Timer v={v} until={inner.until} total={t.zahlen} />}
        </div>
      );
    case 'wissen':
      return (
        <div className="stack">
          <p className="center small">Frage {inner.nr} von 5</p>
          <div className="card"><div className="question" style={{ fontSize: '1.35em' }}>{inner.frage}</div></div>
          <div className="stack" style={{ gap: 8 }}>
            {inner.options.map((o: string, i: number) => {
              const partner = inner.partnerWahl.filter((p: any) => p.opt === i).map((p: any) => p.name);
              const correct = inner.richtig === i;
              return (
                <button key={i} disabled={inner.stage !== 'frage' || inner.teamGesperrt} className={`btn big block ${inner.meineWahl === i ? 'gold selected' : ''}`} style={{ justifyContent: 'flex-start', background: correct ? 'linear-gradient(180deg,#43a047,#1b5e20)' : undefined }} onClick={() => act(send, { k: 'waehlen', opt: i })}>
                  <span className="badge">{'ABCD'[i]}</span> {o} {partner.length > 0 && <span className="small"> 👤 {partner.join(', ')}</span>}
                </button>
              );
            })}
          </div>
          {inner.teamGesperrt && inner.stage === 'frage' && <p className="center badge green">🔒 Eure Antwort ist gesperrt</p>}
          {inner.stage === 'frage' && !inner.teamGesperrt && <p className="small center">Wählt beide dieselbe Antwort, wird sie gesperrt.</p>}
          {inner.stage === 'frage' && <Timer v={v} until={inner.until} total={t.wissen} />}
        </div>
      );
    case 'begriffe':
      return (
        <div className="stack">
          <p className="center">Durchgang {inner.durchgang}/{inner.durchgaenge}: <b>{inner.team}</b> · Erklärer: <b>{inner.erklaerer}</b></p>
          {inner.role === 'erklaerer' ? (
            inner.stage === 'laeuft' && inner.term ? (
              <>
                <div className="card center"><p className="small">Erkläre (ohne das Wort oder Teile davon):</p><div className="mega" style={{ color: 'var(--red-dark)', textShadow: 'none', fontSize: 'clamp(2rem,11vw,4.5rem)' }}>{inner.term}</div></div>
                <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className="btn green huge" onClick={() => act(send, { k: 'erraten' })}>✔ Erraten</button>
                  <button className="btn big" onClick={() => act(send, { k: 'weiter' })}>⏭ Überspringen</button>
                </div>
              </>
            ) : <p className="center head">Gleich bist du dran mit Erklären!</p>
          ) : inner.role === 'rater' ? (
            <div className="card center"><h3>Du rätst!</h3><p>Hör gut zu und rufe deine Antworten laut.</p></div>
          ) : (
            <p className="center">Ein anderes Team ist dran.</p>
          )}
          {inner.botInfo && inner.stage === 'laeuft' && <div className="center"><BotLine info={inner.botInfo} /></div>}
          {inner.stage === 'laeuft' && <Timer v={v} until={inner.until} total={t.begriffe} />}
        </div>
      );
    default:
      return null;
  }
}

function GegenPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  if (inner.stage === 'start' || inner.stage === 'zeigen')
    return v.hostConnected ? (
      <div className="card center" style={{ padding: 40 }}><h2>👀 Schau auf den Hauptscreen!</h2><p>Merke dir die Gegenstände und ihre Nummern.</p></div>
    ) : (
      <div className="card center" style={{ padding: 16 }}>
        <h3>👀 Merke dir die Gegenstände und ihre Nummern!</h3>
        {inner.stage === 'zeigen' ? <Timer v={v} until={inner.until} total={10} /> : <p>Gleich geht’s los …</p>}
      </div>
    );
  if (inner.stage === 'abfrage')
    return (
      <div className="stack">
        <h2 className="center">Was war auf Feld <span className="gold">{inner.nr}</span>?</h2>
        <div className="emoji-grid">
          {inner.options.map((o: any) => (
            <button key={o.emoji} className={`emoji-btn ${inner.meineWahl === o.emoji ? 'sel' : ''}`} onClick={() => act(send, { k: 'gegenstand', nr: inner.nr, emoji: o.emoji })} title={o.name}>{o.emoji}</button>
          ))}
        </div>
        <Timer v={v} until={inner.until} total={v.settings.timer.gegenstaende} />
      </div>
    );
  const mine = inner.meineAntworten ?? {};
  const score = (inner.items ?? []).filter((it: any, i: number) => mine[i + 1] === it.emoji).length;
  return (
    <div className="card center">
      <h3>Du hattest {score} von 10 richtig!</h3>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
        {(inner.items ?? []).map((it: any, i: number) => (
          <div key={i} className="tile" style={{ fontSize: '1.6rem', borderColor: mine[i + 1] === it.emoji ? '#43a047' : '#c62828' }}><span className="nr" style={{ fontSize: '0.7rem' }}>{i + 1}</span>{it.emoji}</div>
        ))}
      </div>
    </div>
  );
}

function SlfPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const [answers, setAnswers] = useState<string[]>(inner.meineAntworten ?? ['', '', '', '', '']);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const push = (a: string[]) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => act(send, { k: 'slfAntworten', answers: a }), 300);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  if (inner.stage !== 'pruefung') {
    return (
      <div className="stack">
        <div className="row center"><span className="field lg">{inner.letter}</span></div>
        {inner.stopBy && <p className="center badge red" style={{ fontSize: '1.1em' }}>✋ Stopp von {inner.stopBy}! Noch 10 Sekunden!</p>}
        {inner.cats.map((c: string, i: number) => (
          <label key={i} className="stack" style={{ gap: 4 }}>
            <b>{c}</b>
            <input className="input" value={answers[i]} maxLength={40} placeholder={`${inner.letter} …`} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); push(a); }} />
          </label>
        ))}
        <div className="row center">
          <button className="buzzer" disabled={!!inner.stopBy} onClick={() => { act(send, { k: 'slfAntworten', answers }); act(send, { k: 'buzz' }); }}>STOPP!</button>
        </div>
        <Timer v={v} until={inner.until} total={inner.stopBy ? 10 : v.settings.timer.slf} />
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="center">Tippe auf Antworten, die du für <b>ungültig</b> hältst. Bei Mehrheit zählen sie nicht.</p>
      {inner.tabelle.filter((r: any) => r.id !== inner.ich).map((row: any) => (
        <div key={row.id} className="panel stack" style={{ padding: 12 }}>
          <b>{row.name}</b>
          {row.antworten.map((a: any, i: number) => {
            const key = `${row.id}|${i}`;
            const flagged = inner.meineFlags.includes(key);
            return (
              <button key={i} className={`btn sm block ${flagged ? 'red' : 'ghost'}`} style={{ justifyContent: 'space-between' }} disabled={!a.text} onClick={() => act(send, { k: 'flag', owner: row.id, cat: i })}>
                <span className="small">{inner.cats[i]}:</span>
                <span className={a.status === 'ok' || a.status === 'abgelehnt' ? '' : 'strike'}>{a.text || '–'}</span>
                <span>{flagged ? '👎' : a.status === 'doppelt' ? 'doppelt' : a.status === 'buchstabe' ? '✖' : ''}</span>
              </button>
            );
          })}
        </div>
      ))}
      {inner.ichFertig ? <p className="center badge green">✔ Fertig – warte auf die anderen</p> : <button className="btn green big" onClick={() => act(send, { k: 'fertig' })}>Fertig mit Prüfen</button>}
    </div>
  );
}

function MalPlayer({ v, send, inner }: { v: PlayerView; send: Send; inner: any }) {
  const [guess, setGuess] = useState('');
  return (
    <div className="stack">
      <p className="center"><b>{inner.team}</b> · Zeichner: <b>{inner.drawer}</b></p>
      {inner.role === 'zeichner' && (
        inner.stage === 'laeuft' && inner.term ? (
          <>
            <div className="card center" style={{ padding: 10 }}><span className="small">Zeichne ({inner.begriffNr}/8):</span> <b className="head" style={{ fontSize: '1.5em', color: 'var(--red-dark)' }}>{inner.term}</b></div>
            <DrawCanvas key={inner.begriffNr} onStroke={(s) => act(send, { k: 'strich', ...s })} onClear={() => act(send, { k: 'loeschen' })} />
            <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button className="btn green big" onClick={() => act(send, { k: 'erraten' })}>✔ Erraten</button>
              <button className="btn big" onClick={() => act(send, { k: 'weiter' })}>⏭ Überspringen</button>
            </div>
          </>
        ) : <p className="center head">Gleich zeichnest du!</p>
      )}
      {inner.role !== 'zeichner' && inner.strokes && (inner.stage === 'laeuft' || inner.stage === 'pause') && (
        <LiveDrawing strokes={inner.strokes} resetKey={`${inner.teamIdx}-${inner.begriffNr}`} />
      )}
      {inner.role === 'rater' && (
        <>
          <p className="center">{inner.strokes ? 'Rate! Laut rufen oder hier tippen:' : 'Schau auf den Hauptscreen und rate! Laut rufen oder hier tippen:'}</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (guess.trim()) { act(send, { k: 'tipp', text: guess }); setGuess(''); } }}>
            <input className="input" style={{ flex: 1 }} value={guess} maxLength={40} onChange={(e) => setGuess(e.target.value)} placeholder="Dein Tipp" disabled={inner.stage !== 'laeuft'} />
            <button className="btn green" type="submit" disabled={inner.stage !== 'laeuft'}>Raten</button>
          </form>
          {inner.lastSolved && <p className="center" style={{ color: '#a5e89a' }}>✔ Erraten: {inner.lastSolved}</p>}
          {inner.guesses.slice(-4).map((g: any, i: number) => <p key={i} className="small center">{g.name}: {g.text} {g.ok ? '✔' : ''}</p>)}
        </>
      )}
      {inner.role === 'zuschauer' && <p className="center">Das andere Team ist dran.{inner.strokes ? '' : ' Schau auf den Hauptscreen!'}</p>}
      {inner.role === 'zuschauer' && inner.guesses.slice(-3).map((g: any, i: number) => <p key={i} className="small center">{g.name}: {g.text} {g.ok ? '✔' : ''}</p>)}
      {inner.stage === 'laeuft' && <Timer v={v} until={inner.until} total={v.settings.timer.montagsmaler} />}
      <div className="row center">{inner.correct.map((c: any, i: number) => <span key={i} className="chip">{c.label}: {c.n}</span>)}</div>
    </div>
  );
}

