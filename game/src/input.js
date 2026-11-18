// Keyboard + mouse input. WASD move/drive, E enter/exit car, Space brake,
// Shift run, M mute, P/Esc pause, click to shoot. Mouse look via pointer lock.
export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0, mouseDY = 0, clicked = false;
  let onAction = null; // callback(actionName) for edge-triggered keys
  function keyName(e) { return e.code; }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'KeyE' && onAction) onAction('enter');
      if (e.code === 'KeyM' && onAction) onAction('mute');
      if ((e.code === 'KeyP' || e.code === 'Escape') && onAction) onAction('pause');
      if (e.code === 'Enter' && onAction) onAction('confirm');
    }
    keys.add(keyName(e));
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) clicked = true; });
  return {
    setActionHandler(fn) { onAction = fn; },
    has(code) { return keys.has(code); },
    forward() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    strafe() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    brake() { return keys.has('Space'); },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeClick() { const c = clicked; clicked = false; return c; },
    lockPointer() { try { canvas.requestPointerLock(); } catch {} },
    unlockPointer() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch {} },
    get locked() { return document.pointerLockElement === canvas; },
  };
}
