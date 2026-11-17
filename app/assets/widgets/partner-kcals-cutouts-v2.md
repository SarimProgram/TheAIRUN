# Partner Kcals cutouts and layout

The active widget uses `partner-kcals-man-v2.png` and `partner-kcals-woman-v2.png`, two independent 192 × 288 RGBA PNGs. The previous complete background image is no longer rendered. All cards, backgrounds, names, totals and labels are native SwiftUI elements.

Each person's saved profile gender selects their own artwork independently. The API, cached live payload and local Home updates all carry user/partner gender. Missing gender uses the native neutral person symbol. A female cutout on the left or male cutout on the right is mirrored so both face inward. Ordinary calorie updates preserve gender; explicit unset clears the previous artwork.

Generated with the built-in image generation tool, using `partner-kcals-background-v1.png` as the reference. Runtime assets were downsampled with Pillow while preserving alpha.

## Prompts

Extract ONLY the man from the left side of the reference as a full-body transparent PNG cutout. Preserve his adult clay character design, stocky proportions, face, brown wavy hair, teal shirt and shorts, teal shoes, smartwatch, standing inward-facing pose, matte 3D lighting. Remove all backgrounds, the woman, heart, panels and other objects. Full body including shoes, small transparent margins. Portrait canvas. Actual transparent alpha, no painted checkerboard, floor or text. This is an iOS widget asset.

Extract ONLY the woman from the right side of the reference as a full-body transparent PNG cutout. Preserve her adult clay character design, stocky proportions, face, auburn ponytail, coral shirt and shorts, coral shoes, smartwatch, standing inward-facing pose, matte 3D lighting. Remove all backgrounds, the man, heart, panels and other objects. Full body including shoes, small transparent margins. Portrait canvas. Actual transparent alpha, no painted checkerboard, floor or text. This is an iOS widget asset.

Cleanup for each: remove colored glow, aura, vignette, haze and shadow surrounding the character. Keep the character, face, hair, clothes, hands, legs, shoes, pose, colors and dimensions. Clean silhouette, transparent outside the character. No black background or checkerboard. Entire body visible.

## Size constraints

- Medium: two equal horizontal panels. Each has a portrait beside a centred name, calorie total and coloured flame/unit row. Portraits use 68 × 128 point frames at 1.6× internal magnification, bottom-aligned in full-height clipped lanes with a 10 point downward offset.
- Small: two stacked horizontal panels, each with a 46 × 64 point portrait beside its calorie text. Portrait lanes align to the bottom of each half with 1.15× magnification and a 6 point downward offset.
- Artwork intentionally extends below its lane, like a negative bottom margin. Each lane and the outer widget clip that artwork; text stays inside ordinary layout bounds.
- Cream and blush native surfaces fill the entire widget, with corresponding dark theme surfaces. The title and update time are omitted.
- Names truncate independently; five-digit values use smaller type.
- Fixed height and flexible width use separate frame modifiers because Expo ignores flexible dimensions on a frame with fixed dimensions.
- No root image, screen-relative columns or ignored safe areas. Offsets apply only to bottom-anchored artwork, inside clipped portrait lanes.
- Mapped cards are the sole children of their containing stack, matching Expo's native child parser.

## Validation scope

The compiled Expo layout is evaluated in isolation for development/production and Hermes/default transforms. Tests simulate the native renderer's handling of nested child arrays and inspect text, cutout bounds and frame constraints.

`output/partner-kcals/check-cutout-layout.cjs` renders the compiled tree through a browser flexbox approximation and checks dimensions, overlapping siblings and numeric clipping at small and medium widget sizes, in light/dark themes and with normal, long-name, over-target, missing-data, disconnected, stale and missing-artwork states. Its screenshots are previews, not native WidgetKit screenshots. iOS device/simulator verification remains necessary; the Windows workspace cannot run WidgetKit.
