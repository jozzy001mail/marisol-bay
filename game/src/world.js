// Marisol Bay itself: procedural streets, buildings with canvas-drawn windows,
// palm trees, street props, a beach and harbour edge, sun, sky and fog.
// All textures are drawn on canvas at boot — no image files, no network.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { range, intRange, pick } from './random.js';

const BUILDING_COLORS = [0xe8dcc8, 0xd8c8b0, 0xc8d8e0, 0xe0b8a0, 0xf0e0c0, 0xb8c8d8, 0xd8a8a0, 0xe8e0d0];
const ROOF_COLORS = [0x8a6a4a, 0x6a7a8a, 0x9a8a7a, 0x5a6a7a];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildingTexture(baseColor, floors, rng) {
  const hex = '#' + baseColor.toString(16).padStart(6, '0');
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 18, w, 18);
    const cols = 4, rows = Math.max(3, floors);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.25;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3a4a';
      g.fillRect(12 + c * 28, 14 + r * ((h - 30) / rows), 18, 14);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(12 + c * 28, 14 + r * ((h - 30) / rows), 18, 3);
    }
  });
}
function roadTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c94c';
    for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y + 8, 6, 32);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h);
  });
}
function sandTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e8d29a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(180,150,90,0.4)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
}

function makePalm(THREE_, rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4.5, 6), trunkMat);
  trunk.position.y = 2.25; trunk.rotation.z = range(rng, -0.08, 0.08); palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4a, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9);
    palm.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a20 }));
  nut.position.y = 4.4; palm.add(nut);
  return palm;
}
function makeLamp(THREE_) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), mat);
  pole.position.y = 2.5; g.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554400 }));
  head.position.y = 5.05; g.add(head);
  return g;
}
function makeHydrant(THREE_) {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8),
    new THREE.MeshLambertMaterial({ color: 0xd83a2a }));
}
function makeBench(THREE_) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.6), mat); seat.position.y = 0.5; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), mat); back.position.set(0, 0.85, -0.28); g.add(back);
  return g;
}

// AABB collision: {minX,maxX,minZ,maxZ}. resolveCircle pushes a circle out.
export function resolveCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-6) { pos.x = c.maxX + radius; continue; }
      const d = Math.sqrt(d2); pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius;
      return c;
    }
  }
  return null;
}
export function nearestStreetCoord(v) {
  let best = CITY.streets[0], bd = Infinity;
  for (const s of CITY.streets) { const d = Math.abs(v - s); if (d < bd) { bd = d; best = s; } }
  return best;
}
export function onRoad(x, z) {
  const nearX = CITY.streets.some((s) => Math.abs(x - s) < CITY.streetWidth / 2);
  const nearZ = CITY.streets.some((s) => Math.abs(z - s) < CITY.streetWidth / 2);
  return nearX || nearZ;
}

export function buildCity(rng) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(80, 140, 40); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd8e8, 0.9));
  const hemi = new THREE.HemisphereLight(0xbfe0f0, 0x8a7a5a, 0.5); scene.add(hemi);

  const colliders = [];
  const group = new THREE.Group(); scene.add(group);

  // Ground: grass base, then road strips, sidewalks and the beach/sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = 10; group.add(ground);
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of CITY.streets) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.streetWidth), roadMat.clone());
    rx.material.map = roadTex.clone(); rx.material.map.repeat.set(8, 1); rx.material.map.needsUpdate = true;
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.02, s); group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY.streetWidth, CITY.half * 2), roadMat.clone());
    rz.material.map = roadTex.clone(); rz.material.map.repeat.set(1, 8); rz.material.map.needsUpdate = true;
    rz.rotation.x = -Math.PI / 2; rz.position.set(s, 0.02, 0); group.add(rz);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, 26),
    new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, CITY.beachZ + 8); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.01, CITY.seaZ + 22); group.add(sea);
  // Harbour pier jutting into the sea.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 26), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(-60, 0.3, 140); group.add(pier); colliders.push({ minX: -64, maxX: -56, minZ: 128, maxZ: 152 });

  // Buildings: 1–4 per block, varied height and colour, window textures.
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const bx of CITY.blockCentres) for (const bz of CITY.blockCentres) {
    if (bz >= 100) continue; // beachfront row stays open
    const count = intRange(rng, 1, 3);
    for (let i = 0; i < count; i++) {
      const w = range(rng, 10, 18), d = range(rng, 10, 18), h = range(rng, 7, 34);
      const x = bx + range(rng, -9, 9) - (count > 1 ? (i - 1) * 8 : 0);
      const z = bz + range(rng, -9, 9);
      if (Math.abs(x) < 14 && Math.abs(z) < 14) continue; // keep the central plaza open
      const color = pick(rng, BUILDING_COLORS);
      const mat = new THREE.MeshLambertMaterial({ map: buildingTexture(color, Math.round(h / 4), rng) });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d); b.position.set(x, h / 2, z); group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
        new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }));
      roof.position.set(x, h + 0.25, z); group.add(roof);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      buildings.push({ x, z, w, h, d });
    }
  }
  // Central plaza: fountain + benches.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 1, 16), new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }));
  fountain.position.set(0, 0.5, 0); group.add(fountain);
  colliders.push({ minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }));
  water.position.set(0, 1.05, 0); group.add(water);

  // Palms along streets and beach, lamps at intersections, hydrants and benches.
  const palms = [];
  for (const s of CITY.streets) for (let k = -2; k <= 2; k++) {
    if (rng() < 0.45) {
      const palm = makePalm(THREE, rng);
      const along = k * 40 + range(rng, -8, 8);
      const side = rng() < 0.5 ? 1 : -1;
      if (rng() < 0.5) palm.position.set(s + side * 7.5, 0, along); else palm.position.set(along, 0, s + side * 7.5);
      group.add(palm); palms.push(palm);
    }
  }
  for (let i = 0; i < 14; i++) {
    const palm = makePalm(THREE, rng);
    palm.position.set(range(rng, -120, 120), 0, CITY.beachZ + range(rng, 1, 10));
    group.add(palm); palms.push(palm);
  }
  for (const sx of CITY.streets) for (const sz of CITY.streets) {
    if (rng() < 0.5) { const lamp = makeLamp(THREE); lamp.position.set(sx + 6.5, 0, sz + 6.5); group.add(lamp); }
    if (rng() < 0.3) { const hyd = makeHydrant(THREE); hyd.position.set(sx - 6.5, 0.45, sz - 6.5); group.add(hyd); }
  }
  for (let i = 0; i < 8; i++) {
    const bench = makeBench(THREE);
    bench.position.set(range(rng, -20, 20), 0, range(rng, -20, 20) + (rng() < 0.5 ? 8 : -8));
    bench.rotation.y = rng() * Math.PI; group.add(bench);
  }
  // Lighthouse at the north-west point (mission 4 destination landmark).
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf0e8d8 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 22, 10), lightMat);
  tower.position.set(-118, 11, -118); group.add(tower);
  const lightTop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.5, 10), new THREE.MeshLambertMaterial({ color: 0xd83a2a }));
  lightTop.position.set(-118, 23, -118); group.add(lightTop);
  colliders.push({ minX: -121, maxX: -115, minZ: -121, maxZ: -115 });

  // Mission beacon: a glowing column that missions move to their target.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff5a9c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 20; beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a9c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; beacon.add(ring);
  beacon.visible = false; scene.add(beacon);

  return { scene, group, colliders, buildings, palms, beacon, beam, ring };
}
