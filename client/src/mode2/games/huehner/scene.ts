/**
 * 3D-Darstellung für Hühnerhüpfer (Three.js, Klötzchen-Look).
 * Wird erst geladen, wenn das Spiel startet (eigene Datei = eigenes Paket).
 * Für flüssige 60 fps auch auf einfachen Handys wird jede Reihe, jedes Fahrzeug und jedes Huhn
 * zu EINEM Körper mit Eckfarben zusammengefasst (wenige Zeichenaufrufe).
 */
import * as THREE from 'three';
import { HuehnerWelt, WorldRow, moverX, train, H_COLS } from '@kronen/shared';

const EXT = 9; // Boden über den Spielbereich hinaus
const FARBE = {
  grasA: 0x86d455, grasB: 0x7bc94b, strasse: 0x51565e, linie: 0xf2f2f2, wasser: 0x45b4f2, gleisBoden: 0x9c8b78, schwelle: 0x5d4037,
  schiene: 0xcfd8dc, stamm: 0x8d5a2b, stammHell: 0xb07a45, seerose: 0x43a047, baumStamm: 0x7b4f2a, krone: 0x2e9d48, krone2: 0x3cb357,
  busch: 0x4caf50, fels: 0x9ea4a8, weiss: 0xffffff, rot: 0xe53935, orange: 0xff9800, schwarz: 0x222222, fenster: 0x9fd3f2, rad: 0x2b2b2b,
  zug: 0xc62828, zug2: 0x37474f, signal: 0xff1744, signalAus: 0x5a1010, rand: 0x000000, lkw: 0xeeeeee,
};
const AUTO = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa, 0xfb8c00, 0x00acc1];

export interface Figur {
  id: string;
  row: number;
  col: number;
  lift: number;
  facing: number;
  /** 0–1: plattgefahren */
  squash: number;
  /** 0–1: im Wasser versunken */
  sink: number;
  alpha: number;
  color: string;
  name?: string;
  ghost: boolean;
}

/** Sammelt Quader/Zylinder und fügt sie zu einem Körper mit Eckfarben zusammen */
class Bau {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private c = new THREE.Color();
  add(geo: THREE.BufferGeometry, color: number | string, x: number, y: number, z: number) {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const base = this.pos.length / 3;
    this.c.set(color as THREE.ColorRepresentation);
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z);
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    const index = geo.getIndex();
    if (index) for (let i = 0; i < index.count; i++) this.idx.push(index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) this.idx.push(i + base);
    return this;
  }
  box(w: number, h: number, d: number, color: number | string, x: number, y: number, z: number) {
    return this.add(boxGeo(w, h, d), color, x, y, z);
  }
  get empty() {
    return this.pos.length === 0;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const boxCache = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = boxCache.get(k);
  if (!g) boxCache.set(k, (g = new THREE.BoxGeometry(w, h, d)));
  return g;
}
const padGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14);

interface RowObj {
  mesh: THREE.Mesh;
  row: WorldRow;
  movers: THREE.Mesh[];
  train?: THREE.Mesh;
  signal?: THREE.Mesh;
}

interface ChickenObj {
  g: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  shadow: THREE.Mesh;
  label?: THREE.Sprite;
  ring: THREE.Mesh;
  key: string;
}

export class HuehnerSzene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private rows = new Map<number, RowObj>();
  private chickens = new Map<string, ChickenObj>();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private camRow = 0;
  private edge: THREE.Group;
  private aspect = 1;
  private target = new THREE.Vector3();
  private signalOn = new THREE.MeshBasicMaterial({ color: FARBE.signal });
  private signalOff = new THREE.MeshBasicMaterial({ color: FARBE.signalAus });

  constructor(canvas: HTMLCanvasElement, private welt: HuehnerWelt) {
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.scene.background = new THREE.Color(0x2f6b2a);
    this.camera = new THREE.OrthographicCamera(-6, 6, 8, -8, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa070, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 10, 6);
    this.scene.add(sun);
    // Ränder des Spielfelds abdunkeln
    this.edge = new THREE.Group();
    const em = new THREE.MeshBasicMaterial({ color: FARBE.rand, transparent: true, opacity: 0.36, depthWrite: false });
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(EXT, 80), em);
      m.rotation.x = -Math.PI / 2;
      m.position.set(side < 0 ? -EXT / 2 : H_COLS + EXT / 2, 0.21, 0);
      m.renderOrder = 2;
      this.edge.add(m);
    }
    this.scene.add(this.edge);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.aspect = w / Math.max(1, h);
    // Immer die ganze Breite (9 Spalten + etwas Rand) im Bild
    const W = this.aspect > 1 ? 15 : 12.2;
    const H = W / this.aspect;
    this.camera.left = -W / 2;
    this.camera.right = W / 2;
    this.camera.top = H / 2;
    this.camera.bottom = -H / 2;
    this.camera.updateProjectionMatrix();
  }

  /* --------------------------- Reihen --------------------------- */

  private buildRow(r: number): RowObj {
    const row = this.welt.row(r);
    const b = new Bau();
    const o = { row, movers: [] as THREE.Mesh[] } as unknown as RowObj;
    const width = H_COLS + 2 * EXT;
    const cx = H_COLS / 2;
    if (row.type === 'gras') {
      b.box(width, 0.4, 1, r % 2 ? FARBE.grasA : FARBE.grasB, cx, 0, 0);
      row.deko?.forEach((d, c) => d && this.deko(b, d, c + 0.5, r * 31 + c));
      // außerhalb des Spielfelds: Bäume als Begrenzung
      for (const c of [-1, -2, H_COLS, H_COLS + 1]) if ((r + c) % 2 === 0) this.deko(b, 'baum', c + 0.5, r * 7 + c);
    } else if (row.type === 'strasse') {
      b.box(width, 0.36, 1, FARBE.strasse, cx, -0.02, 0);
      if (this.welt.row(r - 1).type === 'strasse') for (let x = -EXT + 0.5; x < H_COLS + EXT; x += 1.6) b.box(0.8, 0.02, 0.08, FARBE.linie, x, 0.17, 0.5);
      for (const m of row.movers ?? []) o.movers.push(this.mesh(row.kind === 'lkw' ? this.lkw(m.len, m.color, row.dir ?? 1) : this.auto(m.color, row.dir ?? 1), r));
    } else if (row.type === 'fluss') {
      b.box(width, 0.2, 1, FARBE.wasser, cx, -0.2, 0);
      if (row.pads) for (const p of row.pads) b.add(padGeo, FARBE.seerose, p + 0.5, -0.06, 0);
      else
        for (const m of row.movers ?? []) {
          const L = m.len - 0.08;
          const log = new Bau().box(L, 0.28, 0.78, FARBE.stamm, 0, -0.06, 0).box(0.08, 0.24, 0.7, FARBE.stammHell, -L / 2, -0.06, 0).box(0.08, 0.24, 0.7, FARBE.stammHell, L / 2, -0.06, 0);
          o.movers.push(this.mesh(log, r));
        }
    } else {
      b.box(width, 0.36, 1, FARBE.gleisBoden, cx, -0.02, 0);
      for (let x = -EXT + 0.3; x < H_COLS + EXT; x += 0.7) b.box(0.18, 0.06, 0.86, FARBE.schwelle, x, 0.18, 0);
      for (const z of [-0.26, 0.26]) b.box(width, 0.06, 0.07, FARBE.schiene, cx, 0.23, z);
      // Signalmast am Rand
      b.box(0.1, 1.1, 0.1, FARBE.schwarz, -0.55, 0.75, 0.42);
      const tr = new Bau();
      const len = row.trainLen ?? 12;
      const n = 3;
      const part = len / n;
      for (let i = 0; i < n; i++) {
        const front = row.dir === -1 ? i === 0 : i === n - 1;
        tr.box(part - 0.12, 0.85, 0.82, front ? FARBE.zug : i % 2 ? FARBE.zug2 : FARBE.zug, -len / 2 + part * (i + 0.5), 0.62, 0);
        tr.box(part - 0.5, 0.18, 0.84, FARBE.fenster, -len / 2 + part * (i + 0.5), 0.82, 0);
      }
      o.train = this.mesh(tr, r);
      o.train.visible = false;
      const lamp = new THREE.Mesh(boxGeo(0.32, 0.32, 0.18), this.signalOff);
      lamp.position.set(-0.55, 1.35, -r + 0.42);
      this.scene.add(lamp);
      o.signal = lamp;
    }
    o.mesh = this.mesh(b, r);
    return o;
  }

  private mesh(b: Bau, r: number) {
    const m = new THREE.Mesh(b.build(), this.mat);
    m.position.z = -r;
    this.scene.add(m);
    return m;
  }

  private removeRow(o: RowObj) {
    for (const m of [o.mesh, ...o.movers, o.train]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
    }
    if (o.signal) this.scene.remove(o.signal);
  }

  private deko(b: Bau, d: string, x: number, h: number) {
    if (d === 'baum') {
      const tall = h % 3 === 0;
      b.box(0.3, 0.5, 0.3, FARBE.baumStamm, x, 0.4, 0);
      b.box(0.8, tall ? 1.1 : 0.75, 0.8, h % 2 ? FARBE.krone : FARBE.krone2, x, tall ? 1.15 : 0.95, 0);
    } else if (d === 'busch') b.box(0.7, 0.5, 0.7, FARBE.busch, x, 0.42, 0);
    else b.box(0.75, 0.45, 0.7, FARBE.fels, x, 0.4, 0);
  }

  private auto(color: number, dir: number) {
    const c = AUTO[color % AUTO.length];
    const b = new Bau().box(0.94, 0.36, 0.72, c, 0, 0.42, 0).box(0.5, 0.28, 0.64, FARBE.fenster, -0.06 * dir, 0.74, 0).box(0.46, 0.08, 0.66, c, -0.06 * dir, 0.92, 0);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.36, 0.36]) b.box(0.24, 0.24, 0.08, FARBE.rad, sx, 0.26, sz);
    return b;
  }

  private lkw(len: number, color: number, dir: number) {
    const c = AUTO[color % AUTO.length];
    const L = len - 0.12;
    const b = new Bau()
      .box(0.7, 0.7, 0.76, c, (L / 2 - 0.35) * dir, 0.58, 0)
      .box(0.12, 0.3, 0.7, FARBE.fenster, (L / 2 - 0.05) * dir, 0.72, 0)
      .box(L - 0.8, 0.9, 0.8, FARBE.lkw, -0.4 * dir, 0.68, 0);
    for (const sx of [-L / 2 + 0.3, 0, L / 2 - 0.35]) for (const sz of [-0.4, 0.4]) b.box(0.26, 0.26, 0.08, FARBE.rad, sx, 0.26, sz);
    return b;
  }

  /* --------------------------- Hühner --------------------------- */

  private chicken(f: Figur, key: string): ChickenObj {
    const g = new THREE.Group();
    const b = new Bau()
      .box(0.56, 0.46, 0.6, FARBE.weiss, 0, 0.4, 0.04)
      .box(0.42, 0.42, 0.4, FARBE.weiss, 0, 0.82, -0.1)
      .box(0.12, 0.16, 0.26, FARBE.rot, 0, 1.1, -0.1)
      .box(0.16, 0.1, 0.16, FARBE.orange, 0, 0.78, -0.36)
      .box(0.1, 0.12, 0.06, FARBE.rot, 0, 0.66, -0.31)
      .box(0.06, 0.08, 0.08, FARBE.schwarz, -0.22, 0.88, -0.18)
      .box(0.06, 0.08, 0.08, FARBE.schwarz, 0.22, 0.88, -0.18)
      .box(0.3, 0.26, 0.14, FARBE.weiss, 0, 0.5, 0.38)
      .box(0.08, 0.18, 0.08, FARBE.orange, -0.13, 0.09, 0.04)
      .box(0.08, 0.18, 0.08, FARBE.orange, 0.13, 0.09, 0.04)
      // Schal in Spielerfarbe
      .box(0.48, 0.12, 0.46, f.color, 0, 0.64, -0.1)
      .box(0.12, 0.3, 0.08, f.color, 0.16, 0.5, 0.15);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: f.ghost, opacity: f.ghost ? 0.45 : 1 });
    const body = new THREE.Mesh(b.build(), mat);
    g.add(body);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: f.ghost ? 0.12 : 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    g.add(shadow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    let label: THREE.Sprite | undefined;
    if (f.name) {
      label = this.nameSprite(f.name, f.color, f.ghost);
      label.position.y = 1.65;
      g.add(label);
    }
    this.scene.add(g);
    return { g, body, mat, shadow, label, ring, key };
  }

  private dropChicken(c: ChickenObj) {
    this.scene.remove(c.g);
    c.body.geometry.dispose();
    c.mat.dispose();
    c.shadow.geometry.dispose();
    c.ring.geometry.dispose();
    if (c.label) {
      c.label.material.map?.dispose();
      c.label.material.dispose();
    }
  }

  private nameSprite(name: string, color: string, ghost: boolean) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const x = c.getContext('2d')!;
    x.font = 'bold 34px system-ui, sans-serif';
    const w = Math.min(248, x.measureText(name).width + 34);
    x.fillStyle = color;
    x.beginPath();
    if (x.roundRect) x.roundRect((256 - w) / 2, 6, w, 52, 26);
    else x.rect((256 - w) / 2, 6, w, 52);
    x.fill();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 6;
    x.strokeStyle = 'rgba(0,0,0,0.45)';
    x.strokeText(name, 128, 33);
    x.fillText(name, 128, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: ghost ? 0.8 : 1, depthTest: false }));
    s.scale.set(1.9, 0.48, 1);
    s.renderOrder = 5;
    return s;
  }

  /* --------------------------- Zeichnen --------------------------- */

  render(t: number, now: number, focusRow: number, figuren: Figur[]) {
    // Kamera folgt sanft
    this.camRow += (focusRow - this.camRow) * 0.12;
    const back = this.aspect > 1 ? 2.2 : 3.6;
    this.target.set(H_COLS / 2, 0, -this.camRow - back);
    this.camera.position.set(this.target.x + 1.4, 14, this.target.z + 10);
    this.camera.lookAt(this.target);
    this.edge.position.z = this.target.z;

    // sichtbare Reihen bauen/aufräumen
    const lo = Math.floor(this.camRow) - 9;
    const hi = Math.floor(this.camRow) + 19;
    for (const [r, o] of this.rows)
      if (r < lo - 3 || r > hi + 3) {
        this.removeRow(o);
        this.rows.delete(r);
      }
    for (let r = Math.max(-3, lo); r <= hi; r++) {
      let o = this.rows.get(r);
      if (!o) this.rows.set(r, (o = this.buildRow(r)));
      const row = o.row;
      if (row.movers && !row.pads)
        for (let i = 0; i < row.movers.length; i++) {
          const m = row.movers[i];
          o.movers[i].position.x = moverX(row, m, t) + m.len / 2;
        }
      if (o.train) {
        const tr = train(row, t);
        o.train.visible = tr.x !== null;
        if (tr.x !== null) o.train.position.x = tr.x + (row.trainLen ?? 12) / 2;
        if (o.signal) o.signal.material = tr.warn && Math.floor(now / 180) % 2 === 0 ? this.signalOn : this.signalOff;
      }
    }

    // Hühner
    const seen = new Set<string>();
    for (const f of figuren) {
      seen.add(f.id);
      const key = `${f.color}|${f.name ?? ''}|${f.ghost}`;
      let c = this.chickens.get(f.id);
      if (!c || c.key !== key) {
        if (c) this.dropChicken(c);
        this.chickens.set(f.id, (c = this.chicken(f, key)));
      }
      const row = this.welt.row(Math.round(f.row));
      const base = row.type === 'fluss' ? 0.05 : row.type === 'gras' ? 0.2 : 0.17;
      c.g.visible = f.alpha > 0.02;
      c.g.position.set(f.col + 0.5, base, -f.row);
      c.body.position.y = f.lift * 0.55 - f.sink * 0.7;
      c.body.rotation.y = f.facing;
      const sq = f.squash;
      c.body.scale.set(1 + sq * 0.5, 1 - sq * 0.82, 1 + sq * 0.5);
      c.shadow.visible = f.sink < 0.1;
      (c.ring.material as THREE.MeshBasicMaterial).opacity = f.sink > 0 && f.sink < 1 ? 0.8 * (1 - f.sink) : 0;
      c.ring.scale.setScalar(1 + f.sink * 1.6);
      c.mat.transparent = f.ghost || f.alpha < 1;
      c.mat.opacity = (f.ghost ? 0.45 : 1) * f.alpha;
      if (c.label) c.label.material.opacity = Math.min(1, f.alpha) * (f.ghost ? 0.8 : 1);
    }
    for (const [id, c] of this.chickens)
      if (!seen.has(id)) {
        this.dropChicken(c);
        this.chickens.delete(id);
      }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const o of this.rows.values()) this.removeRow(o);
    for (const c of this.chickens.values()) this.dropChicken(c);
    this.rows.clear();
    this.chickens.clear();
    this.mat.dispose();
    this.renderer.dispose();
  }
}
