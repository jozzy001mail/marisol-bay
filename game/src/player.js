// Rio, the player character on foot: a built-from-boxes figure with swinging
// arms and legs, WASD movement relative to the camera, and a punch.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircle } from './world.js';

export function createPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.15; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.78; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), hair);
  cap.position.y = 2.02; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), pants);
  legL.position.set(-0.17, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armL.position.set(-0.42, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function createPlayerState(scene) {
  const mesh = createPlayerMesh();
  mesh.position.set(0, 0, -30); scene.add(mesh);
  return {
    mesh, x: 0, z: -30, heading: 0, camYaw: 0, camPitch: -0.25,
    health: PLAYER.maxHealth, speed: 0, walkPhase: 0, inCar: null,
    punchTimer: 0, hurtTimer: 0,
  };
}

// Move on foot. forward/strafe are -1..1 in camera space; returns distance moved.
export function updateOnFoot(p, fwd, strafe, run, dt, colliders, allCars) {
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  // Camera yaw 0 looks toward -Z in world terms used by the camera rig; forward is (-sin, -cos).
  let mx = (-sin) * fwd + cos * strafe;
  let mz = (-cos) * fwd - sin * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.x += mx * speed * dt; p.z += mz * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.walkPhase += dt * speed * 1.6;
    p.speed = speed;
  } else p.speed = 0;
  const hit = resolveCircle(p, PLAYER.radius, colliders);
  if (hit) p.speed = 0;
  // Bump into parked/traffic cars: stop at the body.
  for (const c of allCars) {
    if (c.dead) continue;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < 2.2 && d > 0.01) { p.x = c.x + (dx / d) * 2.2; p.z = c.z + (dz / d) * 2.2; }
  }
  // Keep inside the city + beach.
  p.x = Math.max(-128, Math.min(128, p.x));
  p.z = Math.max(-128, Math.min(152, p.z));
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  const swing = p.speed > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) { p.punchTimer -= dt; u.armR.rotation.x = -1.4; }
  return len;
}
