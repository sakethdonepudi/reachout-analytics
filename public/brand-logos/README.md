# Column R — mobile brand asset pack

All 30 distinct labels in the supplied `Mobile Brand` column resolve to an asset: 28 named manufacturers and 2 neutral unknown labels. The original workbook and all voting data are unchanged.

## Contents

- `original/`: sourced SVG or PNG artwork, unchanged. SVG is supplied wherever obtained; some rare brands are raster originals.
- `png/`: normalised PNG versions for all 30 labels. Artwork keeps its aspect ratio and colours; surrounding blank space is trimmed for consistent sizing.
- `marker-svg/`: self-contained rounded white marker badges (112×72 viewBox), using the normalised PNG inside an SVG wrapper. These are SVG containers, not newly vectorised logos.
- `marker-png/`: 224×144 PNG versions of the same map badges.
- `brand-map.json`: exact column-label mapping, source paths, marker paths, provenance and original/expanded counts.
- `brand-counts.csv`: reconciliation of all 5,090 source entries and all 30,000 expanded rows.
- `sources.csv`, `source_metadata.json`, `licenses/`: sources, recorded hashes and Simple Icons licence/disclaimer.
- `brand_preview.png` and `preview.html`: visual catalogue of all assets.
- `brand-assets.ts`: case-insensitive lookup and marker URL helper.

## Integration

Copy `original/`, `png/`, `marker-svg/`, `marker-png/` and `brand-map.json` to `public/brand-logos/`. The helper defaults to that URL prefix. Keep the original source images available for larger legends/tooltips; use the marker versions on maps. Do not stretch the marks or tint logos with political colours. Use the surrounding button/halo to show party or selection state. White badge surfaces keep the original artwork legible in both page themes. Names remain visible in the accessible label and hover tooltip.

`Unknown` and `Unknown Android` are neutral device badges, not manufacturers. Google is the Google brand mark, not proof of a specific Pixel handset. CMF uses the sourced CMF-by-Nothing mark; Nokia uses the sourced Nokia corporate mark. These identify the field's brand category; they do not certify model, authenticity or date-specific handset branding.

On the map, group the original entry metadata by the selected AC or qualified district grouping and then by brand. A marker is an aggregate device-category marker, not one independently verified voter. Use the same selected-region state as the poll analysis. Do not populate the map with repeated scenario rows or fabricate handset GPS positions from postal/IP fields. Show brand mix or shares and use the provenance tooltip from the main Conductor prompt.

The assets are sourced from Simple Icons, Wikimedia Commons, the AI+ official store and Seeklogo, with per-file links in sources.csv. Simple Icons' CC0 collection licence is included; source-specific and trademark rights remain with their respective holders. Do not imply manufacturers endorse ReachOut, BRS or the survey. The pack does not provide a blanket trademark or redistribution licence.
