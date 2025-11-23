# Progress

## What works
- Difficulty presets (easy/medium/hard) with HUD label and right-click menu; menu shown on load.
- Countdown overlay with audio; starts after difficulty selection and on manual restart.
- Restart button after loss; prevents auto-restart and reruns countdown.
- Player movement (active via arrows, clones/autopilot), clone spawning capped at 15.
- Enemy chasing/fleeing logic, corner/edge spawning, speed scaling with cap after round 15.
- Power-ups (speed boost, invincibility) single per round, random delay, collectible by any red; boost bound to collector.
- Visual theme: lighter neon gradient, glow styles for balls/power-ups, HUD styling.

## Outstanding / To watch
- Verify restart/difficulty transitions for timer/interval cleanup in all cases.
- Browser audio gesture constraints may mute beeps; acceptable fallback.
- Potential future requests: mute toggle, pause, improved mobile input.
