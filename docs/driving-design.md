# Carnet Drive Club · 2026-09-07

## Benchmark and implementation

The benchmark is the play loop and presentation of established mobile racing games. It does not assert a current regional app-store ranking.

| Reference | Official evidence | Carnet adaptation |
| --- | --- | --- |
| Asphalt Legends | Gameloft describes its signature nitro gameplay and cinematic racing presentation on its [Asphalt franchise page](https://www.gameloft.com/licensing-out/asphalt), and well-timed nitro on its [games page](https://www.gameloft.com/). | Automatic acceleration, a visible second-tap timing window, perfect nitro, full-charge shockwave, exhaust trails and large speed readout. |
| CarX Street | [CarX Technologies](https://carx-online.com/) describes driving through city streets, vehicle tuning and dynamic steering. | Curved city roads, corner drifts, changing districts, traffic overtakes, persistent handling / nitro / protection upgrades. |

The resulting game is an original 2.5D three-lane arcade drive. Its illustrated streets are separate from the real geographic route shown in navigation. Generated artwork and exact prompts are documented in [the art manifest](../public/art/driving/README.md).

## Play loop

1. Choose a destination and a contract: six films, a 30-second sprint, or a drive without collisions / speeding.
2. A three-second countdown precedes automatic acceleration. It does not consume race time.
3. Overtake moving traffic and collect film. Each action extends the five-second combo, up to a ×4 multiplier. Close passes above 65 add nitro and score.
4. Hold drift on one of the four visible corners. At least 0.55 seconds of drifting banks a style reward when released; holding drift on a straight gives no drift reward.
5. Tap nitro at 18% or more. Tap again 0.18–0.65 seconds after activation for an efficient perfect burst. Starting at 90% or more activates shockwave. Braking or drifting cancels nitro.
6. Brake before the 50 signs. Collisions reduce speed and integrity and reset the combo. The 1-second collision grace prevents repeated damage from one impact.
7. Cross the finish, receive a single payout and XP, and replay immediately or return to the travel game. Personal bests persist separately from the most recent 50 runs.

Keyboard: A/D or arrows to steer, Shift to drift, Space for nitro, S/down to brake, P/Escape to pause. Acceleration is automatic. Touch steering uses `pointerdown` so a second thumb can steer during a held drift; pedal buttons use pointer capture and cancel on lost capture. Swiping the road also changes lanes.

## Rendering and persistence

- Original vehicle and building atlases are depth-sorted over a segmented perspective road. A continuous asphalt silhouette prevents seams. Three district stages change the roadside treatment.
- Local assets finish loading before the countdown. Loading errors offer a retry without consuming race time.
- Simulation advances at a fixed 1/120-second step; rendering uses requestAnimationFrame and limits canvas resolution to 2× device pixels. Interface updates run less frequently.
- Reduced-motion preferences remove camera shake, speed streaks, drift smoke and bouncing, while retaining essential steering and road movement.
- Opening navigation or losing focus pauses the run and clears held inputs. Reloaded checkpoints require explicit resume. Older checkpoints receive defaults for all new driving fields.
- Navigation still uses MapLibre / OSRM. If tiles are unavailable, local POI coordinates and an explicitly labelled straight-line overview remain visible. The road game continues without either service after its local assets have loaded.

## Verification

`npm test` includes `scripts/check-driving.mjs` and the existing store / mission / audio tests. Checks cover timed versus early nitro taps, depleted tanks, shockwave, corner-only drift rewards, near misses, combo expiry, collision resets, legacy driving checkpoints, best-score persistence, and idempotent payouts. Twenty seeded courses are completed with ordinary clean driving and again with timed nitro; the latter finish in 24.5–25.2 seconds without collisions or speeding, making the 30-second contract attainable.

Headless Chrome was exercised at 1440×900, 375×812, 320×640 and 812×375 with real keyboard / multi-touch input. Verified: countdown, two-thumb steering during drift, perfect nitro, shockwave, collision, pause, offline map overview, reload, finish, single payout and replay. Screenshots are saved locally under `artifacts/drive-qa/` (ignored by Git). No unexpected JavaScript / React errors occurred. A 90-frame sample averaged 16.67 ms on desktop Chrome with a mobile viewport; this is not a physical-phone performance measurement.

Existing lint warnings elsewhere in the application and the existing large MapLibre bundle warning remain. Physical iOS / Android device QA and native store packaging are still outside this web release.
