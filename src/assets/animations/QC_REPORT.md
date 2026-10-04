# Husky pet — QC report

Source: `Cute_Husky_Desktop_Pet_Sprite_Sheet.png` (30 drawings cut out; the sheet's checkerboard was baked in, so it was removed by flood-fill from the outside). No new character art was drawn. Canvas 256x256 transparent RGBA, feet anchored at (128,240).

| Metric | Value |
|---|---|
| Total frames | 479 |
| Visually distinct frames (mean diff >= 0.35/255 at 64px) | 390 |
| Animations (excl. transitions) | 47 |
| Transitions | 16 (64 frames) |
| Idle frames | 60 |
| Walk frames (walk, fast, slow, excited, start, stop) | 62 |
| Sleep frames (fall asleep, sleep, wake) | 52 |
| Reaction frames (cursor, happy, pat, treat, surprise, expression, annoyed, sad, drag, jump) | 155 |

## How the frames were made
Each real drawing is warped (bob, squash/stretch about the feet, body sway, head nod, rotation) and chained into sequences. Walk uses the 4 walk drawings with 2-4 bob frames each; transitions are a squash-hop between the two end drawings.

## Rejected
- Optical-flow morphing between different drawings: ghosted and messy on every pair tested, so not used.

## Known limitations
1. About 89 frames are near-duplicates of others (small warps); there are only 30 real drawings. Animation comes from warping, not new poses.
2. Ears, tail and legs cannot move independently (single flat drawings), so no ear twitch, tail wag or true leg motion beyond what the 4 walk drawings show.
3. Effect marks on the sheet (hearts, zzz, question/exclamation marks, cursor, anger mark, sweat puffs) were removed from the sprites and are not included as assets.
4. Cut-outs: edge-sit has its taskbar line removed (feet slightly trimmed); climb has the wall line removed; drag has the cursor and caption removed.
5. Source drawings differ slightly in size and line weight; walk drawings face right (mirror for left).
6. Poses with no matching drawing (sit to stand, idle to sit) reuse the nearest drawing with squash.
