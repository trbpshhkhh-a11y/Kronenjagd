import { Rng, shuffle } from './rng';
import { TeamMode } from './games';

export interface Team<P = string> {
  name: string;
  members: P[];
}

export const TEAM_NAMES = ['Team Tanne', 'Team Stern', 'Team Lebkuchen', 'Team Schneemann', 'Team Glocke'];

/**
 * Teams auslosen.
 * - einzel: jeder ein eigenes "Team"
 * - zweier: Zweier-Teams, bei ungerader Zahl genau ein Dreierteam
 * - zweiTeams: zwei möglichst gleich große Teams
 */
export function makeTeams<P>(rng: Rng, players: readonly P[], mode: TeamMode, label: (p: P) => string = String): Team<P>[] {
  const s = shuffle(rng, players);
  if (mode === 'einzel') return s.map((p) => ({ name: label(p), members: [p] }));
  if (mode === 'zweiTeams') {
    const half = Math.ceil(s.length / 2);
    return [
      { name: TEAM_NAMES[0], members: s.slice(0, half) },
      { name: TEAM_NAMES[1], members: s.slice(half) },
    ].filter((t) => t.members.length > 0);
  }
  const teams: Team<P>[] = [];
  const pairs = Math.floor(s.length / 2);
  for (let i = 0; i < pairs; i++) teams.push({ name: TEAM_NAMES[i % TEAM_NAMES.length] + (i >= TEAM_NAMES.length ? ' ' + (i + 1) : ''), members: s.slice(i * 2, i * 2 + 2) });
  if (s.length % 2 === 1) {
    if (teams.length === 0) teams.push({ name: TEAM_NAMES[0], members: [s[0]] });
    else teams[teams.length - 1].members.push(s[s.length - 1]);
  }
  return teams;
}

/**
 * Wie makeTeams, verteilt aber zuerst die Menschen gleichmäßig auf die Teams
 * (damit möglichst jedes Team mindestens einen Menschen hat) und füllt dann mit Bots auf.
 */
export function makeTeamsHumansFirst<P>(rng: Rng, players: readonly P[], mode: TeamMode, isHuman: (p: P) => boolean, label: (p: P) => string = String): Team<P>[] {
  const shape = makeTeams(rng, players, mode, label);
  if (mode === 'einzel') return shape;
  const humans = shuffle(rng, players.filter(isHuman));
  const bots = shuffle(rng, players.filter((p) => !isHuman(p)));
  const sizes = shape.map((t) => t.members.length);
  const teams: Team<P>[] = shape.map((t) => ({ name: t.name, members: [] }));
  let ti = 0;
  for (const h of humans) {
    // reihum auf Teams mit freiem Platz
    for (let k = 0; k < teams.length; k++) {
      const idx = (ti + k) % teams.length;
      if (teams[idx].members.length < sizes[idx]) {
        teams[idx].members.push(h);
        ti = idx + 1;
        break;
      }
    }
  }
  for (const b of bots) {
    const idx = teams.findIndex((t, i) => t.members.length < sizes[i]);
    teams[idx].members.push(b);
  }
  return teams;
}
