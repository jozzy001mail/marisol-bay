// Missions: Mara Voss's chained jobs. Each mission is pickup → dropoff,
// with an optional wanted spike on pickup and a timer on the last job.
// The beacon in the world always points at the current target.
import { MISSIONS } from './config.js';
import { addWanted } from './police.js';

export function createMissionState() {
  return { index: 0, stage: 'idle', // idle | pickup | deliver | escape | done
    timer: 0, target: null, targetLabel: '', completed: 0 };
}
export function currentMissionDef(state) { return MISSIONS[state.index] || null; }
export function missionTitle(state) {
  const def = currentMissionDef(state);
  if (!def) return 'All jobs done — Marisol Bay is yours, Rio.';
  return `${def.id}. ${def.title}`;
}
export function missionObjectiveText(state) {
  const def = currentMissionDef(state);
  if (!def) return 'Free roam. Steal cars, dodge patrols, enjoy the bay.';
  if (state.stage === 'pickup') return `Pick up: ${def.pickup.label} — follow the pink beacon.`;
  if (state.stage === 'deliver') return `Deliver to: ${def.dropoff.label}${state.timer > 0 ? ` — ${Math.ceil(state.timer)}s left!` : ''}`;
  if (state.stage === 'escape') return 'Lose the patrols — stay out of sight until the heat drops.';
  return 'Talk to Mara Voss to start the next job.';
}
export function startMission(G) {
  const def = currentMissionDef(G.missions);
  if (!def) return false;
  G.missions.stage = 'pickup';
  G.missions.target = { x: def.pickup.x, z: def.pickup.z };
  G.missions.targetLabel = def.pickup.label;
  G.missions.timer = 0;
  G.beacon.visible = true;
  G.beacon.position.set(def.pickup.x, 0, def.pickup.z);
  G.hudMessage(`New job — ${def.title}: ${def.brief}`);
  G.audio.chime();
  return true;
}
function moveBeacon(G, x, z) { G.beacon.position.set(x, 0, z); G.beacon.visible = true; }

// Called every step; returns events the main loop turns into cash/messages.
export function updateMissions(G, dt) {
  const m = G.missions, def = currentMissionDef(m);
  if (!def || m.stage === 'idle' || m.stage === 'done') return;
  const pos = G.player.inCar ? G.player.inCar : G.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      G.events.push({ type: 'missionFailed', reason: 'Out of time — the festival banner never arrived.' });
      m.stage = 'idle'; m.target = null; G.beacon.visible = false;
      return;
    }
  }
  const d = Math.hypot(pos.x - m.target.x, pos.z - m.target.z);
  if (d > 6) return;
  if (m.stage === 'pickup') {
    G.audio.chime();
    G.hudMessage(`Picked up at ${def.pickup.label}. Now deliver it.`);
    m.stage = 'deliver';
    m.target = { x: def.dropoff.x, z: def.dropoff.z };
    m.targetLabel = def.dropoff.label;
    moveBeacon(G, def.dropoff.x, def.dropoff.z);
    if (def.wantedOnPickup) { addWanted(G.wanted, def.wantedOnPickup); G.hudMessage('Patrols spotted the pickup! Lose them.'); }
    if (def.timeLimit) m.timer = def.timeLimit;
    if (def.id === 2) { /* getaway: the escape stage begins after delivery */ }
  } else if (m.stage === 'deliver') {
    G.cash += def.reward;
    m.completed += 1;
    G.stats.missionsDone += 1;
    G.audio.missionDone();
    G.hudMessage(`Job complete — ${def.title}: +$${def.reward}.`);
    G.beacon.visible = false;
    if (def.id === 2 && G.wanted.level > 0) {
      m.stage = 'escape'; m.target = null;
      G.hudMessage('Now lose the patrols to finish the getaway.');
    } else {
      m.stage = 'idle'; m.index += 1; m.target = null;
      if (currentMissionDef(m)) G.hudMessage(`Next job ready: ${currentMissionDef(m).title}. Press J or walk to the beacon — it starts automatically when you reach it.`);
    }
    G.save();
  }
}
export function checkEscapeComplete(G) {
  const m = G.missions;
  if (m.stage === 'escape' && G.wanted.level === 0) {
    m.stage = 'idle'; m.index += 1; m.target = null;
    G.hudMessage('Clean getaway. Mara is pleased.');
    G.save();
  }
}
// Auto-start the next mission when the player reaches its pickup without one active.
export function maybeAutoStart(G) {
  const m = G.missions, def = currentMissionDef(m);
  if (!def || m.stage !== 'idle') return;
  // Show a faint beacon at the next pickup so the player can find Mara's jobs.
  G.beacon.visible = true;
  G.beacon.position.set(def.pickup.x, 0, def.pickup.z);
  const pos = G.player.inCar ? G.player.inCar : G.player;
  if (Math.hypot(pos.x - def.pickup.x, pos.z - def.pickup.z) < 8) startMission(G);
}
