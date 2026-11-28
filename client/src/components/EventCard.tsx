import { useEffect, useState } from 'react';
import { CARD_TEXT, CardId } from '@kronen/shared';
import { CrownSvg, CircleArrowsSvg } from './icons';
import { FieldBadge } from './ui';

/** Rückseite einer Ereigniskarte – wie die ?!-Karte in der Mitte des Spielbretts */
function CardBack({ feld }: { feld?: boolean }) {
  return (
    <div className={`ev-face ev-back ${feld ? 'feld' : ''}`}>
      <span className="ev-star s1">★</span>
      <span className="ev-star s2">★</span>
      <span className="ev-star s3">★</span>
      <span className="ev-star s4">★</span>
      {feld ? <CircleArrowsSvg size="55%" /> : <span className="ev-qm">?!</span>}
    </div>
  );
}

function CardFront({ card, feld, ziel, info }: { card: CardId; feld?: boolean; ziel?: number; info?: string }) {
  const c = CARD_TEXT[card];
  const titel = feld ? 'Gelbes Feld' : c.titel;
  const text = feld ? 'Du darfst die Position mit einem Mitspieler tauschen – musst aber nicht.' : c.text;
  return (
    <div className={`ev-face ev-front ${feld ? 'feld' : ''}`}>
      <span className="ev-corner tl">?!</span>
      <span className="ev-corner br">?!</span>
      <div className="ev-title">{titel}</div>
      <div className="ev-icon">
        {card === 'sprung' && ziel ? <FieldBadge n={ziel} size="lg" showIcon={false} /> : null}
        {card === 'krone' && <CrownSvg size="70%" />}
        {card === 'kronenNeu' && (
          <span style={{ display: 'flex', gap: '0.3em', width: '80%' }}>
            <CrownSvg size="50%" />
            <CrownSvg size="50%" big />
          </span>
        )}
        {card === 'tausch' && <span className="ev-emoji">🔄</span>}
        {card === 'spielWahl' && <span className="ev-emoji">🎮</span>}
        {card === 'zweiVor' && <span className="ev-plus2">+2</span>}
      </div>
      <div className="ev-text">
        {text}
        {card === 'sprung' && ziel ? ` ${ziel}!` : ''}
        {info ? <div className="ev-info">↔ {info}</div> : null}
      </div>
    </div>
  );
}

/**
 * Ereigniskarte mit Kartenanimation: Die oberste Karte wird vom Stapel gezogen,
 * fliegt in die Mitte, wird größer und dreht sich um.
 */
export function EventCardScene({
  card, feld, ziel, info, width = 340, drawing, onDeckClick, deckHint,
}: {
  card: CardId | null;
  feld?: boolean;
  ziel?: number;
  info?: string;
  width?: number;
  /** Stapel anzeigen und auf das Ziehen warten */
  drawing?: boolean;
  onDeckClick?: () => void;
  deckHint?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!card) return setFlipped(false);
    const t = setTimeout(() => setFlipped(true), feld ? 500 : 1100);
    return () => clearTimeout(t);
  }, [card, feld]);
  const style = { ['--w' as string]: `${width}px` } as React.CSSProperties;
  return (
    <div className={`ev-scene ${feld ? 'feld' : ''}`} style={style}>
      {!feld && (
        <button className={`ev-deck ${drawing ? 'waiting' : ''}`} onClick={onDeckClick} disabled={!onDeckClick} aria-label="Karte ziehen">
          {[3, 2, 1].map((i) => (
            <div key={i} className="ev-card ev-stacked" style={{ transform: `translate(${i * 4}px, ${i * -4}px) rotate(${(i - 2) * 2}deg)` }}>
              <CardBack />
            </div>
          ))}
          {drawing && (
            <div className="ev-card ev-top">
              <CardBack />
            </div>
          )}
          {deckHint && <span className="ev-hint">{deckHint}</span>}
        </button>
      )}
      {card && (
        <div className={`ev-drawn ${feld ? 'pop' : ''}`} key={card + (ziel ?? '')}>
          <div className="ev-glow" />
          <div className={`ev-card ev-inner ${flipped ? 'flipped' : ''}`}>
            <CardBack feld={feld} />
            <CardFront card={card} feld={feld} ziel={ziel} info={info} />
          </div>
          {flipped && (
            <div className="ev-sparkles" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ ['--a' as string]: `${i * 36}deg`, animationDelay: `${(i % 3) * 0.08}s` }}>✦</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
