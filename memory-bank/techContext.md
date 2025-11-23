# Tech Context

## Stack
- HTML/CSS/JavaScript only; no external libraries or build steps.

## Runtime
- Runs in modern browsers with `requestAnimationFrame` and `AudioContext` for countdown beeps.

## Controls
- Arrow keys move the active red ball.
- Spacebar spawns a clone (up to max players).
- Right-click opens difficulty menu; restart button appears after loss.

## Assets
- Background is CSS gradient/neon; no external images required currently.

## Constraints
- Keep code self-contained in `index.html`.
- Audio may be subject to browser gesture restrictions; countdown handles best-effort beep.
