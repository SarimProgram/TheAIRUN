# Partner Kcals widget artwork

Legacy full-background concept. The active widget now uses the independent [v2 character cutouts and native panels](partner-kcals-cutouts-v2.md).

Generated using the built-in image generation tool from the user's supplied visual reference.

- `partner-kcals-background-v1.png`: full resolution source artwork.
- `partner-kcals-background-v1.jpg`: 1095 × 517 runtime asset, downsampled with Pillow, quality 90.
- Names, calorie totals, labels and sync status are rendered by SwiftUI, never baked into the image.
- The generic illustrative couple is decoration; it does not represent account profile photos.
- Runtime artwork is copied into the existing iOS app group so the widget extension can read it.

## Generation prompt

Use case: stylized-concept. Production background illustration for a wide 360 × 170 point iOS PartnerKcals widget. Match the supplied reference's friendly premium 3D clay fitness couple, soft cyan left and blush pink right. Equal cyan and pale pink halves with a soft central blend. Adult man with brown wavy hair, teal fitness shirt and shorts, teal sneakers and smartwatch at the extreme left, facing inward. Adult woman with auburn ponytail, coral fitness shirt and shorts, coral sneakers and smartwatch at the extreme right, facing inward. Rounded, stocky adult proportions and simple friendly eyes. Entire bodies and shoes visible, gentle grounded shadows. Figures occupy only the outermost 22 percent of each side. Center 56 percent clear for live text. Two empty soft off-white calorie pill surfaces spanning x=23–47% and x=53–77%, y=43–80%. Blank space above for names. Small white circular heart medallion on the seam at x=50%, y=27%. Soft studio lighting, matte materials, legible small silhouettes. No text, numbers, lettering, watermark, or additional people.

## Final correction prompt

Replace all black outside-corner regions with adjacent cyan or pink background. Output a full-bleed rectangular image with square corners, preserving both characters, positions, clothing, faces, blank calorie surfaces, heart, colors, lighting, composition and aspect ratio. No text or numbers. The OS applies its own rounded clipping.

## Validation

Compiled Expo/Babel render checks cover both participants, remaining calories, over target, missing partner, stale data, legacy snapshots and saved reminder fields across supported sizes and themes. Partner Kcals always displays calorie data; saved hydration and motivation fields are ignored. Browser previews are design approximations. Native WidgetKit rendering and shared-container image access still require an iOS device or Mac simulator.
