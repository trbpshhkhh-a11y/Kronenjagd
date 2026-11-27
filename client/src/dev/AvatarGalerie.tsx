import { AvatarFace, Figur } from '../components/Avatar';
import { avatarFromId, Avatar } from '@kronen/shared';

const FARBEN = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#f5f5f5', '#6d4c41', '#ec407a'];

/** Entwickler-Ansicht: viele Figuren zum Prüfen */
export default function AvatarGalerie() {
  const list: Avatar[] = Array.from({ length: 30 }, (_, i) => avatarFromId('demo' + i));
  return (
    <div style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 14, background: '#3b2112', minHeight: '100vh' }}>
      {list.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <span style={{ width: 90, height: 90 }}><AvatarFace a={a} color={FARBEN[i % FARBEN.length]} /></span>
          <span style={{ width: 46, height: 63 }}><Figur a={a} color={FARBEN[i % FARBEN.length]} /></span>
        </div>
      ))}
    </div>
  );
}
