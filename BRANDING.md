# Primetime Branding

## Identity pair

- **Primary — Gold** `#e9c04b` (buttons, headline accents, badges, active nav underline)
  darker gradient stop `#c9971f`
- **Secondary — Silver/steel** `#9aa0aa` (neutral accents, ambient glow, secondary text accents)
- **Background — Near-black** `#050403` / `#0b0906` (dark mode base)
- **Ink** `#050403` (text color placed *on* gold, for contrast — gold is bright enough that
  dark text reads better on it than white)

This is a classic **spotlight / primetime broadcast** palette: black stage, gold light.

## Typography

- **Display (headlines):** Anton — bold, condensed, all-caps treatment for h1/h2
- **Body:** Inter (400–900 weights)

## Light / dark

Both modes are defined in `assets/css/theme-primetime.css`. Dark is the default; light mode
swaps the background to warm off-white/cream tones and darkens gold slightly (`#a9780f`) to
hold AA contrast against the lighter surface. The toggle in the nav persists the visitor's
choice in `localStorage` and respects `prefers-reduced-motion`.

## Why this palette

Gold reads as premium/elite without competing with any specific team's on-field colors, and
pairs cleanly with black for a broadcast/"primetime" feel across all three teams — 10U, 12U,
and Elite 12U — without any one team's identity overpowering the org-level site.

## Extending to team-specific accents

If an individual team (e.g. Primetime Elite 12U) wants its own secondary accent distinct from
the org site, add a scoped override block in `assets/css/theme-primetime.css` keyed to that
team's page (e.g. `body.pt-page.team-elite { --gold-2: ...; }`) rather than changing the
shared tokens, so the org site and other teams stay visually consistent.

## Logo placement

The logo is wired into four spots and needs one file: `public/images/logos/primetime-logo.png`.

- **Nav bar** (every page) — small badge, square crop looks best
- **Footer** (every page) — small badge, same treatment as nav
- **Homepage hero** — large showcase placement (`.logo-showcase` / `.hero-logo-img`), this is
  the one spot that can handle a wide, detailed crest rather than a tight square icon
- **Homepage motto banner** — two small badge instances flanking the tagline

All four have a CSS/JS fallback (`onerror` swaps in a styled text badge) so the site never
shows a broken-image icon if the file is missing or the filename doesn't match exactly.
