import { useState } from 'react';
import { gameById, GameId } from '@kronen/shared';
import { Modal } from './ui';

export function RulesContent({ id, mode2 }: { id: GameId; mode2?: boolean }) {
  const g = gameById(id);
  return (
    <div className="card stack">
      <h2>Regeln: {g.name}</h2>
      {!mode2 && (
        <p>
          <b>Utensilien:</b> {g.rules.utensilien}
        </p>
      )}
      <p>
        <b>Teams:</b> {g.rules.teams}
      </p>
      <div>
        <b>Ablauf:</b>
        <ul style={{ margin: '0.3em 0', paddingLeft: '1.2em', lineHeight: 1.45 }}>
          {g.rules.ablauf.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>
      {mode2 && (
        <p>
          <b>In der App:</b> {g.app.join(' ')}
        </p>
      )}
      <p>
        <b>Gewinn:</b> {g.rules.gewinn}
      </p>
    </div>
  );
}

export function RulesButton({ id, mode2, className = '' }: { id: GameId; mode2?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn blue ${className}`} onClick={() => setOpen(true)}>📜 Regeln</button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <RulesContent id={id} mode2={mode2} />
          <div className="row center" style={{ marginTop: 16 }}>
            <button className="btn big" onClick={() => setOpen(false)}>Schließen</button>
          </div>
        </Modal>
      )}
    </>
  );
}
