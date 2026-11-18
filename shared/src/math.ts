import { Rng, randInt, shuffle, pick } from './rng';

export interface MathTask {
  text: string;
  solution: number;
  type: MathType;
}
export type MathType = 'lang' | 'add4' | 'mul2' | 'prozent' | 'mul3';

function longSum(rng: Rng): MathTask {
  // 4 Summanden + 1 Subtrahend, z. B. 12 + 34 + 7 + 76 - 19
  for (;;) {
    const a = randInt(rng, 10, 49), b = randInt(rng, 10, 59), c = randInt(rng, 2, 9), d = randInt(rng, 10, 89), e = randInt(rng, 11, 39);
    const nums = shuffle(rng, [a, b, c, d]);
    const sol = nums[0] + nums[1] + nums[2] + nums[3] - e;
    if (sol > 0) return { type: 'lang', text: `${nums.join(' + ')} − ${e}`, solution: sol };
  }
}
function add4(rng: Rng): MathTask {
  const nums = shuffle(rng, [randInt(rng, 11, 59), randInt(rng, 21, 89), randInt(rng, 11, 49), randInt(rng, 3, 9)]);
  return { type: 'add4', text: nums.join(' + '), solution: nums.reduce((s, x) => s + x, 0) };
}
function mul2(rng: Rng): MathTask {
  const a = randInt(rng, 11, 19), b = randInt(rng, 11, 19);
  return { type: 'mul2', text: `${a} × ${b}`, solution: a * b };
}
function prozent(rng: Rng): MathTask {
  for (;;) {
    const p = pick(rng, [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]);
    const base = pick(rng, [20, 40, 60, 80, 120, 140, 160, 180, 200, 240, 300, 360, 400]);
    const sol = (p * base) / 100;
    if (Number.isInteger(sol)) return { type: 'prozent', text: `${p} % von ${base}`, solution: sol };
  }
}
function mul3(rng: Rng): MathTask {
  const a = randInt(rng, 3, 9), b = randInt(rng, 3, 9), c = randInt(rng, 2, 9);
  return { type: 'mul3', text: `${a} × ${b} × ${c}`, solution: a * b * c };
}

const GENERATORS: Record<MathType, (r: Rng) => MathTask> = { lang: longSum, add4, mul2, prozent, mul3 };

/** 5 Aufgaben, je Typ eine, in zufälliger Reihenfolge. */
export function mathRound(rng: Rng): MathTask[] {
  return shuffle(rng, Object.keys(GENERATORS) as MathType[]).map((t) => GENERATORS[t](rng));
}
