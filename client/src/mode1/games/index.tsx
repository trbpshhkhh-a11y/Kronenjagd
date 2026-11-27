import { useEffect, useState } from 'react';
import {
  cryptoRng, mathRound, MathTask, drawSchaetzfragen, drawWissen, drawKategorien, drawGegenstaende, drawBegriffe, SLF_BUCHSTABEN,
  pick, shuffle, randInt, G7State, g7Advance, Gegenstand, Schaetzfrage, WissenFrage, formatNumber, zahlenBonus, BEGRIFFE_DURCHGAENGE,
  drawSongs, SONGS,
} from '@kronen/shared';
import { abspielen, unlockAudio, pufferAbspielen } from '../../lib/melody';
import { liederLaden, ausschnitt, LiedMeta } from '../../lib/eigeneLieder';
import { useM1, M1State, nameOf } from '../store';
import { finishGame, TeamCards } from '../Mode1App';
import { GameShell, SecretShare, RoundTimer, TeamLine } from './common';
import { Stepper, TimerRing } from '../../components/ui';
import { SlotRoller } from '../../components/Roller';
import { useCountdown } from '../../lib/hooks';

/** Spielzustand im gespeicherten Mode-1-Zustand (übersteht Neuladen) */
function useData<T>(init: (d: M1State) => T): [T | null, (fn: (data: T, d: M1State) => void) => void] {
  const { s, update } = useM1();
  useEffect(() => {
    if (s.game && s.game.data === null) update((d) => void (d.game!.data = init(d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.game?.data === null]);
  const set = (fn: (data: T, d: M1State) => void) => update((d) => fn(d.game!.data as T, d));
  return [(s.game?.data as T) ?? null, set];
}

export function GameScreen() {
  const { s } = useM1();
  switch (s.game?.id) {
    case 'game7': return <Game7 />;
    case 'kopfrechnen': return <Kopfrechnen />;
    case 'stirnraten': return <TeamScoreGame label="richtigen Antworten" />;
    case 'gegenstaende': return <Gegenstaende />;
    case 'slf': return <Slf />;
    case 'schaetzen': return <Schaetzen />;
    case 'montagsmaler': return <Montagsmaler />;
    case 'zahlen': return <Zahlen />;
    case 'wissen': return <Wissen />;
    case 'begriffe': return <Begriffe />;
    case 'songs': return <Songs />;
    default: return null;
  }
}

/* ---------------------- Hilfs-Komponenten --------------------------- */

function ScoreInputs({ entries, values, onChange, max = 30, unit = 'Punkte' }: { entries: { key: string; label: string }[]; values: Record<string, number>; onChange: (k: string, v: number) => void; max?: number; unit?: string }) {
  return (
    <div className="list">
      {entries.map((e) => (
        <div className="list-item" key={e.key}>
          <span className="head grow" style={{ fontSize: '1.2em' }}>{e.label}</span>
          <Stepper value={values[e.key] ?? 0} min={0} max={max} onChange={(v) => onChange(e.key, v)} />
          <span className="small muted">{unit}</span>
        </div>
      ))}
    </div>
  );
}

function PickPlayers({ s, selected, onToggle, multi }: { s: M1State; selected: string[]; onToggle: (id: string) => void; multi?: boolean }) {
  return (
    <div className="row center">
      {s.players.map((p) => (
        <button key={p.id} className={`btn ${selected.includes(p.id) ? 'gold selected' : ''}`} onClick={() => onToggle(p.id)}>
          {selected.includes(p.id) ? '✔ ' : ''}{p.name}
        </button>
      ))}
      {!multi && null}
    </div>
  );
}

/* ---------------------------- 1. Game of 7 -------------------------- */

function Game7() {
  const { s, update } = useM1();
  const [d, set] = useData<G7State>((st) => ({ game: 'game7', teams: st.game!.teams.map(() => ({ stage: 0, locked: false })), target: 1, current: 0, finished: false }));
  if (!d) return null;
  const teams = s.game!.teams;
  const act = (v: 'geschafft' | 'fehl' | 'einloggen') =>
    set((g) => {
      const t = g.teams[g.current];
      if (v === 'geschafft') {
        t.stage = g.target;
        if (t.stage >= 7) {
          t.locked = true;
          g.finished = true;
          return;
        }
      } else if (v === 'fehl') t.stage = 0;
      else t.locked = true;
      g7Advance(g);
    });
  return (
    <GameShell showTeams={false}>
      <div className="grid2">
        {teams.map((t, i) => (
          <div key={i} className="card" style={i === d.current && !d.finished ? { borderColor: '#2e7d32', boxShadow: '0 0 0 5px #66bb6a' } : undefined}>
            <div className="row between">
              <h3>{t.name}</h3>
              {d.teams[i].locked && <span className="badge green">🔒 eingeloggt</span>}
            </div>
            <p>{t.members.map((m) => nameOf(s, m)).join(' & ')}</p>
            <div className="row" style={{ gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <span key={n} className="field" style={{ ['--size' as string]: '2.2em', opacity: n <= d.teams[i].stage ? 1 : 0.3 }}>{n}</span>
              ))}
            </div>
            <p className="head" style={{ fontSize: '1.4em', color: 'var(--red-dark)' }}>Stufe {d.teams[i].stage}</p>
          </div>
        ))}
      </div>
      {!d.finished ? (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <p className="head" style={{ fontSize: '1.6em' }}>
            Dran: <span className="gold">{teams[d.current].name}</span> – exakt <span className="gold">{d.target}</span> {d.target === 1 ? 'Aufprall' : 'Aufpraller'}
          </p>
          <div className="row center">
            <button className="btn green big" onClick={() => act('geschafft')}>✔ Geschafft</button>
            <button className="btn red big" onClick={() => act('fehl')}>✖ Fehlversuch (zurück auf 0)</button>
            <button className="btn gold big" onClick={() => act('einloggen')}>🔒 Einloggen</button>
          </div>
          <button className="btn ghost sm" onClick={() => set((g) => void (g.finished = true))}>Spiel beenden</button>
        </div>
      ) : (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <h2>Spiel beendet!</h2>
          <button className="btn gold big" onClick={() => finishGame(update, { kind: 'team', teams, scores: d.teams.map((t) => t.stage) })}>Ergebnis übernehmen</button>
        </div>
      )}
    </GameShell>
  );
}

/* ---------------------------- 2. Kopfrechnen ------------------------ */

interface KopfData { tasks: MathTask[]; idx: number; show: boolean; winners: (string | null)[] }
function Kopfrechnen() {
  const { s, update } = useM1();
  const [d, set] = useData<KopfData>(() => ({ tasks: mathRound(cryptoRng), idx: 0, show: false, winners: [] }));
  if (!d) return null;
  const done = d.idx >= d.tasks.length;
  const scores: Record<string, number> = {};
  d.winners.forEach((w) => w && (scores[w] = (scores[w] ?? 0) + 1));
  const task = d.tasks[Math.min(d.idx, d.tasks.length - 1)];
  const award = (pid: string | null) => set((g) => { g.winners.push(pid); g.idx++; g.show = false; });
  return (
    <GameShell>
      {!done ? (
        <>
          <p className="center head">Aufgabe {d.idx + 1} von {d.tasks.length}</p>
          <div className="card"><div className="task">{task.text} = {d.show ? <span style={{ color: 'var(--green)' }}>{formatNumber(task.solution)}</span> : '?'}</div></div>
          {!d.show ? (
            <div className="row center"><button className="btn gold big" onClick={() => set((g) => void (g.show = true))}>Lösung zeigen</button></div>
          ) : null}
          <div className="panel stack">
            <h3 className="center">Wer hat zuerst richtig geantwortet?</h3>
            <div className="row center">
              {s.players.map((p) => <button key={p.id} className="btn big" onClick={() => award(p.id)}>{p.name}</button>)}
              <button className="btn red big" onClick={() => award(null)}>Niemand</button>
            </div>
          </div>
        </>
      ) : (
        <ResultBlock s={s} scores={scores} onTake={() => finishGame(update, { kind: 'einzel', scores })} />
      )}
      <ScoreLine s={s} scores={scores} />
    </GameShell>
  );
}

function ScoreLine({ s, scores }: { s: M1State; scores: Record<string, number> }) {
  return (
    <div className="row center">
      {s.players.map((p) => <span key={p.id} className="chip">{p.name}: <b className="gold">{scores[p.id] ?? 0}</b></span>)}
    </div>
  );
}

function ResultBlock({ s, scores, onTake }: { s: M1State; scores: Record<string, number>; onTake: () => void }) {
  return (
    <div className="panel stack" style={{ alignItems: 'center' }}>
      <h2>Fertig!</h2>
      <div className="list" style={{ minWidth: 'min(100%,480px)' }}>
        {[...s.players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)).map((p) => (
          <div className="list-item" key={p.id}><span className="grow head">{p.name}</span><b className="gold">{scores[p.id] ?? 0} Punkte</b></div>
        ))}
      </div>
      <button className="btn gold big" onClick={onTake}>Ergebnis übernehmen</button>
    </div>
  );
}

/* ------------------- 3. Stirnraten (Teamwertung) -------------------- */

function TeamScoreGame({ label }: { label: string }) {
  const { s, update } = useM1();
  const [d, set] = useData<{ scores: Record<string, number> }>(() => ({ scores: {} }));
  if (!d) return null;
  const teams = s.game!.teams;
  return (
    <GameShell>
      <div className="card center">
        <p className="head" style={{ fontSize: '1.4em' }}>Spielt jetzt mit eurer Stirnraten-App: jedes Team eine Runde.</p>
        <p>Tragt danach die Anzahl der {label} je Team ein.</p>
      </div>
      <div className="panel">
        <ScoreInputs entries={teams.map((t, i) => ({ key: String(i), label: `${t.name} (${t.members.map((m) => nameOf(s, m)).join(' & ')})` }))} values={d.scores} unit={label} onChange={(k, v) => set((g) => void (g.scores[k] = v))} />
      </div>
      <div className="row center">
        <button className="btn gold big" onClick={() => finishGame(update, { kind: 'team', teams, scores: teams.map((_, i) => d.scores[String(i)] ?? 0) })}>Ergebnis übernehmen</button>
      </div>
    </GameShell>
  );
}

/* ------------------------ 4. Gegenstände merken --------------------- */

interface GegenData { items: Gegenstand[]; order: number[]; stage: 'bereit' | 'zeigen' | 'abfrage' | 'aufloesung'; q: number; scores: Record<string, number> }
function Gegenstaende() {
  const { s, update } = useM1();
  const [d, set] = useData<GegenData>((st) => ({ items: drawGegenstaende(st.pools, cryptoRng, 10), order: shuffle(cryptoRng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), stage: 'bereit', q: 0, scores: {} }));
  if (!d) return null;
  return (
    <GameShell>
      {d.stage === 'bereit' && (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <h2>Gleich erscheinen 10 Gegenstände – für 10 Sekunden!</h2>
          <p>Alle schauen auf den Bildschirm und merken sich so viele wie möglich.</p>
          <button className="btn red huge" onClick={() => set((g) => void (g.stage = 'zeigen'))}>👀 Bild zeigen</button>
        </div>
      )}
      {d.stage === 'zeigen' && <GegenZeigen items={d.items} onDone={() => set((g) => void (g.stage = 'abfrage'))} />}
      {d.stage === 'abfrage' && (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <p className="head">Frage {d.q + 1} von 10 – schreibt den Gegenstand auf!</p>
          <h2 className="mega" style={{ textAlign: 'center' }}>Was war auf Feld <span className="gold">{d.order[d.q]}</span>?</h2>
          {d.q < 9 ? (
            <button className="btn gold big" onClick={() => set((g) => void g.q++)}>Nächste Nummer ➜</button>
          ) : (
            <button className="btn gold big" onClick={() => set((g) => void (g.stage = 'aufloesung'))}>Auflösung zeigen</button>
          )}
        </div>
      )}
      {d.stage === 'aufloesung' && (
        <>
          <Tiles items={d.items} />
          <div className="panel stack">
            <h3>Wie viele richtige Antworten hatte jeder?</h3>
            <ScoreInputs entries={s.players.map((p) => ({ key: p.id, label: p.name }))} values={d.scores} max={10} unit="richtig" onChange={(k, v) => set((g) => void (g.scores[k] = v))} />
            <button className="btn gold big" onClick={() => finishGame(update, { kind: 'einzel', scores: d.scores })}>Ergebnis übernehmen</button>
          </div>
        </>
      )}
    </GameShell>
  );
}

export function Tiles({ items }: { items: Gegenstand[] }) {
  return (
    <div className="tiles">
      {items.map((it, i) => (
        <div className="tile" key={i} title={it.name}>
          <span className="nr">{i + 1}</span>
          <span>{it.emoji}</span>
        </div>
      ))}
    </div>
  );
}

function GegenZeigen({ items, onDone }: { items: Gegenstand[]; onDone: () => void }) {
  const t = useCountdown(10);
  useEffect(() => t.start(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (t.finished) onDone();
  }, [t.finished]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <TimerRing left={t.left} total={10} size={120} />
      <div style={{ width: '100%' }}><Tiles items={items} /></div>
    </div>
  );
}

/* ------------------------- 5. Stadt Land Fluss ---------------------- */

interface SlfData { letter: string; cats: string[]; stage: 'los' | 'schreiben' | 'auswerten'; scores: Record<string, number> }
function Slf() {
  const { s, update } = useM1();
  const [d, set] = useData<SlfData>((st) => ({ letter: pick(cryptoRng, SLF_BUCHSTABEN), cats: drawKategorien(st.pools, cryptoRng, 5), stage: 'los', scores: {} }));
  if (!d) return null;
  return (
    <GameShell>
      {d.stage === 'los' && (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <h2>Der Buchstabe wird ausgelost …</h2>
          <SlotRoller options={SLF_BUCHSTABEN} final={d.letter} duration={2000} render={(v) => v} onDone={() => setTimeout(() => set((g) => void (g.stage = 'schreiben')), 900)} style={{ minWidth: '3em' }} />
        </div>
      )}
      {d.stage === 'schreiben' && (
        <div className="grid2" style={{ alignItems: 'center' }}>
          <div className="card stack" style={{ alignItems: 'center' }}>
            <span className="head" style={{ color: 'var(--red-dark)' }}>Buchstabe</span>
            <div className="mega" style={{ fontSize: 'clamp(6rem,18vw,13rem)', color: 'var(--red-dark)', textShadow: 'none' }}>{d.letter}</div>
          </div>
          <div className="panel stack">
            {d.cats.map((c, i) => <div key={i} className="list-item head" style={{ fontSize: '1.35em' }}>{i + 1}. {c}</div>)}
            {s.slfTimer !== null && <RoundTimer seconds={s.slfTimer} />}
            <button className="btn red huge" onClick={() => set((g) => void (g.stage = 'auswerten'))}>✋ Stopp!</button>
          </div>
        </div>
      )}
      {d.stage === 'auswerten' && (
        <div className="panel stack">
          <h3>Vergleicht eure Antworten (Buchstabe {d.letter}). Jede gültige Antwort 1 Punkt, doppelte Antworten 0.</h3>
          <ScoreInputs entries={s.players.map((p) => ({ key: p.id, label: p.name }))} values={d.scores} max={5} onChange={(k, v) => set((g) => void (g.scores[k] = v))} />
          <button className="btn gold big" onClick={() => finishGame(update, { kind: 'einzel', scores: d.scores })}>Ergebnis übernehmen</button>
        </div>
      )}
    </GameShell>
  );
}

/* --------------------------- 6. Schätzmeister ----------------------- */

interface SchaetzData { qs: Schaetzfrage[]; idx: number; show: boolean; sel: string[]; winners: string[][] }
function Schaetzen() {
  const { s, update } = useM1();
  const [d, set] = useData<SchaetzData>((st) => ({ qs: drawSchaetzfragen(st.pools, cryptoRng, 5), idx: 0, show: false, sel: [], winners: [] }));
  if (!d) return null;
  const scores: Record<string, number> = {};
  d.winners.flat().forEach((w) => (scores[w] = (scores[w] ?? 0) + 1));
  const done = d.idx >= d.qs.length;
  const q = d.qs[Math.min(d.idx, d.qs.length - 1)];
  return (
    <GameShell>
      {!done ? (
        <>
          <p className="center head">Frage {d.idx + 1} von {d.qs.length}</p>
          <div className="card stack">
            <div className="question">{q.frage}</div>
            {d.show && <div className="task" style={{ color: 'var(--green)' }}>{formatNumber(q.wert)} {q.einheit}</div>}
          </div>
          {!d.show ? (
            <div className="row center"><button className="btn gold big" onClick={() => set((g) => void (g.show = true))}>Lösung zeigen</button></div>
          ) : (
            <div className="panel stack">
              <h3 className="center">Wer lag am nächsten dran? (bei Gleichstand mehrere)</h3>
              <PickPlayers s={s} multi selected={d.sel} onToggle={(id) => set((g) => void (g.sel = g.sel.includes(id) ? g.sel.filter((x) => x !== id) : [...g.sel, id]))} />
              <div className="row center">
                <button className="btn gold big" onClick={() => set((g) => { g.winners.push(g.sel); g.sel = []; g.idx++; g.show = false; })}>{d.idx < 4 ? 'Nächste Frage ➜' : 'Fertig'}</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <ResultBlock s={s} scores={scores} onTake={() => finishGame(update, { kind: 'einzel', scores })} />
      )}
      <ScoreLine s={s} scores={scores} />
    </GameShell>
  );
}

/* ---------------------------- 7. Montagsmaler ----------------------- */

interface MalData { round: number; drawers: string[]; terms: string[][]; counts: number[] }
function Montagsmaler() {
  const { s, update } = useM1();
  const [d, set] = useData<MalData>((st) => ({
    round: 0,
    drawers: st.game!.teams.map((t) => pick(cryptoRng, t.members)),
    terms: st.game!.teams.map(() => drawBegriffe(st.pools, cryptoRng, 8)),
    counts: st.game!.teams.map(() => 0),
  }));
  if (!d) return null;
  const teams = s.game!.teams;
  const done = d.round >= teams.length;
  return (
    <GameShell showTeams={false}>
      <TeamLine s={s} active={d.round} />
      {!done ? (
        <div key={d.round} className="grid2" style={{ alignItems: 'start' }}>
          <SecretShare who={nameOf(s, d.drawers[d.round])} payload={{ t: 'begriffe', titel: `Montagsmaler – ${teams[d.round].name}`, items: d.terms[d.round] }} />
          <div className="panel stack" style={{ alignItems: 'center' }}>
            <p className="head" style={{ fontSize: '1.4em' }}>{teams[d.round].name} – Zeichner: <span className="gold">{nameOf(s, d.drawers[d.round])}</span></p>
            <RoundTimer seconds={30} />
            <p>Wie viele Begriffe wurden erraten?</p>
            <Stepper value={d.counts[d.round]} min={0} max={8} onChange={(v) => set((g) => void (g.counts[g.round] = v))} />
            <button className="btn gold big" onClick={() => set((g) => void g.round++)}>{d.round < teams.length - 1 ? 'Weiter: nächstes Team ➜' : 'Fertig'}</button>
          </div>
        </div>
      ) : (
        <TeamResult s={s} scores={d.counts} onTake={() => finishGame(update, { kind: 'team', teams, scores: d.counts })} />
      )}
    </GameShell>
  );
}

function TeamResult({ s, scores, onTake }: { s: M1State; scores: number[]; onTake: () => void }) {
  return (
    <div className="panel stack" style={{ alignItems: 'center' }}>
      <h2>Fertig!</h2>
      <div className="list" style={{ minWidth: 'min(100%,520px)' }}>
        {s.game!.teams.map((t, i) => (
          <div className="list-item" key={i}><span className="grow head">{t.name} <span className="small muted">({t.members.map((m) => nameOf(s, m)).join(' & ')})</span></span><b className="gold">{scores[i]} Punkte</b></div>
        ))}
      </div>
      <button className="btn gold big" onClick={onTake}>Ergebnis übernehmen</button>
    </div>
  );
}

/* ---------------------------- 8. Zahlen erraten --------------------- */

interface ZahlenData { secret: number; raters: string[]; tips: (number | null)[]; revealed: boolean }
function Zahlen() {
  const { s, update } = useM1();
  const [d, set] = useData<ZahlenData>((st) => ({ secret: randInt(cryptoRng, 1, 10), raters: st.game!.teams.map((t) => pick(cryptoRng, t.members)), tips: st.game!.teams.map(() => null), revealed: false }));
  if (!d) return null;
  const teams = s.game!.teams;
  const kenner = teams.flatMap((t, i) => t.members.filter((m) => m !== d.raters[i]));
  return (
    <GameShell showTeams={false}>
      <div className="grid2">
        {teams.map((t, i) => (
          <div className="card" key={i}>
            <h3>{t.name}</h3>
            <p>🔎 Rater: <b>{nameOf(s, d.raters[i])}</b></p>
            <p>🧠 Kenner: <b>{t.members.filter((m) => m !== d.raters[i]).map((m) => nameOf(s, m)).join(', ')}</b></p>
            <p className="small">Tipp des Raters:</p>
            <div className="row" style={{ gap: 6 }}>
              {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                <button key={n} disabled={d.revealed} className={`btn sm ${d.tips[i] === n ? 'gold selected' : ''}`} onClick={() => set((g) => void (g.tips[i] = n))}>{n}</button>
              ))}
            </div>
            {d.revealed && <p className="head" style={{ fontSize: '1.3em', color: 'var(--green)' }}>Bonus: +{zahlenBonus(d.secret, d.tips[i])} Felder</p>}
          </div>
        ))}
      </div>
      {!d.revealed ? (
        <>
          <SecretShare who={'die Kenner (' + kenner.map((k) => nameOf(s, k)).join(', ') + ')'} payload={{ t: 'zahl', titel: 'Zahlen erraten – geheime Zahl', zahl: d.secret }} />
          <div className="row center">
            <button className="btn red big" disabled={d.tips.some((x) => x === null)} onClick={() => set((g) => void (g.revealed = true))}>🎉 Zahl aufdecken</button>
          </div>
        </>
      ) : (
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <h2>Die geheime Zahl war</h2>
          <div className="mega gold" style={{ fontSize: 'clamp(6rem,20vw,12rem)' }}>{d.secret}</div>
          <button className="btn gold big" onClick={() => finishGame(update, { kind: 'zahlen', teams, secret: d.secret, tips: d.tips })}>Ergebnis übernehmen</button>
        </div>
      )}
    </GameShell>
  );
}

/* ---------------------------- 9. Allgemeinwissen -------------------- */

interface WissenData { qs: WissenFrage[]; idx: number; show: boolean; sel: number[]; correct: number[][] }
function Wissen() {
  const { s, update } = useM1();
  const [d, set] = useData<WissenData>((st) => ({ qs: drawWissen(st.pools, cryptoRng, 5), idx: 0, show: false, sel: [], correct: [] }));
  if (!d) return null;
  const teams = s.game!.teams;
  const scores = teams.map((_, i) => d.correct.filter((c) => c.includes(i)).length);
  const done = d.idx >= d.qs.length;
  const q = d.qs[Math.min(d.idx, d.qs.length - 1)];
  return (
    <GameShell>
      {!done ? (
        <>
          <p className="center head">Frage {d.idx + 1} von {d.qs.length}</p>
          <div className="card stack">
            <div className="question">{q.frage}</div>
            {d.show && <div className="task" style={{ color: 'var(--green)', fontSize: 'clamp(2rem,5vw,4.4rem)' }}>{q.antwort}</div>}
          </div>
          {!d.show ? (
            <div className="row center"><button className="btn gold big" onClick={() => set((g) => void (g.show = true))}>Lösung zeigen</button></div>
          ) : (
            <div className="panel stack">
              <h3 className="center">{teams.every((t) => t.members.length === 1) ? 'Wer lag richtig?' : 'Welche Teams lagen richtig?'}</h3>
              <div className="row center">
                {teams.map((t, i) => (
                  <button key={i} className={`btn big ${d.sel.includes(i) ? 'gold selected' : ''}`} onClick={() => set((g) => void (g.sel = g.sel.includes(i) ? g.sel.filter((x) => x !== i) : [...g.sel, i]))}>
                    {d.sel.includes(i) ? '✔ ' : ''}{t.name}
                  </button>
                ))}
              </div>
              <div className="row center">
                <button className="btn gold big" onClick={() => set((g) => { g.correct.push(g.sel); g.sel = []; g.idx++; g.show = false; })}>{d.idx < 4 ? 'Nächste Frage ➜' : 'Fertig'}</button>
              </div>
            </div>
          )}
          <div className="row center">{teams.map((t, i) => <span key={i} className="chip">{t.name}: <b className="gold">{scores[i]}</b></span>)}</div>
        </>
      ) : (
        <TeamResult s={s} scores={scores} onTake={() => finishGame(update, { kind: 'team', teams, scores })} />
      )}
    </GameShell>
  );
}

/* ----------------------------- Rückwärts-Songs ---------------------- */

type SongItem = { t: 'app'; i: number } | { t: 'eigen'; id: string; titel: string; kuenstler: string };
interface SongsData { items?: SongItem[]; ids?: number[]; idx: number; show: boolean; sel: number[]; correct: number[][] }

/** Lieder wählen: aus der App, eigene (auf diesem Gerät) oder gemischt */
function songItems(st: M1State, eigene: LiedMeta[]): SongItem[] {
  const q = eigene.length ? st.songQuelle ?? 'app' : 'app';
  const nEigen = q === 'eigene' ? Math.min(5, eigene.length) : q === 'beide' ? Math.min(3, eigene.length) : 0;
  const e: SongItem[] = shuffle(cryptoRng, eigene).slice(0, nEigen).map((m) => ({ t: 'eigen', id: m.id, titel: m.titel, kuenstler: m.kuenstler }));
  const a: SongItem[] = drawSongs(st.pools, cryptoRng, 5 - e.length).map((i) => ({ t: 'app', i }));
  const out: SongItem[] = [];
  while (e.length || a.length) {
    if (e.length) out.push(e.shift()!);
    if (a.length) out.push(a.shift()!);
  }
  return out;
}

function Songs() {
  const { s } = useM1();
  const [eigene, setEigene] = useState<LiedMeta[] | null>((s.songQuelle ?? 'app') === 'app' || s.game?.data ? [] : null);
  useEffect(() => {
    if (eigene === null) liederLaden().then(setEigene);
  }, [eigene]);
  if (eigene === null) return <GameShell><p className="center">Lade eigene Lieder …</p></GameShell>;
  return <SongsRunde eigene={eigene} />;
}

function SongsRunde({ eigene }: { eigene: LiedMeta[] }) {
  const { s, update } = useM1();
  const [d, set] = useData<SongsData>((st) => ({ items: songItems(st, eigene), idx: 0, show: false, sel: [], correct: [] }));
  const [stop, setStop] = useState<(() => void) | null>(null);
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => () => stop?.(), [stop]);
  if (!d) return null;
  const items: SongItem[] = d.items ?? (d.ids ?? []).map((i) => ({ t: 'app', i }));
  const teams = s.game!.teams;
  const scores = teams.map((_, i) => d.correct.filter((c) => c.includes(i)).length);
  const done = d.idx >= items.length;
  const item = items[Math.min(d.idx, items.length - 1)];
  const titel = item.t === 'app' ? SONGS[item.i].titel : item.titel;
  const kuenstler = item.t === 'eigen' ? item.kuenstler : '';
  const play = async (rueckwaerts: boolean) => {
    stop?.();
    unlockAudio();
    setFehlt(false);
    if (item.t === 'app') {
      setStop(() => abspielen(SONGS[item.i], { rueckwaerts }));
      return;
    }
    try {
      const a = await ausschnitt(item.id);
      setStop(() => pufferAbspielen(rueckwaerts ? a.rueck : a.vor, {}));
    } catch {
      setFehlt(true);
    }
  };
  return (
    <GameShell>
      {!done ? (
        <>
          <p className="center head">Lied {d.idx + 1} von {items.length}</p>
          <div className="card stack center" style={{ alignItems: 'center' }}>
            {!d.show ? (
              <>
                <p style={{ margin: 0 }}>Hört genau hin und schreibt den Liedtitel auf!</p>
                <button className="btn gold huge" onClick={() => play(true)}>◀◀ Rückwärts abspielen</button>
                <p className="small" style={{ margin: 0 }}>So oft abspielen, wie ihr wollt.</p>
              </>
            ) : (
              <>
                <p className="small" style={{ margin: 0 }}>Das Lied war:</p>
                <div className="task" style={{ color: 'var(--green)', fontSize: 'clamp(1.8rem,5vw,3.6rem)' }}>{titel}</div>
                {kuenstler && <p style={{ margin: 0, fontWeight: 700 }}>{kuenstler}</p>}
                <button className="btn big" onClick={() => play(false)}>▶ Vorwärts anhören</button>
              </>
            )}
            {fehlt && <p className="err small" style={{ margin: 0 }}>Dieses Lied ist auf diesem Gerät nicht mehr gespeichert.</p>}
          </div>
          {!d.show ? (
            <div className="row center"><button className="btn gold big" onClick={() => { stop?.(); set((g) => void (g.show = true)); }}>Lösung zeigen</button></div>
          ) : (
            <div className="panel stack">
              <h3 className="center">Wer lag richtig?</h3>
              <div className="row center">
                {teams.map((t, i) => (
                  <button key={i} className={`btn big ${d.sel.includes(i) ? 'gold selected' : ''}`} onClick={() => set((g) => void (g.sel = g.sel.includes(i) ? g.sel.filter((x) => x !== i) : [...g.sel, i]))}>
                    {d.sel.includes(i) ? '✔ ' : ''}{t.name}
                  </button>
                ))}
              </div>
              <div className="row center">
                <button className="btn gold big" onClick={() => { stop?.(); set((g) => { g.correct.push(g.sel); g.sel = []; g.idx++; g.show = false; }); }}>{d.idx < items.length - 1 ? 'Nächstes Lied ➜' : 'Fertig'}</button>
              </div>
            </div>
          )}
          <div className="row center">{teams.map((t, i) => <span key={i} className="chip">{t.name}: <b className="gold">{scores[i]}</b></span>)}</div>
        </>
      ) : (
        <TeamResult s={s} scores={scores} onTake={() => finishGame(update, { kind: 'team', teams, scores })} />
      )}
    </GameShell>
  );
}

/* --------------------------- 10. Begriffe erklären ------------------ */

interface BegriffeData { seq: { team: number; explainer: string; terms: string[] }[]; idx: number; counts: number[] }
function Begriffe() {
  const { s, update } = useM1();
  const [d, set] = useData<BegriffeData>((st) => {
    const seq: BegriffeData['seq'] = [];
    for (let r = 0; r < BEGRIFFE_DURCHGAENGE; r++) st.game!.teams.forEach((t, i) => seq.push({ team: i, explainer: t.members[r % t.members.length], terms: drawBegriffe(st.pools, cryptoRng, 12) }));
    return { seq, idx: 0, counts: seq.map(() => 0) };
  });
  if (!d) return null;
  const teams = s.game!.teams;
  const done = d.idx >= d.seq.length;
  const scores = teams.map((_, i) => d.seq.reduce((sum, r, k) => sum + (r.team === i ? d.counts[k] : 0), 0));
  const cur = d.seq[Math.min(d.idx, d.seq.length - 1)];
  return (
    <GameShell showTeams={false}>
      <TeamLine s={s} active={done ? undefined : cur.team} />
      {!done ? (
        <div key={d.idx} className="grid2" style={{ alignItems: 'start' }}>
          <SecretShare who={nameOf(s, cur.explainer)} payload={{ t: 'begriffe', titel: `Begriffe erklären – ${teams[cur.team].name}`, items: cur.terms }} />
          <div className="panel stack" style={{ alignItems: 'center' }}>
            <p className="small">Durchgang {d.idx + 1} von {d.seq.length}</p>
            <p className="head" style={{ fontSize: '1.4em' }}>{teams[cur.team].name} – Erklärer: <span className="gold">{nameOf(s, cur.explainer)}</span></p>
            <RoundTimer seconds={30} />
            <p>Wie viele Begriffe wurden erraten?</p>
            <Stepper value={d.counts[d.idx]} min={0} max={12} onChange={(v) => set((g) => void (g.counts[g.idx] = v))} />
            <button className="btn gold big" onClick={() => set((g) => void g.idx++)}>{d.idx < d.seq.length - 1 ? 'Weiter ➜' : 'Fertig'}</button>
          </div>
        </div>
      ) : (
        <TeamResult s={s} scores={scores} onTake={() => finishGame(update, { kind: 'team', teams, scores })} />
      )}
    </GameShell>
  );
}

export { TeamCards };
