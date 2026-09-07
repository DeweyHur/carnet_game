# Carnet Drive Club art

Original project artwork generated on 2026-09-07 with the built-in `image_gen` tool (imagegen skill). No CLI/API fallback was used. The PNGs are committed here and loaded from the application's base URL. The original generated alpha is preserved on the vehicle and building atlases. The skyline is opaque. These images depict an artistic European city, not surveyed buildings along the navigation route.

| File | Size | Contents |
| --- | --- | --- |
| `vehicles.png` | 1536 × 1024, RGBA | Soleil GT player coupe and five traffic vehicles, arranged in 3 × 2 cells |
| `buildings.png` | 1536 × 1024, RGBA | Three separate European storefront / apartment sprites, 3 × 1 cells |
| `skyline.png` | 1536 × 1024, RGB | Golden-hour European city panorama |

Vehicle frame rectangles are defined in `src/ui/driveCanvas.ts`. Tight source rectangles exclude neighbouring cells; the player portrait uses the same first frame. Buildings use equal 512 × 1024 cells. Road geometry, film pickups, barriers, lamps, water, exhaust, drift smoke and speed trails are rendered in Canvas. No competitor's vehicle models, interface assets or artwork were copied.

## Generation prompts

### vehicles.png

```text
Use case: stylized-concept. Asset type: production game vehicle sprite atlas for an original premium mobile city driving arcade game, Carnet. Create ONE transparent PNG sprite atlas, landscape 1536x1024, an exact 3 columns by 2 rows grid of six isolated vehicles. Each equal 512x512 cell has one vehicle, centered horizontally, tires on the same ground baseline at 80% cell height, generous transparent margin. Consistent rear chase-camera view, looking toward the back of the vehicle from slightly above (see rear bumper and roof), orthographic-ish perspective, front points away/up image. All vehicles complete and separate, no background, no ground planes, no embedded shadows, genuine alpha transparency. Row 1: (1) gorgeous golden-yellow European rally sport coupe with wide fenders, black panoramic rear glass, paired red LED tail lights, cream twin racing stripes, visible rear tires and black diffuser, (2) teal elegant hatchback with black glass and red tail lights, (3) coral red compact sport coupe. Row 2: (1) cream delivery van with twin rear doors, (2) midnight blue sporty sedan, (3) violet premium coupe. Style: exceptionally polished stylized 3D rendered game art, dimensional sculpted body panels, beautiful warm sunlight upper left, subtle reflective clearcoat, crisp wheel detail and dark windows. A credible little sports car, not a face or character, no eyes. All six use identical camera and lighting. No text, logos, labels, watermark, grid lines, scenery, checkerboard, cast shadows. The asset is consumed as six fixed sprite cells; strict spacing and alignment are essential.
```

### skyline.png

```text
Use case: stylized-concept. Asset type: panoramic background painting for a polished original mobile city racing game Carnet. Generate a landscape 1536x1024 illustration, no text. Scene: a gorgeous European riverside city at golden hour, French limestone Haussmann rooftops, blue slate mansards, copper domes, spires, green treetops, distant pale hills, subtle warm atmospheric haze. Art: premium stylized 3D game environment, beautiful painterly detail and confident clean silhouettes, warm apricot light, turquoise and dusty indigo shadows, golden highlights, pale peach and lavender sky. Composition purpose: parallax skyline backdrop BEHIND a procedurally rendered driving road. The top 52 percent of the image is open sky with beautifully soft clouds and a warm glowing sun near upper right. Across bottom 48 percent layers of exquisite dense city roofscape viewed from elevated chase-camera height, relatively even skyline. No prominent foreground roads, cars, people, UI, lettering, logos, borders, Eiffel Tower, or specific recognizable monuments: generic European city that can work in multiple cities. Beautiful coherent high-production-value art, cinematic and inviting, not flat vector or clip art.
```

### buildings.png

```text
Use case: stylized-concept. Asset type: production roadside building sprite atlas for original premium mobile city driving game Carnet. ONE transparent landscape PNG atlas 1536x1024 with an exact 3 column by 1 row layout, each equal 512x1024 cell contains one complete beautiful European city building, generous transparent margins, base aligned at 92 percent image height. Three SEPARATE isolated buildings, no connection or street between them. Cell 1: 5-story cream Parisian Haussmann corner apartment, blue slate mansard roof, ornate dormers, wrought iron balconies, warm lit ground-floor café with red/cream striped awning. Cell 2: tall 6-story dusty rose townhouse with turquoise shutters, rooftop chimneys, green café awnings and ground floor shop windows. Cell 3: 4-story ivory stone boutique hotel, copper mansard roof, dark green storefront, warm illuminated windows and delicate balcony planters. Consistent perspective: mostly frontal street-facing facades with just a little right side visible, camera close to ground level (not top down), vertical lines vertical. Highly polished stylized 3D game render, warmly lit from upper left at sunset, realistic dimensional details but stylized inviting proportions, rich warm stone, teal glass reflections. Each building entirely contained within its own 512-pixel-wide cell, no overlap, no cropping. GENUINE transparent background, NO sky, ground, cast shadow, floor, scenery, people, cars, signs, text, letters, logos, labels, frame, grid lines or checkerboard. Intended to be drawn as tall roadside billboard sprites with perspective scaling.
```
