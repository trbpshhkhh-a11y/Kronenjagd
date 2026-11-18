import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR-Code lokal erzeugt (kein Online-Dienst) */
export function QR({ text, size = 240 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b1a10', light: '#fff6e3' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [text]);
  return <div style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', border: '6px solid #fff6e3', background: '#fff6e3' }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
