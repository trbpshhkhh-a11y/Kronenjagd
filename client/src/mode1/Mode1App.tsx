import { useEffect, useMemo, useState } from 'react';
import {
  cryptoRng, drawStartFields, drawCrownField, drawNextGame, gameById, makeTeams, GAMES, computeBonus, GameResult, addBonus, GameId,
} from '@kronen/shared';
import { useM1, M1State, nameOf } from './store';
import { SlotRoller, FIELD_NUMBERS } from '../components/Roller';
import { GameSlotMachine } from '../components/SlotMachine';
import { FieldBadge, Confirm, Modal, Stepper } from '../components/ui';
import { CrownSvg } from '../components/icons';
import { Confetti } from '../components/Decor';
import { RulesButton } from '../components/Rules';
import { go } from '../lib/router';
import { GameScreen } from './games';

export function Mode1App() {
  const { s } = useM1();
  switch (s.phase) {
    case 'setup':
      return <Setup />;
    case 'startDraw':
      return <StartDraw />;
    case 'crownDraw':
      return <CrownDraw />;
    case 'overview':
      return <Overview />;
    case 'gameDraw':
      return <GameDraw />;
    case 'teams':
      return <TeamsDraw />;
    case 'playing':
      return <GameScreen />;
    case 'result':
      return <Result />;
    case 'winner':
      return <Winner />;
  }
}

/* ------------------------------------------------------------------ */

function TopBar({ title }: { title?: string }) {
  const { reset } = useM1();
  const [ask, setAsk] = useState(false);
  return (
    <div className="topbar">
      <button className="btn ghost sm" onClick={() => go('/')}>⬅ Start</button>
      {title && <h2 className="gold" style={{ textAlign: 'center' }}>{title}</h2>}
      <button className="btn ghost sm" onClick={() => setAsk(true)} aria-label="Neues Spiel / Zurücksetzen">↺<span className="hide-mobile"> Neues Spiel / Zurücksetzen</span></button>
      {ask && (
        <Modal onClose={() => setAsk(false)}>
          <div className="card stack center">
            <h2>Spiel wirklich zurücksetzen?</h2>
            <p>Kronen, Bonusfelder und Startfelder gehen verloren.</p>
            <div className="row center">
              <button className="btn red big" onClick={() => { reset(true); setAsk(false); }}>Ja, mit denselben Spielern</button>
              <button className="btn red big" onClick={() => { reset(false); setAsk(false); }}>Ja, alles löschen</button>
              <button className="btn big" onClick={() => setAsk(false)}>Abbrechen</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------- Setup -------------------------------- */

function Setup() {
  const { s, update } = useM1();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const n = name.trim();
    if (n.length < 1) return;
    if (s.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return setErr('Diesen Namen gibt es schon.');
    update((d) => void d.players.push({ id: 'p' + Date.now().toString(36) + Math.floor(cryptoRng() * 1000), name: n.slice(0, 20), kronen: 0, start: null, bonus: 0 }));
    setName('');
    setErr('');
  };
  const start = () =>
    update((d) => {
      const fields = drawStartFields(cryptoRng, d.players.length);
      d.players.forEach((p, i) => {
        p.start = fields[i];
        p.kronen = 0;
        p.bonus = 0;
      });
      d.crown = null;
      d.phase = 'startDraw';
    });
  return (
    <div className="screen m1-setup">
      <TopBar title="Mitspieler eintragen" />
      <div className="grid2">
        <div className="panel stack">
          <h3>Spieler hinzufügen</h3>
          <form className="row" onSubmit={(e) => (e.preventDefault(), add())}>
            <input className="input grow" value={name} maxLength={20} placeholder="Name" onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
            <button className="btn green" type="submit" disabled={!name.trim()} aria-label="Hinzufügen">＋<span className="hide-mobile"> Hinzufügen</span></button>
          </form>
          {err && <p className="err">{err}</p>}
          <div className="list m1-players">
            {s.players.map((p, i) => (
              <div className="list-item" key={p.id}>
                <span className="head" style={{ width: '1.6em' }}>{i + 1}.</span>
                <input className="input" value={p.name} maxLength={20} onChange={(e) => update((d) => void (d.players[i].name = e.target.value))} style={{ flex: 1 }} aria-label="Name ändern" />
                <button className="btn sm red" onClick={() => update((d) => void d.players.splice(i, 1))} aria-label={`${p.name} entfernen`}>✕</button>
              </div>
            ))}
            {s.players.length === 0 && <p className="muted">Noch keine Spieler. Mindestens 2 werden gebraucht.</p>}
          </div>
        </div>
        <div className="panel stack">
          <h3>Einstellungen</h3>
          <div className="row between">
            <span>Kronen zum Sieg</span>
            {s.kronenZiel === null ? (
              <button className="btn sm" onClick={() => update((d) => void (d.kronenZiel = 5))}>Ziel einschalten</button>
            ) : (
              <span className="row">
                <Stepper value={s.kronenZiel} min={1} max={30} onChange={(v) => update((d) => void (d.kronenZiel = v))} />
                <button className="btn sm ghost" onClick={() => update((d) => void (d.kronenZiel = null))}>aus</button>
              </span>
            )}
          </div>
          <div className="row between">
            <span>Timer Stadt Land Fluss</span>
            {s.slfTimer === null ? (
              <button className="btn sm" onClick={() => update((d) => void (d.slfTimer = 90))}>Timer einschalten</button>
            ) : (
              <span className="row">
                <Stepper value={s.slfTimer} min={30} max={300} step={15} onChange={(v) => update((d) => void (d.slfTimer = v))} />
                <span className="small">Sek.</span>
                <button className="btn sm ghost" onClick={() => update((d) => void (d.slfTimer = null))}>aus</button>
              </span>
            )}
          </div>
          <div className="grow" />
          <button className="btn red huge" disabled={s.players.filter((p) => p.name.trim()).length < 2} onClick={start}>🎲 Spiel starten</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Startfelder ------------------------------ */

function StartDraw() {
  const { s, update } = useM1();
  const [revealed, setRevealed] = useState(0);
  const allDone = revealed >= s.players.length;
  return (
    <div className="screen">
      <TopBar title="Startfelder werden ausgelost" />
      <div className="grid2">
        {s.players.map((p, i) => (
          <div key={p.id} className={`panel row between ${i === revealed ? 'active' : ''}`} style={{ opacity: i <= revealed ? 1 : 0.4 }}>
            <span className="head" style={{ fontSize: '1.5em' }}>{p.name}</span>
            {i < revealed ? (
              <FieldBadge n={p.start!} size="lg" />
            ) : i === revealed ? (
              <SlotRoller options={FIELD_NUMBERS} final={p.start!} duration={1600} render={(v) => v} onDone={() => setTimeout(() => setRevealed((r) => r + 1), 500)} />
            ) : (
              <span className="field lg">?</span>
            )}
          </div>
        ))}
      </div>
      <div className="row center">
        {!allDone && <button className="btn ghost" onClick={() => setRevealed(s.players.length)}>Überspringen</button>}
        <button className="btn gold big" disabled={!allDone} onClick={() => update((d) => {
          d.crown = drawCrownField(cryptoRng, null, d.players.map((p) => p.start).filter((f): f is number => f !== null));
          d.phase = 'crownDraw';
        })}>👑 Weiter: Krone auslosen</button>
      </div>
    </div>
  );
}

/* --------------------------- Krone ---------------------------------- */

function CrownReveal({ field, onDone }: { field: number; onDone?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="stack center" style={{ alignItems: 'center' }}>
      <CrownSvg className="crown-big" />
      <h2>Die Krone liegt auf Feld …</h2>
      {done ? <FieldBadge n={field} size="xl" /> : <SlotRoller options={FIELD_NUMBERS} final={field} duration={2400} render={(v) => v} onDone={() => { setDone(true); onDone?.(); }} />}
      {done && <Confetti gold duration={2500} />}
    </div>
  );
}

function CrownDraw() {
  const { s, update } = useM1();
  const [done, setDone] = useState(false);
  return (
    <div className="screen">
      <TopBar />
      <div className="panel" style={{ marginTop: 20 }}>
        <CrownReveal field={s.crown!} onDone={() => setDone(true)} />
      </div>
      <div className="row center">
        <button className="btn gold big" disabled={!done} onClick={() => update((d) => void (d.phase = 'overview'))}>Weiter zur Übersicht</button>
      </div>
    </div>
  );
}

/* -------------------------- Übersicht ------------------------------- */

function Overview() {
  const { s, update } = useM1();
  const [assign, setAssign] = useState(false);
  const [newCrown, setNewCrown] = useState<number | null>(null);
  const [askBonus, setAskBonus] = useState(false);
  const [settings, setSettings] = useState(false);
  const sorted = [...s.players].sort((a, b) => b.kronen - a.kronen);
  const giveCrown = (pid: string) => {
    const p = s.players.find((x) => x.id === pid)!;
    const willWin = s.kronenZiel !== null && p.kronen + 1 >= s.kronenZiel;
    update((d) => {
      const dp = d.players.find((x) => x.id === pid)!;
      dp.kronen++;
      if (willWin) {
        d.winner = dp.id;
        d.phase = 'winner';
        return;
      }
      d.crown = drawCrownField(cryptoRng, d.crown);
    });
    setAssign(false);
    if (!willWin) setNewCrown(Date.now());
  };
  const anyBonus = s.players.some((p) => p.bonus > 0);
  return (
    <div className="screen">
      <TopBar title="Übersicht" />
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <div className="panel stack">
          <div className="row between">
            <h3>Spieler</h3>
            {s.kronenZiel !== null && <span className="badge">👑 {s.kronenZiel} Kronen zum Sieg</span>}
          </div>
          <div className="list">
            {sorted.map((p) => (
              <div className="list-item" key={p.id}>
                <span className="head grow" style={{ fontSize: '1.25em' }}>{p.name}</span>
                <span className="row" title="Kronen" style={{ gap: 4 }}>
                  <CrownSvg size="1.6em" /> <b className="head" style={{ fontSize: '1.4em' }}>{p.kronen}</b>
                </span>
                <span className="small muted hide-mobile">Start</span>
                {p.start !== null && <FieldBadge n={p.start} showIcon={false} />}
                <span className={`badge ${p.bonus > 0 ? 'green' : 'gray'}`} title="Bonusfelder für die nächste Runde">+{p.bonus} Bonus</span>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn sm" disabled={!anyBonus} onClick={() => setAskBonus(true)}>✔ Bonusfelder verbraucht</button>
            <button className="btn sm ghost" onClick={() => setSettings(true)}>⚙ Einstellungen</button>
          </div>
        </div>
        <div className="panel stack center" style={{ alignItems: 'center' }}>
          <h3>Die Krone liegt auf</h3>
          <CrownSvg className="crown-big" />
          {s.crown && <FieldBadge n={s.crown} size="xl" />}
          <button className="btn gold big block" onClick={() => setAssign(true)}>👑 Krone zuordnen</button>
          <button className="btn red huge block" onClick={() => update((d) => {
            const g = drawNextGame(d.gameDeck, cryptoRng, d.players.length);
            if (!g) return;
            d.game = { id: g, teams: [], data: null };
            d.phase = 'gameDraw';
          })}>🎁 Nächstes Spiel auslosen</button>
        </div>
      </div>
      {assign && (
        <Modal onClose={() => setAssign(false)}>
          <div className="card stack">
            <h2>Wer hat die Krone bekommen?</h2>
            <div className="grid2">
              {s.players.map((p) => (
                <button key={p.id} className="btn big gold" onClick={() => giveCrown(p.id)}>{p.name}</button>
              ))}
            </div>
            <button className="btn" onClick={() => setAssign(false)}>Abbrechen</button>
          </div>
        </Modal>
      )}
      {newCrown !== null && s.phase === 'overview' && (
        <Modal>
          <div className="panel stack" style={{ alignItems: 'center' }}>
            <h2>Neue Krone!</h2>
            <CrownReveal key={newCrown} field={s.crown!} />
            <button className="btn gold big" onClick={() => setNewCrown(null)}>Weiter</button>
          </div>
        </Modal>
      )}
      {askBonus && <Confirm text="Alle Bonusfelder auf 0 setzen?" yes="Ja, verbraucht" onNo={() => setAskBonus(false)} onYes={() => { update((d) => d.players.forEach((p) => (p.bonus = 0))); setAskBonus(false); }} />}
      {settings && (
        <Modal onClose={() => setSettings(false)}>
          <div className="panel stack">
            <h2>Einstellungen</h2>
            <div className="row between">
              <span>Kronen zum Sieg</span>
              {s.kronenZiel === null ? (
                <button className="btn sm" onClick={() => update((d) => void (d.kronenZiel = 5))}>Ziel einschalten</button>
              ) : (
                <span className="row">
                  <Stepper value={s.kronenZiel} min={1} max={30} onChange={(v) => update((d) => void (d.kronenZiel = v))} />
                  <button className="btn sm ghost" onClick={() => update((d) => void (d.kronenZiel = null))}>abschalten</button>
                </span>
              )}
            </div>
            <div className="row between">
              <span>Timer Stadt Land Fluss</span>
              {s.slfTimer === null ? (
                <button className="btn sm" onClick={() => update((d) => void (d.slfTimer = 90))}>einschalten</button>
              ) : (
                <span className="row">
                  <Stepper value={s.slfTimer} min={30} max={300} step={15} onChange={(v) => update((d) => void (d.slfTimer = v))} />
                  <button className="btn sm ghost" onClick={() => update((d) => void (d.slfTimer = null))}>aus</button>
                </span>
              )}
            </div>
            <button className="btn big" onClick={() => setSettings(false)}>Fertig</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------ Spielauslosung ---------------------------- */

function GameDraw() {
  const { s, update } = useM1();
  const [done, setDone] = useState(false);
  const g = gameById(s.game!.id);
  const names = useMemo(() => GAMES.filter((x) => !x.nurOnline).map((x) => ({ id: x.id, name: x.name })), []);
  return (
    <div className="screen">
      <TopBar />
      <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 10, gap: 18, textAlign: 'center' }}>
        <h2>Das nächste Spiel ist …</h2>
        <GameSlotMachine games={names} final={{ id: g.id, name: g.name }} onDone={() => setDone(true)} />
        {done && (
          <>
            <Confetti duration={2500} />
            <p className="muted">Spiel {g.nr} von 10 · {g.rules.teams.split('(')[0]}</p>
            <div className="row center">
              <RulesButton id={g.id} className="big" />
              <button className="btn red big" onClick={() => update((d) => {
                d.game!.teams = makeTeams(cryptoRng, d.players.map((p) => p.id), g.teamMode, (id) => nameOf(d, id));
                d.phase = 'teams';
              })}>{g.teamMode === 'einzel' ? 'Los geht’s' : '👥 Teams auslosen'}</button>
            </div>
          </>
        )}
      </div>
      <div className="row center">
        <button className="btn ghost sm" onClick={() => update((d) => { d.game = null; d.phase = 'overview'; })}>Zurück zur Übersicht</button>
      </div>
    </div>
  );
}

export function TeamCards({ s, teams, highlight }: { s: M1State; teams: { name: string; members: string[] }[]; highlight?: number }) {
  return (
    <div className="grid2">
      {teams.map((t, i) => (
        <div key={i} className={`card ${highlight === i ? '' : ''}`} style={highlight === i ? { borderColor: '#2e7d32', boxShadow: '0 0 0 4px #66bb6a' } : undefined}>
          <h3>{t.name}</h3>
          <p className="head" style={{ fontSize: '1.3em' }}>{t.members.map((m) => nameOf(s, m)).join(' & ')}</p>
        </div>
      ))}
    </div>
  );
}

function TeamsDraw() {
  const { s, update } = useM1();
  const g = gameById(s.game!.id);
  const [anim, setAnim] = useState(0);
  useEffect(() => setAnim((a) => a + 1), [s.game!.teams]);
  const einzel = g.teamMode === 'einzel';
  return (
    <div className="screen">
      <TopBar title={g.name} />
      <div className="panel stack">
        <div className="row between">
          <h2>{einzel ? 'Jeder für sich' : 'Die Teams'}</h2>
          <RulesButton id={g.id} />
        </div>
        {einzel ? (
          <div className="row">{s.players.map((p) => <span key={p.id} className="chip head">{p.name}</span>)}</div>
        ) : (
          <div key={anim}>
            <TeamShuffle s={s} teams={s.game!.teams} />
          </div>
        )}
      </div>
      <div className="row center">
        {!einzel && (
          <button className="btn big" onClick={() => update((d) => void (d.game!.teams = makeTeams(cryptoRng, d.players.map((p) => p.id), g.teamMode, (id) => nameOf(d, id))))}>🔀 Neu auslosen</button>
        )}
        <button className="btn red big" onClick={() => update((d) => void (d.phase = 'playing'))}>▶ Spiel starten</button>
      </div>
    </div>
  );
}

/** Kurze Misch-Animation der Teamnamen */
function TeamShuffle({ s, teams }: { s: M1State; teams: { name: string; members: string[] }[] }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setT(10);
    const id = setInterval(() => setT((x) => (x >= 10 ? x : x + 1)), 110);
    return () => clearInterval(id);
  }, []);
  if (t >= 10) return <TeamCards s={s} teams={teams} />;
  const all = s.players.map((p) => p.id);
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  let k = 0;
  const fake = teams.map((tm) => ({ name: tm.name, members: tm.members.map(() => shuffled[k++ % shuffled.length]) }));
  return <TeamCards s={s} teams={fake} />;
}

/* ---------------------------- Ergebnis ------------------------------ */

export function finishGame(update: (fn: (s: M1State) => void) => void, result: GameResult) {
  update((d) => {
    const add = computeBonus(result);
    const cur: Record<string, number> = {};
    d.players.forEach((p) => (cur[p.id] = p.bonus));
    const next = addBonus(cur, add);
    d.players.forEach((p) => (p.bonus = next[p.id] ?? p.bonus));
    d.lastBonus = add;
    d.phase = 'result';
  });
}

function Result() {
  const { s, update } = useM1();
  const g = s.game ? gameById(s.game.id) : null;
  const rows = [...s.players].sort((a, b) => (s.lastBonus?.[b.id] ?? 0) - (s.lastBonus?.[a.id] ?? 0));
  return (
    <div className="screen">
      <TopBar title={g ? `${g.name} – Ergebnis` : 'Ergebnis'} />
      <Confetti duration={2500} />
      <div className="panel stack">
        <h2>Bonusfelder für die nächste Runde</h2>
        <p className="muted">Zusätzlich zur gewürfelten Augenzahl vorgehen:</p>
        <div className="list">
          {rows.map((p) => (
            <div className="list-item" key={p.id}>
              <span className="head grow" style={{ fontSize: '1.3em' }}>{p.name}</span>
              <span className="badge green" style={{ fontSize: '1.1em' }}>+{s.lastBonus?.[p.id] ?? 0} aus diesem Spiel</span>
              <span className="badge">insgesamt +{p.bonus}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row center">
        <button className="btn gold big" onClick={() => update((d) => { d.game = null; d.phase = 'overview'; })}>Zur Übersicht</button>
      </div>
    </div>
  );
}

function Winner() {
  const { s, reset } = useM1();
  const w = s.players.find((p) => p.id === s.winner);
  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <Confetti duration={6000} />
      <Confetti duration={6000} gold />
      <CrownSvg className="crown-big" big />
      <h1 className="gold">{w?.name ?? '?'} gewinnt!</h1>
      <p className="head" style={{ fontSize: '1.4em' }}>mit {w?.kronen} Kronen 👑</p>
      <div className="panel list" style={{ minWidth: 'min(100%, 520px)' }}>
        {[...s.players].sort((a, b) => b.kronen - a.kronen).map((p, i) => (
          <div className="list-item" key={p.id}>
            <span className="head">{i + 1}.</span>
            <span className="grow head">{p.name}</span>
            <span>👑 {p.kronen}</span>
          </div>
        ))}
      </div>
      <div className="row center">
        <button className="btn red big" onClick={() => reset(true)}>Neues Spiel mit denselben Spielern</button>
        <button className="btn big" onClick={() => go('/')}>Zum Startscreen</button>
      </div>
    </div>
  );
}

export type { GameId };
