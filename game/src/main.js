// Marisol Bay — boot, main loop, camera, combat, particles, save/load.
// The game is plain static files: three.js is vendored, everything else is
// written here and in the sibling modules. No network requests at runtime.
import * as THREE from 'three';
import { STEP, SAVE_KEY, CAR_DEFS, MISSIONS, CITY, BUST_PENALTY } from './config.js';
import { createRandom, range, pick } from './random.js';
import { buildCity, resolveCircle } from './world.js';
import { createPlayerState, updateOnFoot } from './player.js';
import { spawnCar, driveCar, syncCarMesh, carDisplayName } from './vehicles.js';
import { spawnTraffic, updateTraffic, spawnPedestrians, updatePedestrians, nearestPed } from './traffic.js';
import { createWanted, addWanted, updatePolice } from './police.js';
import { createMissionState, updateMissions, maybeAutoStart, checkEscapeComplete, startMission } from './missions.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { drawMinimap } from './minimap.js';
import { updateHud, showMessage, tickMessage, showScreen } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

function readSave() {
  try { const s = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null'); return s && typeof s === 'object' ? s : null; }
  catch { return null; }
}

export function createGame() {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const scene = city.scene;
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  document.getElementById('app').appendChild(renderer.domElement);

  const audio = createAudio();
  const player = createPlayerState(scene);
  player.x = 0; player.z = -30; player.mesh.position.set(0, 0, -30);

  // Parked cars on the streets, each a distinct named model.
  const parked = [];
  const parkSpots = [
    { def: 0, x: -18, z: 22 }, { def: 1, x: 22, z: -18 }, { def: 2, x: -62, z: 20 },
    { def: 3, x: 62, z: 60 }, { def: 4, x: -20, z: -62 }, { def: 5, x: 102, z: -20 },
    { def: 0, x: 18, z: 102 }, { def: 2, x: -102, z: -62 }, { def: 1, x: 58, z: -102 },
    { def: 4, x: -58, z: -102 },
  ];
  for (const s of parkSpots) {
    const heading = (Math.abs(s.x) % 40 < 20 ? 0 : Math.PI / 2) + (rng() < 0.5 ? 0 : Math.PI);
    parked.push(spawnCar(CAR_DEFS[s.def], s.x, s.z, heading, false, scene));
  }
  const traffic = spawnTraffic(scene, rng, 8);
  const peds = spawnPedestrians(scene, rng, 14);
  const allCars = [...parked, ...traffic];

  // Particles: a small reusable pool of glowing boxes.
  const particles = [];
  const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false; scene.add(m);
    particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }
  function spawnBurst(x, y, z, color, n, speed) {
    let made = 0;
    for (const p of particles) {
      if (made >= n) break;
      if (p.life > 0) continue;
      p.life = p.max = range(rng, 0.4, 0.9);
      p.mesh.visible = true; p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      const a = rng() * Math.PI * 2;
      p.vx = Math.cos(a) * range(rng, 1, speed); p.vz = Math.sin(a) * range(rng, 1, speed); p.vy = range(rng, 2, 5);
      made++;
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
      p.vy -= 9 * dt; p.mesh.material.opacity = p.life / p.max;
    }
  }
  // Gun tracer: one line reused for every shot.
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(tracer);
  let tracerTimer = 0;

  const G = {
    scene, camera, renderer, rng, time: 0, clockMinutes: 9 * 60,
    colliders: city.colliders, buildings: city.buildings, beacon: city.beacon,
    player, parked, traffic, police: [], peds, allCars,
    wanted: createWanted(), missions: createMissionState(),
    cash: 100, stats: { missionsDone: 0, carsStolen: 0, bestCash: 100 },
    events: [], audio, particles, spawnBurst,
    screen: 'start', saveExists: !!readSave(), messageTimer: 0,
    camPos: new THREE.Vector3(0, 6, -42), camLook: new THREE.Vector3(0, 1, -30),
    camYawOffset: 0, orbitAngle: 0, shotMode: !!shotName,
    hudEls: null, paused: false,
    hudMessage(text) { showMessage(G, text); },
    save() {
      G.stats.bestCash = Math.max(G.stats.bestCash, G.cash);
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: G.cash, missionsCompleted: G.missions.completed, missionIndex: G.missions.index,
          bestCash: G.stats.bestCash, carsStolen: G.stats.carsStolen,
        }));
      } catch {}
      G.saveExists = true;
    },
    loadSave() {
      const s = readSave(); if (!s) return false;
      G.cash = s.cash || 0; G.missions.completed = s.missionsCompleted || 0;
      G.missions.index = s.missionIndex || 0; G.stats.bestCash = s.bestCash || G.cash;
      G.stats.carsStolen = s.carsStolen || 0; G.stats.missionsDone = G.missions.completed;
      return true;
    },
  };
  G.hudEls = {
    hud: document.getElementById('hud'), cash: document.getElementById('cash'),
    health: document.getElementById('health'), stars: document.getElementById('stars'),
    speed: document.getElementById('speed'), clock: document.getElementById('clock'),
    car: document.getElementById('car'), carHealth: document.getElementById('car-health'),
    objective: document.getElementById('objective'), missionList: document.getElementById('mission-list'),
    stats: document.getElementById('stats'), message: document.getElementById('message'),
    minimap: document.getElementById('minimap'),
    startScreen: document.getElementById('start-screen'), pauseScreen: document.getElementById('pause-screen'),
    bustedScreen: document.getElementById('busted-screen'),
    continueBtn: document.getElementById('continue-btn'),
    bustedText: document.getElementById('busted-text'),
  };

  function nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of G.allCars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function enterCar(car) {
    if (!car) return;
    G.player.inCar = car; car.isPlayerCar = true;
    if (car.isTraffic) { car.isTraffic = false; G.traffic = G.traffic.filter((t) => t !== car); }
    G.player.mesh.visible = false;
    G.stats.carsStolen += 1;
    addWanted(G.wanted, car.isPolice ? 2 : 1);
    G.hudMessage(`Took the ${carDisplayName(car)} — the patrols noticed! (+1★)`);
    audio.chime();
  }
  function exitCar() {
    const car = G.player.inCar; if (!car) return;
    car.speed = 0;
    G.player.inCar = null; car.isPlayerCar = false;
    G.player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.5;
    G.player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.5;
    G.player.camYaw = car.heading + Math.PI;
    G.player.mesh.visible = true;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
  }
  function shoot() {
    if (G.player.inCar) return; // no drive-by shooting in this build
    audio.gunshot();
    const origin = new THREE.Vector3(G.player.x, 1.5, G.player.z);
    const dir = new THREE.Vector3(-Math.sin(G.player.camYaw), -0.05, -Math.cos(G.player.camYaw)).normalize();
    const end = origin.clone().add(dir.clone().multiplyScalar(45));
    tracerGeo.setFromPoints([origin, end]);
    tracer.material.opacity = 1; tracerTimer = 0.08;
    // Nearest pedestrian roughly in the line of fire.
    let hitPed = null, bestScore = 0.12;
    for (const p of G.peds) {
      if (!p.alive) continue;
      const dx = p.x - origin.x, dz = p.z - origin.z, d = Math.hypot(dx, dz);
      if (d > 45 || d < 0.5) continue;
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot > bestScore) { bestScore = dot; hitPed = p; }
    }
    if (hitPed) {
      hitPed.alive = false;
      hitPed.mesh.rotation.x = -Math.PI / 2; hitPed.mesh.position.y = 0.3;
      spawnBurst(hitPed.x, 1.2, hitPed.z, 0xff2020, 8, 4);
      addWanted(G.wanted, 1);
      G.hudMessage('You hit a bystander — the patrols are coming! (+1★)');
    } else {
      // Hit a police car in the line of fire?
      for (const c of G.police) {
        const dx = c.x - origin.x, dz = c.z - origin.z, d = Math.hypot(dx, dz);
        if (d < 45 && (dx * dir.x + dz * dir.z) / d > 0.92) {
          c.health -= 25; spawnBurst(c.x, 1, c.z, 0xffc93c, 8, 4);
          addWanted(G.wanted, 1);
          G.hudMessage('You shot at a patrol car! (+1★)');
          break;
        }
      }
    }
    // Punch feedback when a pedestrian is right in front (no ammo needed up close).
    const near = nearestPed(G.peds, G.player.x, G.player.z, 2.2);
    if (near && !hitPed) { G.player.punchTimer = 0.3; audio.punch(); }
  }
  function handleBusted() {
    const fine = Math.min(G.cash, BUST_PENALTY);
    G.cash -= fine;
    G.wanted.level = 0; G.wanted.unseenTimer = 0; G.wanted.bustedTimer = 0;
    for (const c of G.police) G.scene.remove(c.mesh);
    G.police.length = 0;
    if (G.player.inCar) { G.player.inCar.speed = 0; G.player.inCar = null; }
    G.player.health = 60;
    G.player.x = 0; G.player.z = -30; G.player.mesh.visible = true;
    G.player.mesh.position.set(0, 0, -30);
    audio.busted(); audio.setSiren(false);
    G.hudEls.bustedText.textContent = `Busted! Mara's lawyer got you out, but the fine was $${fine}. The patrols have forgotten you — for now.`;
    G.screen = 'busted'; showScreen(G, 'busted');
    G.save();
  }
  function handleCarWrecked() {
    const car = G.player.inCar;
    if (car) { spawnBurst(car.x, 1, car.z, 0x888888, 16, 6); car.dead = true; car.speed = 0; }
    exitCar();
    G.player.health -= 20;
    audio.crash();
    G.hudMessage('Your car is wrecked! You bailed out — find another ride.');
    if (G.player.health <= 0) handleBusted();
  }

  // One fixed simulation step. ctrl: {fwd, strafe, run, brake, mouseDX, mouseDY, click, enter}
  G.step = function step(dt, ctrl) {
    G.time += dt;
    G.clockMinutes += dt * 0.35;
    if (G.clockMinutes >= 24 * 60) G.clockMinutes -= 24 * 60;
    const p = G.player;
    p.camYaw -= (ctrl.mouseDX || 0) * 0.0028;
    p.camPitch = Math.max(-0.9, Math.min(0.5, p.camPitch - (ctrl.mouseDY || 0) * 0.0022));
    if (ctrl.enter) { if (p.inCar) exitCar(); else { const c = nearestCar(p.x, p.z, 4.5); if (c) enterCar(c); } }
    if (ctrl.click) shoot();
    if (p.inCar) {
      const car = p.inCar;
      const res = driveCar(car, ctrl.fwd || 0, ctrl.strafe || 0, !!ctrl.brake, dt, G.colliders, G.allCars);
      if (res.crashed && Math.abs(car.speed) > 5) audio.crash();
      if (car.health <= 0 && !car.dead) { G.events.push({ type: 'carWrecked' }); }
      // Running over a pedestrian while driving.
      const hitPed = nearestPed(G.peds, car.x, car.z, 2.4);
      if (hitPed && Math.abs(car.speed) > 3) {
        hitPed.alive = false; hitPed.mesh.rotation.x = -Math.PI / 2; hitPed.mesh.position.y = 0.3;
        spawnBurst(hitPed.x, 1, hitPed.z, 0xff2020, 8, 4);
        addWanted(G.wanted, 1); audio.crash();
        G.hudMessage('You hit a pedestrian! (+1★)');
      }
      syncCarMesh(car);
      // Damage smoke.
      if (car.health < 45 && rng() < dt * 6) spawnBurst(car.x, 1.2, car.z, 0x666666, 1, 1.5);
      audio.setEngine(Math.abs(car.speed) / car.def.topSpeed, true);
    } else {
      updateOnFoot(p, ctrl.fwd || 0, ctrl.strafe || 0, !!ctrl.run, dt, G.colliders, G.allCars);
      audio.setEngine(0, false);
    }
    updateTraffic(G.traffic, dt, rng, G.colliders);
    for (const c of G.traffic) syncCarMesh(c);
    for (const c of G.parked) syncCarMesh(c);
    updatePedestrians(G.peds, dt, rng, p.inCar || p);
    updatePolice(G, dt, rng);
    updateMissions(G, dt);
    maybeAutoStart(G);
    checkEscapeComplete(G);
    updateParticles(dt);
    if (tracerTimer > 0) { tracerTimer -= dt; if (tracerTimer <= 0) tracer.material.opacity = 0; }
    // Health regen when calm.
    if (G.wanted.level === 0 && p.health < 100) p.health = Math.min(100, p.health + 1.5 * dt);
    audio.setSiren(G.police.length > 0);
    // Drain events.
    for (const ev of G.events) {
      if (ev.type === 'busted') handleBusted();
      else if (ev.type === 'carWrecked') handleCarWrecked();
      else if (ev.type === 'missionFailed') { G.hudMessage(ev.reason); audio.busted(); }
    }
    G.events.length = 0;
    if (G.screen === 'play') { updateHud(G); tickMessage(G, dt); drawMinimap(G.hudEls.minimap, G); }
  };

  G.render = function render() {
    // Smooth third-person camera.
    const p = G.player;
    const focus = p.inCar ? p.inCar : p;
    const focusHeading = p.inCar ? p.inCar.heading : p.camYaw;
    if (G.shotMode && G.orbit) {
      const a = G.orbitAngle;
      G.camPos.set(Math.sin(a) * 55, 26, Math.cos(a) * 55 - 10);
      G.camLook.set(0, 2, 0);
    } else {
      const yaw = p.inCar ? focusHeading + Math.PI + G.camYawOffset : p.camYaw;
      // Camera sits behind the focus point, looking forward.
      const backX = Math.sin(yaw) * 9, backZ = Math.cos(yaw) * 9;
      const want = new THREE.Vector3(focus.x + backX, 4.2 + p.camPitch * -4, focus.z + backZ);
      // In screenshot mode the camera must already be in place on the first
      // painted frame, so snap instead of smoothing toward the target.
      const k = G.shotMode ? 1 : 0.12;
      G.camPos.lerp(want, k);
      G.camLook.lerp(new THREE.Vector3(focus.x, 1.6, focus.z), G.shotMode ? 1 : 0.2);
      // Keep the camera out of buildings is skipped: city is open enough.
    }
    camera.position.copy(G.camPos);
    camera.lookAt(G.camLook);
    renderer.render(scene, camera);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return G;
}

function bindUi(G, input) {
  const startBtn = document.getElementById('start-btn');
  const continueBtn = document.getElementById('continue-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const restartBtn = document.getElementById('restart-btn');
  const bustedBtn = document.getElementById('busted-btn');
  const muteBtn = document.getElementById('mute-btn');
  function startPlaying(fromSave) {
    if (fromSave) G.loadSave();
    G.audio.unlock();
    G.screen = 'play'; showScreen(G, 'play');
    input.lockPointer();
    G.hudMessage(fromSave ? 'Welcome back to Marisol Bay, Rio.' : 'Welcome to Marisol Bay, Rio. Mara Voss is waiting — follow the pink beacon.');
    if (!fromSave) startMission(G);
  }
  startBtn.addEventListener('click', () => startPlaying(false));
  continueBtn.addEventListener('click', () => startPlaying(true));
  resumeBtn.addEventListener('click', () => { G.screen = 'play'; showScreen(G, 'play'); input.lockPointer(); });
  restartBtn.addEventListener('click', () => { G.screen = 'start'; showScreen(G, 'start'); input.unlockPointer(); });
  bustedBtn.addEventListener('click', () => { G.screen = 'play'; showScreen(G, 'play'); input.lockPointer(); });
  muteBtn.addEventListener('click', () => {
    const m = !G.audio.isMuted(); G.audio.setMuted(m);
    muteBtn.textContent = m ? '🔇 Sound: Off' : '🔊 Sound: On';
  });
  input.setActionHandler((action) => {
    if (action === 'mute') { const m = !G.audio.isMuted(); G.audio.setMuted(m); muteBtn.textContent = m ? '🔇 Sound: Off' : '🔊 Sound: On'; }
    if (action === 'pause') {
      if (G.screen === 'play') { G.screen = 'pause'; showScreen(G, 'pause'); input.unlockPointer(); }
      else if (G.screen === 'pause') { G.screen = 'play'; showScreen(G, 'play'); input.lockPointer(); }
    }
    if (action === 'confirm' && G.screen === 'start') startPlaying(false);
    if (action === 'enter') G.pendingEnter = true;
  });
  document.getElementById('app').addEventListener('click', () => {
    if (G.screen === 'play') input.lockPointer();
  });
}

function runGame(G) {
  const input = createInput(G.renderer.domElement);
  bindUi(G, input);
  showScreen(G, 'start');
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25); last = now;
    if (G.screen !== 'play') { G.render(); return; }
    acc += dt;
    const mouse = input.takeMouse();
    const ctrl = {
      fwd: input.forward(), strafe: input.strafe(), run: input.run(), brake: input.brake(),
      mouseDX: mouse.dx, mouseDY: mouse.dy, click: input.takeClick(),
      enter: !!G.pendingEnter,
    };
    G.pendingEnter = false;
    let n = 0;
    while (acc >= STEP && n < 5) { G.step(STEP, ctrl); ctrl.mouseDX = 0; ctrl.mouseDY = 0; ctrl.click = false; ctrl.enter = false; acc -= STEP; n++; }
    if (n === 5) acc = 0;
    G.render();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') { G.screen = 'pause'; showScreen(G, 'pause'); input.unlockPointer(); }
  });
  requestAnimationFrame(frame);
}

function runShot(G, name) {
  const input = createInput(G.renderer.domElement);
  bindUi(G, input);
  const scene = stageShot(G, name);
  G.screen = scene.screen;
  showScreen(G, scene.screen);
  let painted = 0;
  function paint() {
    G.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

const G = createGame();
if (shotName) runShot(G, shotName);
else runGame(G);
