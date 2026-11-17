# Partner Squats: movement atlas

Generated with the built-in image_gen tool, then refined with the same tool to remove the background. Runtime asset: `partner-squats-sheet-v2.png`, 1254 x 1254, four columns and four rows. The original four-cell v1 is retained but no longer used by the app.

- Row 1: marching poses, arms out, overhead reach (warm-up).
- Row 2: standing, quarter squat, half squat, bottom squat (lowering).
- Row 3: bottom hold, rising halfway, rising almost fully, standing (rising).
- Row 4: slow walking poses, cross-body shoulder stretch, breathing (cool-down).

`PartnerSquatArt.tsx` crops the atlas directly. The player advances the eight squat stages over four seconds per demonstration rep, showing 15 reps per one-minute set, for three sets. Its elapsed clock drives both artwork and rep cue, and freezes on pause or expanded instructions. Warm-up switches from marching to reaches after one minute. Cool-down switches from walking to a shoulder stretch after 30 seconds, then to breathing after 45 seconds. Reduce Motion keeps poses still while preserving timing and rep progress. The instruction view also exposes all sixteen frames with captions.

The rep cue demonstrates a pace; it does not measure the user's movement. Users can pause for additional time or rest.

## Generation prompt

Use case: stylized-concept. Create a production exercise animation sprite atlas: EXACTLY FOUR COLUMNS and FOUR ROWS, SIXTEEN equal square cells on a square transparent canvas, preferably 2048x2048. Reference image supplies the two characters and their 3D style. Preserve adult man on LEFT with swept auburn hair, teal T-shirt, charcoal shorts, white trainers; adult woman on RIGHT with auburn ponytail, coral T-shirt, charcoal leggings, white trainers. Minimal smooth peach faces, plain solid WHITE almond eyes, NO pupils, irises, eyebrows or mouths. Same camera, scale, lighting, positions and ground baseline IN EVERY CELL. Full bodies including shoes, hands and hair fit INSIDE their own square with 10 percent padding on ALL edges. Each cell contains the SAME TWO characters; no other people.

This is an animation sheet, so each specified frame MUST show a visibly different joint configuration with smoothly spaced movement stages. Fixed side three-quarter view, faces and white eyes visible. Both stay on their own side throughout.

ROW 1: four WARM-UP poses, partners NOT holding hands, standing upright with space between them:
cell 1 both marching with LEFT knee raised, right arm forward;
cell 2 both marching with RIGHT knee raised, left arm forward;
cell 3 both feet grounded, arms extended out sideways at shoulder level;
cell 4 both feet grounded, arms raised overhead in a gentle reach.

ROW 2: four DOWNWARD partner squat stages, facing each other, BOTH hands joined throughout:
cell 5 tall standing ready, knees straight but soft;
cell 6 quarter squat, knees bent 25 degrees, hips slightly back;
cell 7 half squat, knees bent 55 degrees, hips lower;
cell 8 full comfortable squat, knees bent 90 degrees, thighs approximately parallel.

ROW 3: four UPWARD partner squat stages, still facing and holding both hands:
cell 9 bottom squat with brief controlled pause;
cell 10 rising halfway, knees bent 65 degrees;
cell 11 rising near standing, knees bent 30 degrees;
cell 12 standing tall again, knees soft, hands still joined.

ROW 4: four clearly DIFFERENT COOL-DOWN poses, hands released:
cell 13 slow walking in place with left foot forward, relaxed low arms;
cell 14 slow walking in place with right foot forward, relaxed low arms;
cell 15 both standing and gently drawing one arm across chest in a shoulder stretch;
cell 16 both standing quietly with hands resting over lower ribs for slow breathing.

Anatomically coherent athletic adult proportions, correct hands and limbs, grounded heels during squats, knees track toes, neutral backs. Polished premium 3D animation-render look, sculpted hair, soft studio light. Transparent alpha background throughout. NO background plane, scenery, colored glow, arrows, text, numbers, captions, grid lines, borders or watermark. Keep spacing and margins uniform so exact mathematical 4x4 cropping produces sixteen complete, isolated pairs. Do not repeat the old four-frame sheet: all sixteen requested movement stages are necessary.

## Transparency refinement prompt

Edit target: the supplied 4x4 exercise sprite sheet. Remove ONLY the light cream/white background and ALL ambient haze/shadows behind and between the characters in every cell, including background between arms and bodies. Output genuine fully transparent alpha with alpha 0 in every background pixel, no semitransparent cream matte, no scenery, no floor. Preserve the sixteen pairs of 3D white-eyed teal/coral characters, all poses, their identity, clothing, size, camera and precise 4-column 4-row cell positions unchanged. Preserve clean anti-aliased silhouette edges. Keep complete hands, hair, feet inside each cell. No text or borders. This is a production sprite atlas for animation on light AND DARK app surfaces: all empty space must be invisible. Do not add any new background or colored aura. Square canvas.

