# Active Context

## Current Focus
- Game flow UX: difficulty selection on load/right-click, countdown with audio before start, restart button after loss (no auto-restart).

## Recent Changes
- Added lighter neon background.
- Difficulty presets (easy/medium/hard) set starting enemy counts and speed deltas; HUD shows current difficulty.
- Countdown overlay with beeps before gameplay.
- Restart button after loss; manual restart triggers countdown.
- Clone spawning capped at 15.
- Enemies spawn near corners/edges; chase nearest red (flee when invincible).
- Power-ups: single per round (speed boost tied to collector, invincibility global), random delayed spawn, any red can collect.

## Next Steps
- Validate flows on difficulty switch and restart edge cases.
- Consider pausing menus during countdown or adding mute toggle (if requested).

## Decisions/Notes
- No auto-restart after loss; restart requires user click.
- Difficulty selection resets state and runs countdown.
