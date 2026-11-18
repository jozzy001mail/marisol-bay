// Deterministic screenshots: each scene plays the real game forward from a
// seeded fresh world with a simple autopilot, exactly like the starter did.
// The autopilot follows the street grid (drive along the current street to
// the target's street, then turn onto it) instead of cutting through blocks,
// and reverses briefly if it gets wedged against something.
// start: title screen over a live city, camera orbiting the plaza.
// cover: Rio driving east down Coral Row through the built-up centre, with
//   traffic in both lanes and pedestrians ahead, mission 1 active.
// play: Rio steals the Sunset GT and drives toward Mara's first pickup.
// chase: wanted 3, a three-car patrol roadblock stopped ahead head-on while
//   Rio drives east down Coral Row at speed.
// mission: mission 1 started, Rio driving to the Marina kiosk beacon.
import { STEP } from './config.js';
import { nearestStreetCoord } from './world.js';
import { startMission } from './missions.js';
import { spawnPoliceCar } from './police.js';
import { syncCarMesh } from './vehicles.js';
import { updateHud } from './hud.js';
import { drawMinimap } from './minimap.js';

let stuckTime = 0, reverseTime = 0;

function autopilotDrive(G, targetX, targetZ, stopAtTarget) {
  const car = G.player.inCar;
  const idle = { fwd: 0, strafe: 0, run: false, brake: false, mouseDX: 0, mouseDY: 0, click: false, enter: false };
  if (!car) return idle;
  // Arrived: stop at the target instead of circling it.
  if (stopAtTarget && Math.hypot(targetX - car.x, targetZ - car.z) < 9) {
    return { ...idle, brake: Math.abs(car.speed) > 1 };
  }
  // Unstick: if barely moving while trying to drive, reverse for a moment.
  if (Math.abs(car.speed) < 1) stuckTime += STEP; else stuckTime = 0;
  if (stuckTime > 1.2 && reverseTime <= 0) { reverseTime = 0.9; stuckTime = 0; }
  if (reverseTime > 0) {
    reverseTime -= STEP;
    return { ...idle, fwd: -1, strafe: 0.5 };
  }
  // Street-grid waypoint: first line up with the target along the street we
  // are on, then turn onto the target's street and drive straight to it.
  const dx = targetX - car.x, dz = targetZ - car.z;
  let wx, wz;
  if (Math.abs(dx) > 8) { wx = targetX; wz = nearestStreetCoord(car.z); }
  else { wx = targetX; wz = targetZ; }
  const wantHeading = Math.atan2(wx - car.x, wz - car.z);
  let dh = wantHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  // Slow down for sharp turns instead of swinging wide through buildings —
  // but only once moving: a stopped car cannot steer at all, so it must
  // accelerate first and turn as it picks up speed.
  const spd = Math.abs(car.speed);
  if (Math.abs(dh) > 0.9 && spd > 8) return { ...idle, fwd: 0, strafe: Math.max(-1, Math.min(1, dh * 1.8)), brake: true };
  if (Math.abs(dh) > 0.5 && spd > 14) return { ...idle, fwd: 0, strafe: Math.max(-1, Math.min(1, dh * 1.8)) };
  return { ...idle, fwd: 1, strafe: Math.max(-1, Math.min(1, dh * 1.8)) };
}
function putPlayerInCar(G, index) {
  const car = G.parked[index];
  G.player.inCar = car; car.isPlayerCar = true; car.isTraffic = false;
  G.player.mesh.visible = false;
  G.player.x = car.x; G.player.z = car.z;
}
function stepFor(G, seconds, target, stopAtTarget) {
  stuckTime = 0; reverseTime = 0;
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) G.step(STEP, autopilotDrive(G, target.x, target.z, stopAtTarget));
}
function ambient(G, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    G.step(STEP, { fwd: 0, strafe: 0, run: false, brake: false, mouseDX: 0, mouseDY: 0, click: false, enter: false });
  }
}

// Staging helpers: place real game entities relative to the player's car so
// the frame is guaranteed busy. Nothing moves after staging — runShot only
// renders — so the shot is exactly what was staged, but the HUD and minimap
// only refresh inside G.step, so refresh them by hand after staging.
function fwd(h) { return { x: Math.sin(h), z: Math.cos(h) }; }
function right(h) { return { x: -Math.cos(h), z: Math.sin(h) }; }
function placeCar(car, x, z, heading) {
  car.x = x; car.z = z; car.heading = heading; car.speed = 0; syncCarMesh(car);
}
function placePed(ped, x, z, heading) {
  ped.x = x; ped.z = z; ped.heading = heading;
  ped.mesh.position.set(x, 0, z); ped.mesh.rotation.y = heading;
}
function refreshHud(G) {
  updateHud(G); drawMinimap(G.hudEls.minimap, G);
}
function clearPolice(G) {
  for (const c of G.police) G.scene.remove(c.mesh);
  G.police.length = 0;
  G.wanted.level = 0; G.wanted.unseenTimer = 0;
}

export function stageShot(G, name) {
  if (name === 'start') {
    G.orbit = true; G.orbitAngle = 0.7;
    ambient(G, 5);
    G.orbitAngle = 0.9;
    return { screen: 'start' };
  }
  G.orbit = false;
  G.screen = 'play';
  if (name === 'cover') {
    putPlayerInCar(G, 0);
    // Face east down Coral Row so the drive starts clean, no U-turn, and
    // sit on the street centre line. Westward stalls: a crossing traffic car
    // shoves the player into a block building that juts to the road edge.
    // Eastward is proven clear — the chase drives the same street at speed.
    const car0 = G.player.inCar;
    car0.heading = Math.PI / 2;
    car0.z = nearestStreetCoord(car0.z);
    G.player.z = car0.z;
    syncCarMesh(car0);
    startMission(G);
    // Short drive east through the built-up centre: buildings both sides.
    // Shorter than the chase drive, so this ends mid-city, not at the edge.
    stepFor(G, 2.2, { x: 100, z: 100 }, false);
    const car = G.player.inCar;
    const f = fwd(car.heading), r = right(car.heading);
    const at = (d, lat) => ({ x: car.x + f.x * d + r.x * lat, z: car.z + f.z * d + r.z * lat });
    // Traffic in both lanes ahead, pedestrians on the road ahead.
    let p = at(18, 2.2); placeCar(G.traffic[0], p.x, p.z, car.heading);
    p = at(28, -2.2); placeCar(G.traffic[1], p.x, p.z, car.heading + Math.PI);
    const alivePeds = G.peds.filter((pd) => pd.alive);
    const pedSpots = [[11, 4], [16, -4], [22, 3.5]];
    for (let i = 0; i < Math.min(3, alivePeds.length); i++) {
      p = at(pedSpots[i][0], pedSpots[i][1]);
      placePed(alivePeds[i], p.x, p.z, car.heading + Math.PI);
    }
    // Drop any patrol that spawned mid-drive (e.g. a clipped pedestrian),
    // so the cover stays a clean street scene with no stray wanted stars.
    clearPolice(G);
    refreshHud(G);
    G.hudMessage('Mara\'s first job — pick up the parcel at the Marina Kiosk.');
    return { screen: 'play' };
  }
  if (name === 'chase') {
    putPlayerInCar(G, 0);
    // Face east down Coral Row so the drive starts clean, no U-turn.
    G.player.inCar.heading = Math.PI / 2;
    // Drive first with no heat, so no patrol spawns mid-drive to ram the
    // player; the roadblock is staged after the drive, then the HUD is
    // refreshed so the stars and minimap dots match it.
    stepFor(G, 3.5, { x: 100, z: 100 }, false);
    const car = G.player.inCar;
    clearPolice(G);
    G.wanted.level = 3; G.wanted.unseenTimer = 0;
    const f = fwd(car.heading), r = right(car.heading);
    const at = (d, lat) => ({ x: car.x + f.x * d + r.x * lat, z: car.z + f.z * d + r.z * lat });
    // Roadblock across the road ahead, facing the player head-on: three
    // patrol cars in frame, light bars toward the camera.
    const slots = [[14, -3.2], [20, 0], [26, 3.2]];
    for (const [d, lat] of slots) {
      const p = at(d, lat);
      G.police.push(spawnPoliceCar(G.scene, G.rng, p.x, p.z, car.heading + Math.PI));
    }
    refreshHud(G);
    G.hudMessage('Patrols on your tail — lose them!');
    return { screen: 'play' };
  }
  if (name === 'mission') {
    putPlayerInCar(G, 0);
    startMission(G);
    // Reach the Marina pickup, then drive on toward the Cafe Lumen dropoff,
    // so this frame is mid-delivery and distinct from the play shot.
    stepFor(G, 12, { x: -100, z: 100 }, true);
    stepFor(G, 6, { x: 60, z: -20 }, false);
    return { screen: 'play' };
  }
  // play (default)
  putPlayerInCar(G, 0);
  startMission(G);
  stepFor(G, 12, { x: -100, z: 100 }, true);
  return { screen: 'play' };
}
