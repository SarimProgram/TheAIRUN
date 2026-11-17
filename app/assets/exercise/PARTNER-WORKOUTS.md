# Partner workout artwork

Created with the built-in image_gen tool, using the app's white-eyed teal/coral characters. Nine new workouts share three transparent 1024 x 1536 PNG atlases. Each atlas has 24 square cells (four columns, six rows), giving eight demonstration frames per workout, 72 new frames total. Warm-up and cool-down reuse the existing squat atlas; no separate warm-up, cool-down or thumbnail images were generated.

| Workouts | Runtime PNG | Final generation prompt |
| --- | --- | --- |
| Plank High-Fives, Couple Push-Up Challenge, Partner Sit-Ups | [Sheet 1](partner-workouts-sheet-1-v1.png) | [Prompt 1](partner-workouts-sheet-1-v1.md) |
| Synchronized Lunges, Wall Sit Challenge, Mountain Climber Race | [Sheet 2](partner-workouts-sheet-2-v1.png) | [Prompt 2](partner-workouts-sheet-2-v1.md) |
| Jumping Jacks Together, Glute Bridge Challenge, Couple Dance Cardio | [Sheet 3](partner-workouts-sheet-3-v1.png) | [Prompt 3](partner-workouts-sheet-3-v1.md) |

Runtime files are cropped and animated directly in the app, with pause and Reduce Motion support. Rep/tap cues demonstrate a pace rather than measuring the user's movement. Push-ups retain the 8–12 rep range, wall sits retain the 30–45 second range (45-second guide), and dance sessions offer five or ten minutes. All workouts include the shared two-minute warm-up and one-minute cool-down.

Validation: all ten catalog entries have complete guided sessions; seven clock/prescription tests pass; ESLint passes for changed workout files. Atlas checks confirm four referenced PNGs exist, preserve alpha, have square cells, and contain every required frame range. New atlas background checks sampled all four margins of every cell; all 288 samples had alpha at most 2/255. No TypeScript errors were reported in changed workout files; existing errors elsewhere prevent the full project check from passing. Simulator playback remains unverified because no emulator is available in this workspace.
