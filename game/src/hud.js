// HUD: cash, health, wanted stars, speed, clock, objective, mission list,
// messages, and the start / pause screens. All DOM, no canvas text.
import { MISSIONS } from './config.js';
import { missionTitle, missionObjectiveText, currentMissionDef } from './missions.js';

export function createHud(els) { return { els }; }

function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function clockText(minutes) {
  const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function updateHud(G) {
  const e = G.hudEls;
  e.cash.textContent = `$${G.cash.toLocaleString()}`;
  e.health.textContent = `♥ ${Math.max(0, Math.round(G.player.health))}`;
  e.health.style.color = G.player.health < 30 ? '#ff5a5a' : '#ffffff';
  e.stars.textContent = stars(G.wanted.level);
  e.stars.style.color = G.wanted.level > 0 ? '#ffd23c' : '#ffffff';
  const speed = G.player.inCar ? Math.abs(G.player.inCar.speed) * 3.6 : Math.abs(G.player.speed) * 3.6;
  e.speed.textContent = `${Math.round(speed)} km/h`;
  e.clock.textContent = clockText(G.clockMinutes);
  e.car.textContent = G.player.inCar ? (G.player.inCar.isPolice ? 'Patrol Car' : G.player.inCar.def.name) : 'On foot';
  e.carHealth.textContent = G.player.inCar ? `Car ♥ ${Math.max(0, Math.round(G.player.inCar.health))}` : '';
  e.objective.textContent = missionObjectiveText(G.missions);
  // Mission list with checkmarks.
  let html = '';
  for (const def of MISSIONS) {
    const done = def.id <= G.missions.completed;
    const active = currentMissionDef(G.missions) && def.id === currentMissionDef(G.missions).id && G.missions.stage !== 'idle';
    html += `<div class="mission ${done ? 'done' : ''} ${active ? 'active' : ''}">${done ? '✓' : '○'} ${def.id}. ${def.title} — $${def.reward}</div>`;
  }
  if (G.missions.completed >= MISSIONS.length) html += '<div class="mission done">✓ Story complete!</div>';
  e.missionList.innerHTML = html;
  e.stats.textContent = `Jobs done: ${G.stats.missionsDone} · Cars taken: ${G.stats.carsStolen} · Best cash: $${G.stats.bestCash.toLocaleString()}`;
}
export function showMessage(G, text) {
  const e = G.hudEls.message;
  e.textContent = text; e.style.opacity = '1';
  G.messageTimer = 4;
}
export function tickMessage(G, dt) {
  if (G.messageTimer > 0) {
    G.messageTimer -= dt;
    if (G.messageTimer <= 0) G.hudEls.message.style.opacity = '0';
  }
}
export function showScreen(G, name) {
  // name: 'start' | 'play' | 'pause' | 'busted'
  const e = G.hudEls;
  e.startScreen.style.display = name === 'start' ? 'flex' : 'none';
  e.pauseScreen.style.display = name === 'pause' ? 'flex' : 'none';
  e.bustedScreen.style.display = name === 'busted' ? 'flex' : 'none';
  e.hud.style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
  if (name === 'start') {
    e.continueBtn.style.display = G.saveExists ? 'inline-block' : 'none';
  }
}
