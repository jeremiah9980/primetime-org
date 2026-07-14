# Image guide

This site has no build step — images are referenced directly by path (e.g. `/images/logos/primetime-mark.png`) or by full `https://` URL. Every image tag also has a matching `*Alt` text; keep alt text meaningful for accessibility.

| Folder | Use | Recommended size |
| --- | --- | --- |
| `logos/` | Org + team marks, favicon source | Square, 512x512px, transparent PNG/SVG |
| `hero/` | Homepage/team hero backgrounds | 1920x1080px, optimized JPG/WebP |
| `coaches/` | Coach headshots | 400x400px, square crop |
| `players/` | Player profile photos | 400x400px, square crop |
| `gallery/` | Team/game photos | 1200px wide max, optimized JPG/WebP |
| `sponsors/` | Sponsor logos | 400px wide, transparent PNG on white/neutral background |
| `backgrounds/` | Texture/pattern backgrounds | 1920px wide, optimized |

Until real images are added, the site falls back gracefully: team badges show initials (e.g. "PT", "10U"), and media grids show empty gold-tinted tiles. Nothing looks broken with a partial site.

Avoid baking text into images (like schedules or scores) — use the live HTML sections instead so content stays editable and accessible.
