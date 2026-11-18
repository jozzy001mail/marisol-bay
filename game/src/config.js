// Marisol Bay — every tuning number, colour and story beat in one place.
// A fictional sun-soaked coastal city. All names, places and people are original.
export const STEP = 1 / 60;
export const SAVE_KEY = 'marisol-bay-save-v1';
export const CITY = {
  half: 130,                 // playable half-extent in metres
  streets: [-100, -60, -20, 20, 60, 100],   // street centre lines, both axes
  streetWidth: 10,
  blockCentres: [-80, -40, 0, 40, 80],
  beachZ: 118,               // south of here: sand, then sea
  seaZ: 138,
};
export const PLAYER = { walkSpeed: 6, runSpeed: 10, radius: 0.6, maxHealth: 100 };
export const CAR_DEFS = [
  { name: 'Sunset GT',   color: 0xff5a3c, topSpeed: 34, accel: 22, turn: 2.4 },
  { name: 'Bay Runner',  color: 0x2fa8ff, topSpeed: 30, accel: 20, turn: 2.6 },
  { name: 'Coral Coupe', color: 0xffc93c, topSpeed: 32, accel: 21, turn: 2.5 },
  { name: 'Harbor Van',  color: 0x7ddb6a, topSpeed: 24, accel: 15, turn: 2.0 },
  { name: 'Palm Cruiser',color: 0xc77dff, topSpeed: 28, accel: 18, turn: 2.3 },
  { name: 'Dune Buggy',  color: 0xff8fab, topSpeed: 29, accel: 19, turn: 2.7 },
];
export const POLICE_COLOR = 0x1c2f6e;
// Missions: a chained story for Rio (the player) and his fixer Mara Voss.
export const MISSIONS = [
  {
    id: 1, title: 'First Errand', giver: 'Mara Voss',
    brief: 'Mara needs a parcel from the Marina kiosk delivered to Cafe Lumen on Coral Row. Grab a car — any car — and go.',
    pickup: { x: -100, z: 100, label: 'Marina Kiosk' },
    dropoff: { x: 60, z: -20, label: 'Cafe Lumen' },
    reward: 250, timeLimit: 0,
  },
  {
    id: 2, title: 'The Getaway', giver: 'Mara Voss',
    brief: 'Mara\'s courier is pinned at the old ferry terminal. Pick him up, then lose the harbour patrol — stay out of sight until the heat dies down.',
    pickup: { x: 100, z: 100, label: 'Ferry Terminal' },
    dropoff: { x: -80, z: -80, label: 'Safe House' },
    reward: 500, timeLimit: 0, wantedOnPickup: 2,
  },
  {
    id: 3, title: 'Harbor Pickup', giver: 'Mara Voss',
    brief: 'A crate came in on the night boat. Collect it from the harbour warehouse and bring it to the garage on Palm Row. The patrols are watching the docks.',
    pickup: { x: -100, z: 60, label: 'Harbour Warehouse' },
    dropoff: { x: 20, z: -100, label: 'Palm Row Garage' },
    reward: 750, timeLimit: 0, wantedOnPickup: 1,
  },
  {
    id: 4, title: 'Sunset Delivery', giver: 'Mara Voss',
    brief: 'Last job: a timed delivery for the Sunset Festival. Get the festival banner from the beach stage to the lighthouse point before the sun sets — 150 seconds.',
    pickup: { x: 0, z: 112, label: 'Beach Stage' },
    dropoff: { x: -100, z: -100, label: 'Lighthouse Point' },
    reward: 1500, timeLimit: 150,
  },
];
export const PALETTE = {
  sky: 0x87c5e8, fog: 0xa8d0e6, sun: 0xfff2cc,
  sand: 0xe8d29a, sea: 0x1f7fa8, grass: 0x6fae5e,
  road: 0x3a3f46, sidewalk: 0x9aa0a8, building: 0xd8cfc0,
  hud: '#ffe9a8', accent: '#ff5a3c',
};
export const WANTED_DECAY_SECONDS = 14;   // seconds unseen before one star drops
export const BUST_PENALTY = 150;
