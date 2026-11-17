import type { MobilityExercise } from './GuidedMobility';

export type PartnerWorkoutDefinition = {
  id: string; name: string; description: string; prescription: string; targets: string[];
  setLabel: string; seconds: number; count: number | null; countUnit: string | null;
  cycleMs: number; category: 'Strength' | 'Cardio' | 'HIIT' | 'Fun';
  bodyPart: MobilityExercise['bodyPart']; role: MobilityExercise['selectionRole'];
  poses: string[]; instructions: string[];
};

export const PARTNER_WORKOUTS: PartnerWorkoutDefinition[] = [
  {
    "id": "partner-squats",
    "name": "Partner Squats",
    "description": "Face each other, hold hands, and squat together.",
    "prescription": "3 sets × 15 reps",
    "targets": [
      "Legs",
      "Glutes",
      "Core"
    ],
    "setLabel": "15 reps",
    "seconds": 60,
    "count": 15,
    "countUnit": "Rep",
    "cycleMs": 4000,
    "category": "Strength",
    "bodyPart": "Lower Body",
    "role": "lower",
    "poses": [
      "Stand ready and hold hands",
      "Begin lowering together",
      "Lower halfway",
      "Reach a comfortable squat",
      "Hold briefly at the bottom",
      "Rise halfway together",
      "Keep rising with control",
      "Stand tall together"
    ],
    "instructions": [
      "Face each other with feet shoulder-width apart and hold both hands.",
      "Keep your heels grounded and sit your hips back as you bend your knees together.",
      "Lower to a comfortable depth, keeping your chest lifted and knees in line with your toes.",
      "Press through your feet to stand together. Complete 15 reps, rest as needed, and repeat for 3 sets."
    ]
  },
  {
    "id": "plank-high-fives",
    "name": "Plank High-Fives",
    "description": "Face each other in plank position and alternate high-fives while keeping your hips steady.",
    "prescription": "3 sets × 20 taps total",
    "targets": [
      "Abs",
      "Shoulders",
      "Core"
    ],
    "setLabel": "20 taps total",
    "seconds": 60,
    "count": 20,
    "countUnit": "Tap",
    "cycleMs": 6000,
    "category": "Strength",
    "bodyPart": "Core",
    "role": "core",
    "poses": [
      "Stable high plank facing each other, both hands on floor",
      "Both lift right hand toward each other, left hand supporting",
      "Right palms touch in a gentle high-five, hips level",
      "Both return right hands to floor, steady plank",
      "Both lift left hand toward each other, right hand supporting",
      "Left palms meet in a gentle high-five",
      "Both lower left hands with hips steady",
      "Return to stable two-hand high plank"
    ],
    "instructions": [
      "Face each other in a high plank, hands under shoulders and feet wide enough for balance.",
      "Keep your hips steady as you lift one hand to high-five your partner.",
      "Return your hand to the floor and switch sides. Each high-five counts as one tap; complete 20 total.",
      "Repeat for 3 sets. Lower your knees if you need an easier version."
    ]
  },
  {
    "id": "couple-push-up-challenge",
    "name": "Couple Push-Up Challenge",
    "description": "Perform push-ups together. Try to match your partner's pace.",
    "prescription": "3 sets × 8–12 reps",
    "targets": [
      "Chest",
      "Arms",
      "Shoulders"
    ],
    "setLabel": "8–12 reps",
    "seconds": 48,
    "count": 12,
    "countUnit": "Rep",
    "cycleMs": 4000,
    "category": "Strength",
    "bodyPart": "Upper Body",
    "role": "upper",
    "poses": [
      "Both side by side facing same direction in high plank, straight arms",
      "Both bend elbows slightly, lower chest a quarter way",
      "Both lower halfway, elbows angle back naturally",
      "Both at bottom push-up, chest near floor, straight body",
      "Brief controlled bottom hold",
      "Both press up halfway",
      "Both press up almost fully",
      "Both return to high plank, arms straight"
    ],
    "instructions": [
      "Start side by side in a high plank with hands just wider than your shoulders.",
      "Bend your elbows and lower your chest with your body in a straight line.",
      "Press back up together, matching a comfortable pace.",
      "Complete 8–12 reps for each of 3 sets. Use your knees for support if needed."
    ]
  },
  {
    "id": "partner-sit-ups",
    "name": "Partner Sit-Ups",
    "description": "Sit facing each other with knees bent, perform sit-ups, and high-five at the top.",
    "prescription": "3 sets × 12 reps",
    "targets": [
      "Abdominal muscles"
    ],
    "setLabel": "12 reps",
    "seconds": 60,
    "count": 12,
    "countUnit": "Rep",
    "cycleMs": 5000,
    "category": "Strength",
    "bodyPart": "Core",
    "role": "core",
    "poses": [
      "Both lying on backs head away from each other, knees bent, feet near each other",
      "Both curl shoulders gently off floor",
      "Both rise halfway toward seated position",
      "Both sit tall facing each other, palms reaching forward",
      "Both gently high-five at top, knees still bent",
      "Both begin controlled descent, hands release",
      "Both lower halfway, shoulders above floor",
      "Both return to lying backs down, knees bent"
    ],
    "instructions": [
      "Sit facing each other with knees bent, feet flat, and enough space for both partners.",
      "Lower your back toward the floor, then sit up with control.",
      "High-five at the top without pulling on each other.",
      "Complete 12 reps for each of 3 sets. Use a smaller curl-up if that feels better."
    ]
  },
  {
    "id": "synchronized-lunges",
    "name": "Synchronized Lunges",
    "description": "Stand side by side and step backwards into lunges together.",
    "prescription": "3 sets × 10 reps per leg",
    "targets": [
      "Legs",
      "Glutes",
      "Balance"
    ],
    "setLabel": "10 reps per leg",
    "seconds": 80,
    "count": 20,
    "countUnit": "Rep",
    "cycleMs": 8000,
    "category": "Strength",
    "bodyPart": "Lower Body",
    "role": "lower",
    "poses": [
      "Stand side by side, feet hip width, hands on hips",
      "Both step LEFT leg backwards, right foot remains planted",
      "Both lower left knee toward floor into reverse lunge, front right knee near ninety degrees",
      "Both press through right foot, bring left foot forward to standing",
      "Stand together ready to switch legs",
      "Both step RIGHT leg backwards, left foot remains planted",
      "Both lower right knee toward floor into reverse lunge, front left knee near ninety degrees",
      "Both press through left foot, return right foot to standing"
    ],
    "instructions": [
      "Stand side by side with feet hip-width apart and room to step back.",
      "Step one foot backwards and bend both knees, keeping your front heel planted.",
      "Push through the front foot to return to standing, then switch legs.",
      "Complete 10 reps on each leg for 3 sets, matching your partner's pace."
    ]
  },
  {
    "id": "wall-sit-challenge",
    "name": "Wall Sit Challenge",
    "description": "Sit against a wall with your knees bent and challenge each other to hold the position.",
    "prescription": "3 rounds × 30–45 seconds",
    "targets": [
      "Thighs",
      "Glutes"
    ],
    "setLabel": "30–45 seconds",
    "seconds": 45,
    "count": null,
    "countUnit": null,
    "cycleMs": 8000,
    "category": "Strength",
    "bodyPart": "Lower Body",
    "role": "lower",
    "poses": [
      "Both stand side by side with backs touching a short isolated neutral wall panel, feet stepped forward",
      "Both slide down wall a quarter way, knees begin bending",
      "Both slide down wall halfway",
      "Both reach seated wall-sit, thighs nearly parallel, knees over ankles",
      "Both hold wall-sit, hands resting lightly on thighs",
      "Both hold same position with very subtle breathing, shoulders relaxed",
      "Both hold wall-sit steadily, backs supported",
      "Both maintain wall-sit, feet grounded, no movement out of hold"
    ],
    "instructions": [
      "Stand with your backs against a wall and step your feet forward.",
      "Slide down until your knees are comfortably bent, keeping your knees over your ankles.",
      "Hold for 30–45 seconds, breathing steadily. Stand sooner if you need to rest.",
      "Complete 3 rounds. Use a shallower bend to make the hold easier."
    ]
  },
  {
    "id": "mountain-climber-race",
    "name": "Mountain Climber Race",
    "description": "Both get into a plank position and alternate driving your knees forward.",
    "prescription": "3 rounds × 30 seconds",
    "targets": [
      "Core",
      "Cardiovascular endurance"
    ],
    "setLabel": "30 seconds",
    "seconds": 30,
    "count": null,
    "countUnit": null,
    "cycleMs": 1600,
    "category": "HIIT",
    "bodyPart": "Full Body",
    "role": "core",
    "poses": [
      "Both side by side in a high plank, hands under shoulders",
      "Both draw left knee halfway toward chest",
      "Both drive left knee forward under torso, right leg extended",
      "Both extend left leg back to plank",
      "Both stable in plank switching sides",
      "Both draw right knee halfway toward chest",
      "Both drive right knee forward under torso, left leg extended",
      "Both extend right leg back to plank"
    ],
    "instructions": [
      "Start side by side in a high plank with hands under shoulders.",
      "Drive one knee toward your chest, then return it to the starting position.",
      "Alternate legs while keeping your hips steady and shoulders above your hands.",
      "Move for 30 seconds per round for 3 rounds. Choose control over speed."
    ]
  },
  {
    "id": "jumping-jacks-together",
    "name": "Jumping Jacks Together",
    "description": "Do jumping jacks in sync, keeping a steady rhythm.",
    "prescription": "3 rounds × 45 seconds",
    "targets": [
      "Full-body cardio"
    ],
    "setLabel": "45 seconds",
    "seconds": 45,
    "count": null,
    "countUnit": null,
    "cycleMs": 2000,
    "category": "Cardio",
    "bodyPart": "Full Body",
    "role": "lower",
    "poses": [
      "Both standing side by side, feet together, arms down",
      "Both start jumping feet out, arms lifting diagonally",
      "Both feet opening wider, arms raised to shoulder height",
      "Both at open jumping-jack, feet wide and arms overhead",
      "Both begin closing, arms slightly below overhead",
      "Both bring feet inward and lower arms through shoulder height",
      "Both almost feet together, arms near sides",
      "Both land softly feet together, arms fully down"
    ],
    "instructions": [
      "Stand side by side with feet together and arms relaxed.",
      "Jump your feet apart while raising your arms overhead.",
      "Jump your feet together while lowering your arms, landing softly.",
      "Keep a steady rhythm for 45 seconds per round, for 3 rounds. Step out one foot at a time for a low-impact option."
    ]
  },
  {
    "id": "glute-bridge-challenge",
    "name": "Glute Bridge Challenge",
    "description": "Lie on your backs, bend your knees, and raise your hips together. Hold briefly at the top.",
    "prescription": "3 sets × 15 reps",
    "targets": [
      "Glutes",
      "Hips",
      "Hamstrings"
    ],
    "setLabel": "15 reps",
    "seconds": 60,
    "count": 15,
    "countUnit": "Rep",
    "cycleMs": 4000,
    "category": "Strength",
    "bodyPart": "Lower Body",
    "role": "posterior",
    "poses": [
      "Both lying side by side on backs, knees bent, feet planted, arms resting on floor",
      "Both lift hips a quarter way, shoulders grounded",
      "Both lift hips halfway",
      "Both at top bridge, shoulders hips and knees form straight line",
      "Both hold briefly at top, neutral neck, no back arch",
      "Both lower hips halfway with control",
      "Both lower hips almost to floor",
      "Both return hips to floor, knees still bent"
    ],
    "instructions": [
      "Lie side by side on your backs with knees bent and feet flat, hip-width apart.",
      "Press through your heels and raise your hips until shoulders, hips, and knees form a line.",
      "Hold briefly at the top, then lower with control without arching your back.",
      "Complete 15 reps for each of 3 sets."
    ]
  },
  {
    "id": "couple-dance-cardio",
    "name": "Couple Dance Cardio",
    "description": "Put on your favourite music and dance continuously together.",
    "prescription": "5–10 minutes",
    "targets": [
      "Cardio",
      "Coordination",
      "Endurance"
    ],
    "setLabel": "5–10 minutes",
    "seconds": 300,
    "count": null,
    "countUnit": null,
    "cycleMs": 4000,
    "category": "Fun",
    "bodyPart": "Full Body",
    "role": "lower",
    "poses": [
      "Both standing side by side, relaxed knees, arms bent casually",
      "Both step left with a light bounce, arms swing right",
      "Both bring feet together with a small knee bend",
      "Both step right with a light bounce, arms swing left",
      "Both bring feet together and clap at chest height",
      "Both lift left knee lightly and raise right hand",
      "Both lift right knee lightly and raise left hand",
      "Both return to relaxed center stance ready to repeat"
    ],
    "instructions": [
      "Choose your favourite music on your own music app and make space to move.",
      "Start with easy side steps, arm swings, or any comfortable dance moves.",
      "Keep moving together for 5–10 minutes, matching a pace where you can still talk.",
      "Choose a five- or ten-minute guided session. Keep your own music playing while you move."
    ]
  }
];

export function findPartnerWorkout(id?: string) {
  return PARTNER_WORKOUTS.find(workout => workout.id === id);
}

