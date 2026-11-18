// Live top-down minimap on a 2D canvas: roads, buildings, beach, player,
// traffic (yellow), police (flashing blue/red), mission beacon (pink).
import { CITY } from './config.js';

export function drawMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width, half = CITY.half + 20;
  const toX = (x) => ((x + half) / (half * 2)) * S;
  const toY = (z) => ((z + half) / (half * 2)) * S;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1e2a24'; ctx.fillRect(0, 0, S, S);
  // Sea + sand at the south edge.
  ctx.fillStyle = '#1f7fa8'; ctx.fillRect(0, toY(CITY.beachZ + 14), S, S - toY(CITY.beachZ + 14));
  ctx.fillStyle = '#e8d29a'; ctx.fillRect(0, toY(CITY.beachZ), S, toY(CITY.beachZ + 14) - toY(CITY.beachZ));
  // Roads.
  ctx.fillStyle = '#3a3f46';
  for (const s of CITY.streets) {
    ctx.fillRect(0, toY(s) - 3, S, 6);
    ctx.fillRect(toX(s) - 3, 0, 6, S);
  }
  // Buildings.
  ctx.fillStyle = '#8a94a0';
  for (const b of G.buildings) ctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), (b.w / (half * 2)) * S, (b.d / (half * 2)) * S);
  // Mission beacon.
  if (G.beacon.visible) {
    const bx = toX(G.beacon.position.x), by = toY(G.beacon.position.z);
    ctx.fillStyle = '#ff5a9c';
    ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff5a9c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 9 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic.
  ctx.fillStyle = '#ffd23c';
  for (const c of G.traffic) { ctx.fillRect(toX(c.x) - 2, toY(c.z) - 2, 4, 4); }
  for (const c of G.parked) { if (!c.isPlayerCar) { ctx.fillStyle = '#c8ccd2'; ctx.fillRect(toX(c.x) - 2, toY(c.z) - 2, 4, 4); ctx.fillStyle = '#ffd23c'; } }
  // Police, flashing.
  const flash = Math.sin(G.time * 8) > 0;
  ctx.fillStyle = flash ? '#ff2020' : '#2040ff';
  for (const c of G.police) { ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 4, 0, Math.PI * 2); ctx.fill(); }
  // Player: white triangle pointing along heading.
  const p = G.player.inCar ? G.player.inCar : G.player;
  const px = toX(p.x), py = toY(p.z);
  const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
  ctx.save(); ctx.translate(px, py); ctx.rotate(-heading + Math.PI);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
}
