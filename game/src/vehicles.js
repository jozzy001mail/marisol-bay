// Cars: built-from-boxes meshes, arcade driving physics, collisions with
// buildings (AABBs) and other cars, damage and smoke.
import * as THREE from 'three';
import { CAR_DEFS } from './config.js';
import { resolveCircle } from './world.js';

export function createCarMesh(def, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f6e : def.color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 2.0), paint);
  roof.position.set(0, 1.65, -0.2); g.add(roof);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.78, -0.2); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.32, 1.78, -0.2); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.32, 1.78, -0.2); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  g.userData.wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w); g.userData.wheels.push(w);
  }
  // Headlights + taillights so cars read at a distance.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x555533 });
  for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), hl); h.position.set(x, 0.7, 2.22); g.add(h); }
  const tl = new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x440000 });
  for (const x of [-0.6, 0.6]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), tl); t.position.set(x, 0.7, -2.22); g.add(t); }
  return g;
}

export function spawnCar(def, x, z, heading, isPolice, scene) {
  const mesh = createCarMesh(def, isPolice);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    def, mesh, isPolice: !!isPolice, isTraffic: false, isPlayerCar: false,
    x, z, heading, speed: 0, steer: 0, health: 100, dead: false,
    ai: null, // traffic/police steering state
  };
}

// Arcade driving: forward = W, reverse/brake = S, steer = A/D, Space = handbrake.
export function driveCar(car, fwd, steerInput, brake, dt, colliders, allCars) {
  const def = car.def;
  if (brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  if (fwd > 0) car.speed += def.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? def.accel * 1.6 : def.accel * 0.7) * dt;
  else car.speed *= Math.max(0, 1 - 0.7 * dt);
  car.speed = Math.max(-def.topSpeed * 0.45, Math.min(def.topSpeed, car.speed));
  const dir = car.speed >= 0 ? 1 : -1;
  car.steer += ((steerInput * (Math.abs(car.speed) > 0.5 ? 1 : 0)) - car.steer) * Math.min(1, 8 * dt);
  car.heading += car.steer * def.turn * dir * Math.min(1, Math.abs(car.speed) / 8) * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const before = { x: car.x, z: car.z };
  car.x = nx; car.z = nz;
  const hit = resolveCircle(car, 1.6, colliders);
  if (hit) {
    // Only hard hits hurt: gentle taps just bounce the car back.
    const impact = Math.abs(car.speed);
    const lost = impact > 8 ? (impact - 8) * 0.8 : 0;
    if (lost > 0) car.health -= lost;
    car.speed *= -0.25;
    car.x = before.x; car.z = before.z;
    resolveCircle(car, 1.6, colliders);
    return { crashed: lost > 2, hard: impact > 8 };
  }
  // Soft car-car bumps.
  for (const other of allCars) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x, dz = car.z - other.z, d = Math.hypot(dx, dz);
    if (d < 3.2 && d > 0.01) {
      const push = (3.2 - d) / 2;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      other.x -= (dx / d) * push; other.z -= (dz / d) * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 8) { car.health -= rel * 0.15; other.health -= rel * 0.15; }
      car.speed *= 0.6;
      return { crashed: rel > 8, hard: false };
    }
  }
  return { crashed: false, hard: false };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.016;
  for (const w of car.mesh.userData.wheels || []) w.rotation.x += spin;
  const front = car.mesh.userData.wheels || [];
  if (front[0]) front[0].rotation.y = car.steer * 0.3;
  if (front[1]) front[1].rotation.y = car.steer * 0.3;
}
export function carDisplayName(car) { return car.isPolice ? 'Patrol Car' : car.def.name; }
