# System Patterns

## Architecture
- Single-page HTML with embedded CSS/JS; no build tooling.
- DOM-driven game objects (divs) for player balls, enemies, HUD, difficulty menu, countdown overlay, restart button, and power-ups.
- Game loop via `requestAnimationFrame` for player updates + `setInterval` (~60fps) for enemy movement.
- Round timer via `setInterval`.

## Core Logic
- Players: array of red-ball objects (position, velocity, input/autopilot). Active player uses keyboard input; others steer via avoidance + random drift. Clone spawn via spacebar; cap enforced.
- Enemies: black balls chase nearest red; speed scales per index and difficulty delta; flee when invincibility active. Spawn near corners/edges based on count.
- Power-ups: one at a time per round after random delay (speed boost or invincibility). Any red ball can collect; speed boost bound to collecting red.
- Difficulty: presets (easy/medium/hard) set starting enemy count and base speed deltas; menu shows on load and on right-click. Current label in HUD.
- Flow: selecting difficulty triggers animated countdown with beeps; on loss, restart button appears (no auto-restart) and countdown runs again when restarting.
- Round progression: increments ballCount each round; speed ramp capped after round 15; resets per difficulty on loss/restart.

## State Management
- Central mutable state: arrays for players/enemies, timers/intervals, counters (rounds, timers), flags (isGameOver, isCountingDown, pendingRestart).
- Functions grouped by responsibility: spawning (players, enemies, power-ups), movement updates, collision checks, UI controls (menus, overlays, HUD).
