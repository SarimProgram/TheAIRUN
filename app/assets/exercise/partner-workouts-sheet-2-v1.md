# Partner workout sheet 2

Generated with the built-in image_gen tool, using the app's white-eyed teal/coral character reference. Transparent PNG, 1024 x 1536, four columns and six rows. Each workout has eight frames, read left to right across two rows.

- Rows 1–2: Synchronized Lunges. 3 sets × 10 reps per leg. Targets: Legs, Glutes, Balance.
- Rows 3–4: Wall Sit Challenge. 3 rounds × 30–45 seconds. Targets: Thighs, Glutes.
- Rows 5–6: Mountain Climber Race. 3 rounds × 30 seconds. Targets: Core, Cardiovascular endurance.

Warm-up and cool-down reuse the existing partner-squats-sheet-v2.png. Runtime cropping and animation do not create extra image files.

The generated rows are unevenly spaced. Runtime crops use measured row bounds at y=0, 298, 579, 866, 1143, 1339, 1536 instead of uniform 256px slices. This keeps complete wall-sit figures visible and excludes the lunge above. The same correction covers lunges and mountain climbers sharing this sheet. Crops preserve the source aspect ratio.

## Final generation prompt

Create a production TRANSPARENT sprite atlas for a mobile fitness app. EXACT regular grid FOUR COLUMNS by SIX ROWS, 24 equal SQUARE cells, PORTRAIT canvas aspect 2:3, ideally 1536x2304. There are THREE workouts, each with EIGHT sequential movement frames spanning TWO consecutive rows. Reference is ONLY character identity. Every cell shows the same TWO FULL-BODY white-eyed adult fitness characters with generous 12 percent invisible padding. Man: teal T-shirt, charcoal shorts, auburn quiff, white trainers. Woman: coral T-shirt, charcoal leggings, auburn ponytail, white trainers. Smooth peach faces with plain solid WHITE almond eyes, NO pupils, irises, mouth or eyebrows. Premium polished 3D sculpted style. No third person. Same scale, camera and ground baseline throughout each workout sequence. Full limbs, hands, shoes and hair MUST fit inside their own cells. Accurate human anatomy and hand/foot support. The couples perform the specified exercise, not standing in place. Use side three-quarter view for floor exercise to see supported hands and feet.
ROWS 1 and 2: Synchronized Lunges. Stand side by side and step backwards into lunges together.
Cell 1: Stand side by side, feet hip width, hands on hips.
Cell 2: Both step LEFT leg backwards, right foot remains planted.
Cell 3: Both lower left knee toward floor into reverse lunge, front right knee near ninety degrees.
Cell 4: Both press through right foot, bring left foot forward to standing.
Cell 5: Stand together ready to switch legs.
Cell 6: Both step RIGHT leg backwards, left foot remains planted.
Cell 7: Both lower right knee toward floor into reverse lunge, front left knee near ninety degrees.
Cell 8: Both press through left foot, return right foot to standing.

ROWS 3 and 4: Wall Sit Challenge. Sit against a wall with your knees bent and challenge each other to hold the position.
Cell 9: Both stand side by side with backs touching a short isolated neutral wall panel, feet stepped forward.
Cell 10: Both slide down wall a quarter way, knees begin bending.
Cell 11: Both slide down wall halfway.
Cell 12: Both reach seated wall-sit, thighs nearly parallel, knees over ankles.
Cell 13: Both hold wall-sit, hands resting lightly on thighs.
Cell 14: Both hold same position with very subtle breathing, shoulders relaxed.
Cell 15: Both hold wall-sit steadily, backs supported.
Cell 16: Both maintain wall-sit, feet grounded, no movement out of hold.

ROWS 5 and 6: Mountain Climber Race. Both get into a plank position and alternate driving your knees forward.
Cell 17: Both side by side in a high plank, hands under shoulders.
Cell 18: Both draw left knee halfway toward chest.
Cell 19: Both drive left knee forward under torso, right leg extended.
Cell 20: Both extend left leg back to plank.
Cell 21: Both stable in plank switching sides.
Cell 22: Both draw right knee halfway toward chest.
Cell 23: Both drive right knee forward under torso, left leg extended.
Cell 24: Both extend right leg back to plank.
CRITICAL BACKGROUND REQUIREMENT: output ONLY characters on GENUINE TRANSPARENT ALPHA. Empty pixels must have alpha ZERO. No white or cream background, NO checkerboard pattern drawn into image, NO background grid, NO cell borders, NO floor, NO shadow plane, NO environment, NO colored halo or fog. For wall sit ONLY include a small isolated neutral wall panel directly supporting their backs, with transparent empty space around the panel. No text, captions, numbers, logos, arrows or watermark. Do not render a poster or contact sheet on paper. This is a transparent PNG sprite asset for compositing onto dark app backgrounds. Precisely FOUR columns and SIX rows; 24 isolated pairs, 8 frames per workout.

