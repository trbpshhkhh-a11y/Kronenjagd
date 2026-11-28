"""
Barrikade für „Kronen sammeln“ als 3D-Druckteil (STL).

Ein länglicher, kantiger Felsbrocken mit Stacheln obendrauf. Die Unterseite ist flach,
die Stacheln zeigen nach oben – das Teil druckt ohne Stützmaterial.
Maße (Standard): 25 × 7.5 mm Grundfläche, ca. 11 mm hoch. Ein Feld auf dem gedruckten
Spielbrett (DIN A2) ist etwa 23 mm breit – die Barrikade liegt quer über der Strecke
auf der Linie zwischen zwei Feldern.

Benötigt: pip install manifold3d numpy
Aufruf:   python3 druck/barrikade.py [Ausgabe.stl] [Länge_mm]
"""
import math
import random
import struct
import sys

import numpy as np
from manifold3d import Manifold

OUT = sys.argv[1] if len(sys.argv) > 1 else 'druck/barrikade.stl'
LAENGE = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0
S = LAENGE / 25.0  # alles skaliert mit der Länge

random.seed(7)  # immer derselbe Fels


def fels() -> Manifold:
    """Kantiger Fels: Hülle aus groben, zufällig gedrehten Kugeln (Low-Poly-Look)."""
    teile = []
    # (x, y, z, Radius)
    kugeln = [(-10.0, 0.3, 2.0, 2.7), (-6.2, -0.4, 2.4, 3.4), (-1.8, 0.35, 2.7, 3.7),
              (2.8, -0.3, 2.6, 3.6), (7.0, 0.4, 2.3, 3.2), (10.2, -0.2, 1.9, 2.6)]
    for x, y, z, r in kugeln:
        k = Manifold.sphere(r, random.choice([7, 8, 9]))
        k = k.rotate((random.uniform(0, 90), random.uniform(0, 90), random.uniform(0, 90)))
        k = k.scale((1.0, 0.98, 1.0))
        teile.append(k.translate((x, y, z)))
    body = Manifold.batch_hull(teile)
    # flache Unterseite
    return body ^ Manifold.cube((60, 30, 30)).translate((-30, -15, 0))


def stachel(x: float, y: float, hoehe: float, kipp: float) -> Manifold:
    """Kegel mit leicht abgerundeter Spitze, Fuß steckt im Fels."""
    fuss = 1.75
    c = Manifold.cylinder(hoehe, fuss, 0.32, 24)
    c = c.rotate((kipp, 0, 0))
    return c.translate((x, y, 3.2))


def modell() -> Manifold:
    m = fels()
    # 5 Stacheln in einer Reihe, außen kürzer, leicht nach außen gekippt (max. 10°, druckbar)
    for x, h, k in [(-8.4, 5.6, -8), (-4.2, 6.8, 6), (0.0, 7.6, -4), (4.2, 6.8, 7), (8.4, 5.6, -9)]:
        m = m + stachel(x, 0.0, h, k)
    # kleine Zwischenstacheln seitlich
    for x, y, h, k in [(-6.3, 1.5, 4.2, -14), (-2.1, -1.5, 4.6, 14), (2.1, 1.5, 4.6, -14), (6.3, -1.5, 4.2, 14)]:
        m = m + stachel(x, y, h, k).scale((0.8, 0.8, 1.0)).translate((x * 0.25, y * 0.25, 0))
    m = m ^ Manifold.cube((60, 30, 40)).translate((-30, -15, 0))
    return m.scale((S, S, S))


def stl_schreiben(m: Manifold, pfad: str):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3]
    t = np.asarray(mesh.tri_verts)
    with open(pfad, 'wb') as f:
        f.write(b'Kronen sammeln - Barrikade'.ljust(80, b' '))
        f.write(struct.pack('<I', len(t)))
        for a, b, c in t:
            p0, p1, p2 = v[a], v[b], v[c]
            n = np.cross(p1 - p0, p2 - p0)
            ln = np.linalg.norm(n)
            n = n / ln if ln > 0 else n
            f.write(struct.pack('<12fH', *n, *p0, *p1, *p2, 0))


if __name__ == '__main__':
    m = modell()
    assert m.status().name == 'NoError', m.status()
    bb = m.bounding_box()
    stl_schreiben(m, OUT)
    print(f'{OUT}: {m.num_tri()} Dreiecke, Volumen {m.volume():.0f} mm³, Genus {m.genus()}, '
          f'Größe {bb[3]-bb[0]:.1f} × {bb[4]-bb[1]:.1f} × {bb[5]-bb[2]:.1f} mm')
