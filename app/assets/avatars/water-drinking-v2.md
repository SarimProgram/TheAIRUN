# Hydration drinking animation

Built-in imagegen output: `water-drinking-v2.png`, 1881 x 836 RGBA.
Six columns, two rows; cells 313.5 x 418. Male top, female bottom.
Poses: bottle at hip, waist, chest, face, start sip, full sip.
Playback: tap an avatar to raise through all six poses, hold sip, lower in
reverse, then rest. 150 ms per transition, 2400 ms per play. Feet stay planted.
Partner is mirrored. No autoplay or repeat. Each avatar plays independently.
Reduce Motion holds pose zero; backgrounding stops motion.
This replaces the breathing sheet in WaterCharacter.tsx. Bottle in hand is
part of the illustration; the larger water progress bottle remains separate.

## Prompt (built-in image generation)

Use case: stylized-concept
Asset type: transparent production character animation sprite atlas for hydration app.
References: preserve identity and polished 3D fitness style of attached standing male/female character sheet, but REPLACE the idle poses with a strongly readable drinking action.
EXACT GRID: SIX columns by TWO rows, twelve full-body figures. Canvas 2304x1024 ideal, each equal cell 384x512. Row one SAME male six times, row two SAME female six times. No labels, grid lines or text.
Characters: male brown quiff, teal fitted gym shirt and shorts, teal/white sneakers; female auburn ponytail, coral gym shirt and shorts, coral/white sneakers. Stylized faceless face with white eyes as reference. All figures three-quarter profile facing RIGHT. Whole body head to shoes fully inside own cell. Same scale, exact same planted feet and hip/head placement across frames, consistent lighting. Each figure centered with generous margins. Other arm relaxed at side.
Action: each person holds ONE SMALL transparent cyan drinking bottle WITHOUT a cap in their RIGHT HAND, visible on viewer's right. Bottle has cyan water and an open neck, no straw. This is a small handheld bottle, not the app's large separate progress bottle. Six sequential poses from left to right:
1. Standing relaxed, bottle upright at right hip in right hand.
2. Forearm raising, bottle upright at waist/low chest.
3. Elbow bends further, bottle upright at chest height.
4. Bottle near face, neck approaching mouth, wrist starts tilting.
5. Open neck touching mouth, bottle tilted upward 45 degrees, head slightly tipped back, clearly taking a sip.
6. Full obvious drinking pose: bottle neck AT MOUTH and bottle bottom raised, bottle nearly horizontal, right elbow lifted, head tipped back slightly. Grip and bottle coherent, bottle never floating or intersecting face. The action will be played forward then backward, so do NOT lower bottle in sixth frame.
Make differences across poses clear enough to read at 150px tall. Pose differences primarily articulated elbow, wrist and bottle height/rotation, not whole body morphing. Clothing, feet, proportions and camera stay fixed. All fingers anatomically coherent holding same bottle.
Actual transparent alpha background with NO haze, NO colored glow, NO ground or shadows. No scenery. No extra limbs, no large bottle, no duplicate bottles per person. Crisp clean cutout edges.
