// Ambient life: traffic cars looping the street grid, and pedestrians
// strolling the sidewalks (and fleeing when scared).
import * as THREE from 'three';
import { CAR_DEFS, CITY } from './config.js';
import { spawnCar, syncCarMesh } from './vehicles.js';
import { nearestStreetCoord, onRoad } from './world.js';
import { createRandom, range, pick } from './random.js';

const PED_SHIRTS = [0xffd23c, 0x3cc8ff, 0xff8fab, 0x7ddb6a, 0xf0f0f0, 0xff9a3c, 0x9a7bff];

export function createPedestrianMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4a2a]) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt); torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin); head.position.y = 1.68; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants); legL.position.set(-0.14, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  g.userData = { legL, legR, phase: rng() * 6 };
  return g;
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = createPedestrianMesh(rng);
    const street = pick(rng, CITY.streets);
    const along = range(rng, -110, 110);
    const side = rng() < 0.5 ? 1 : -1;
    const onXStreet = rng() < 0.5;
    const x = onXStreet ? along : street + side * 7;
    const z = onXStreet ? street + side * 7 : along;
    mesh.position.set(x, 0, z); scene.add(mesh);
    peds.push({ mesh, x, z, heading: rng() * Math.PI * 2, speed: range(rng, 1.2, 2.2),
      targetX: x, targetZ: z, flee: 0, phase: rng() * 6, alive: true });
  }
  return peds;
}
function pickPedTarget(ped, rng) {
  // Walk to a nearby sidewalk point: a street line offset by 7m.
  const street = pick(rng, CITY.streets);
  const along = range(rng, -110, 110);
  const side = rng() < 0.5 ? 1 : -1;
  if (rng() < 0.5) { ped.targetX = along; ped.targetZ = street + side * 7; }
  else { ped.targetX = street + side * 7; ped.targetZ = along; }
}
export function updatePedestrians(peds, dt, rng, threat) {
  for (const p of peds) {
    if (!p.alive) continue;
    if (threat) {
      const d = Math.hypot(p.x - threat.x, p.z - threat.z);
      if (d < 12) p.flee = 2.5;
    }
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - threat.x, dz = p.z - threat.z, d = Math.hypot(dx, dz) || 1;
      p.x += (dx / d) * 5 * dt; p.z += (dz / d) * 5 * dt;
      p.heading = Math.atan2(dx, dz);
    } else {
      const dx = p.targetX - p.x, dz = p.targetZ - p.z, d = Math.hypot(dx, dz);
      if (d < 1.5) pickPedTarget(p, rng);
      else {
        p.x += (dx / d) * p.speed * dt; p.z += (dz / d) * p.speed * dt;
        p.heading = Math.atan2(dx, dz);
      }
    }
    p.x = Math.max(-126, Math.min(126, p.x)); p.z = Math.max(-126, Math.min(126, p.z));
    p.phase += dt * (p.flee > 0 ? 9 : 5);
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.heading;
    const s = Math.sin(p.phase) * 0.5;
    p.mesh.userData.legL.rotation.x = s; p.mesh.userData.legR.rotation.x = -s;
  }
}

// Traffic: each car follows one street, and at intersections sometimes turns.
export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const def = pick(rng, CAR_DEFS);
    const street = pick(rng, CITY.streets);
    const along = range(rng, -110, 110);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const dir = rng() < 0.5 ? 1 : -1;
    const x = axis === 'x' ? along : street + dir * 2.2;
    const z = axis === 'x' ? street + dir * 2.2 : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawnCar(def, x, z, heading, false, scene);
    car.isTraffic = true;
    car.ai = { axis, dir, speed: range(rng, 7, 11), nextTurnAt: range(rng, 20, 60) };
    cars.push(car);
  }
  return cars;
}
export function updateTraffic(cars, dt, rng, colliders) {
  for (const car of cars) {
    if (car.dead) continue;
    const ai = car.ai;
    car.speed = ai.speed;
    // At an intersection, sometimes turn onto the crossing street.
    const onX = Math.abs(car.z - nearestStreetCoord(car.z)) < 1.2;
    const onZ = Math.abs(car.x - nearestStreetCoord(car.x)) < 1.2;
    if (onX && onZ && rng() < dt * 0.35) {
      if (ai.axis === 'x') { ai.axis = 'z'; car.heading = rng() < 0.5 ? 0 : Math.PI; }
      else { ai.axis = 'x'; car.heading = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    }
    // Snap back onto the lane so traffic never drifts into buildings.
    if (ai.axis === 'x') {
      const lane = nearestStreetCoord(car.z) + (car.heading > 0 ? 2.2 : -2.2) * (Math.sin(car.heading) > 0 ? 1 : -1);
      car.z += (nearestStreetCoord(car.z) + 2.2 * (car.heading === Math.PI / 2 ? 1 : -1) - car.z) * Math.min(1, 2 * dt);
    } else {
      car.x += (nearestStreetCoord(car.x) + 2.2 * (car.heading === 0 ? 1 : -1) - car.x) * Math.min(1, 2 * dt);
    }
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Wrap around the city edge instead of driving into the sea.
    if (car.x > 128) car.x = -128; if (car.x < -128) car.x = 128;
    if (car.z > 128) car.z = -128; if (car.z < -128) car.z = 128;
    syncCarMesh(car);
  }
}
export function nearestPed(peds, x, z, maxD) {
  let best = null, bd = maxD;
  for (const p of peds) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
