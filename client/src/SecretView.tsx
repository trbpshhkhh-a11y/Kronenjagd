import { useState } from 'react';
import { decodeSecret } from './lib/secret';
import { SecretContent } from './mode1/games/common';
import { useWakeLock } from './lib/hooks';

/** Geheimansicht auf dem eigenen Handy (Inhalt steckt in der URL) */
export function SecretView({ d }: { d: string }) {
  const p = decodeSecret(d);
  const [shown, setShown] = useState(false);
  useWakeLock(true);
  if (!p) return <div className="screen center"><h2>Dieser Link ist ungültig.</h2></div>;
  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <h2 className="gold center">🤫 {p.titel}</h2>
      <p className="center small">Nur für dich! Halte dein Handy so, dass niemand mitschaut.</p>
      {shown ? (
        <div className="card center"><SecretContent p={p} /></div>
      ) : (
        <button className="btn red huge" onClick={() => setShown(true)}>Aufdecken</button>
      )}
      {shown && <button className="btn ghost" onClick={() => setShown(false)}>Verdecken</button>}
    </div>
  );
}
