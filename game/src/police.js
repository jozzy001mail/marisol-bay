// Wanted level (0–5 stars) and the Marisol Bay patrol: police cars spawn at
// the city edge, chase and ram the player, and bust him on foot. Wanted decays
// when the player stays out of sight; getting busted costs cash and health.
import { CAR_DEFS, POLICE_COLOR, WANTED_DECAY_SECONDS, BUST_PENALTY } from './config.js';
import { spawnCar, syncCarMesh, driveCar } from './vehicles.js';
import { nearestStreetCoord } from './world.js';

export function createWanted() {
  return { level: 0, unseenTimer: 0, bustedTimer: 0, flash: 0 };
}
export function addWanted(wanted, n) {
  wanted.level = Math.max(0, Math.min(5, wanted.level + n));
  wanted.unseenTimer = 0;
}
export function wantedCarCount(level) { return Math.min(level, 5); }

export function spawnPoliceCar(scene, rng, x, z, heading) {
  const def = { name: 'Patrol Car', color: POLICE_COLOR, topSpeed: 32, accel: 24, turn: 2.6 };
  const car = spawnCar(def, x, z, heading, true, scene);
  car.ai = { state: 'chase' };
  return car;
}
function spawnPointNear(rng, px, pz) {
  // Spawn on a street 40–60m away, snapped onto the nearest street lines
  // so the unit starts on a road, not inside a building.
  const angle = rng() * Math.PI * 2;
  const x = nearestStreetCoord(Math.max(-120, Math.min(120, px + Math.cos(angle) * 50)));
  const z = nearestStreetCoord(Math.max(-120, Math.min(120, pz + Math.sin(angle) * 50)));
  return { x, z };
}

// Keep the police fleet matched to the wanted level; chase the player.
export function updatePolice(G, dt, rng) {
  const wanted = G.wanted;
  const playerPos = G.player.inCar ? G.player.inCar : G.player;
  const want = wantedCarCount(wanted.level);
  // Spawn missing units.
  while (G.police.length < want) {
    const s = spawnPointNear(rng, playerPos.x, playerPos.z);
    const heading = Math.atan2(playerPos.x - s.x, playerPos.z - s.z);
    G.police.push(spawnPoliceCar(G.scene, rng, s.x, s.z, heading));
  }
  // Despawn extras when wanted falls.
  while (G.police.length > want) {
    const c = G.police.pop(); G.scene.remove(c.mesh);
  }
  let nearest = Infinity;
  for (const car of G.police) {
    const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
    const dist = Math.hypot(dx, dz); nearest = Math.min(nearest, dist);
    // Chase along the street grid like the autopilot does: line up with the
    // player along our current street, then turn onto theirs — cutting
    // diagonally through blocks just wrecks patrol cars on buildings.
    let wx, wz;
    if (Math.abs(dx) > 8) { wx = playerPos.x; wz = nearestStreetCoord(car.z); }
    else { wx = playerPos.x; wz = playerPos.z; }
    const targetHeading = Math.atan2(wx - car.x, wz - car.z);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.5));
    // Same rule as the autopilot: only slow for a sharp turn once moving,
    // because a stopped car cannot steer at all.
    const slowTurn = Math.abs(dh) > 0.9 && Math.abs(car.speed) > 8;
    const fwd = dist > 4 ? (slowTurn ? 0 : 1) : 0.3;
    const res = driveCar(car, fwd, steer, slowTurn, dt, G.colliders, G.allCars);
    if (res.crashed && Math.abs(car.speed) > 6) G.audio.crash();
    syncCarMesh(car);
    // Flash the light bar.
    const t = G.time * 6;
    if (car.mesh.userData.lightRed) car.mesh.userData.lightRed.material.color.setHex(Math.sin(t) > 0 ? 0xff2020 : 0x550000);
    if (car.mesh.userData.lightBlue) car.mesh.userData.lightBlue.material.color.setHex(Math.sin(t) > 0 ? 0x220066 : 0x2040ff);
    // Ram the player's car; touch the player on foot to bust him.
    if (dist < 3.2) {
      if (G.player.inCar) {
        const pc = G.player.inCar;
        pc.health -= 25 * dt; // ram damage per second while in contact
        if (pc.health <= 0) { pc.health = 0; G.events.push({ type: 'carWrecked' }); }
      } else if (wanted.level >= 2) {
        wanted.bustedTimer += dt;
        if (wanted.bustedTimer > 1.2) G.events.push({ type: 'busted' });
      }
    }
  }
  if (G.police.length === 0) wanted.bustedTimer = 0;
  // Decay: one star per WANTED_DECAY_SECONDS with no police close by.
  if (wanted.level > 0) {
    if (nearest > 45) {
      wanted.unseenTimer += dt;
      if (wanted.unseenTimer >= WANTED_DECAY_SECONDS) {
        wanted.level -= 1; wanted.unseenTimer = 0;
        G.hudMessage(`Heat dying down… wanted level ${wanted.level}.`);
      }
    } else wanted.unseenTimer = 0;
  }
  return nearest;
}
export { BUST_PENALTY };
