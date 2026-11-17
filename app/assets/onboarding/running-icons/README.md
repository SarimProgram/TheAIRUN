# Running onboarding artwork

`running-icons-v1.webp` is the app's bundled transparent 4 × 4 atlas. Each cell is 256px square, with a 16px transparent inset. All 16 illustrations share one source and cache entry. The app displays them at 52–76pt, without network requests or image transitions.

Generated with the built-in image generation tool using `assets/goals/goal-icons-v1.png` as the style reference. The original sheet is retained at `output/imagegen/running-icons/running-icons-source-v1.png` in the repository workspace, outside the app assets. Alpha transparency is preserved during export.

To regenerate the runtime atlas:

```sh
python app/scripts/export-running-icons.py output/imagegen/running-icons/running-icons-source-v1.png
```

Runtime mapping lives in `components/onboarding/RunningOptionArt.tsx`, read left to right, top to bottom:

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
| --- | --- | --- | --- | --- |
| 1 | 5K bib | 10K bib | Half marathon bib | Personal best stopwatch |
| 2 | Beginner sneaker & sprout | Intermediate sneaker & blocks | Advanced trophy | New runner sneaker & flag |
| 3 | Known pace stopwatch | Race calendar | Flexible calendar | Fuel bowl |
| 4 | Weight loss scale | Faster sneaker | Longer route | Smooth form shoes |

The app keeps navigation arrows and selection checks as vector controls.

## Generation prompt

See `generation-prompt.txt` for the exact prompt used.
