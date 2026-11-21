/** Echtzeit-Daten der Minispiele (vom Server) an die Spiel-Komponenten verteilen */
const listeners = new Set<(d: any) => void>();
export const emitRt = (d: any) => listeners.forEach((f) => f(d));
export function subscribeRt(f: (d: any) => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}
