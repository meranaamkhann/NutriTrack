# NutriTrack frontend redesign: what changed

Direction: the nutrition label. Black on white, heavy rules between sections, one highlighter yellow, red only for "over target" and destructive actions. One font family (Archivo). Macros are told apart by pattern (solid / hatched / yellow), not only colour.

## How to apply
Copy the files in this folder over `frontend/` (same paths), then delete the files in "Delete" below.
Do NOT touch `package.json` or `package-lock.json`.

```
cd frontend && npm install && npm test && npm run dev
```
Checked here: `tsc -b` clean, 34/34 frontend tests pass, `npm run build` OK, screenshots in `shots/`.

## Delete
- `src/components/CalorieRing.tsx`, `src/components/MacroBar.tsx` (unused, nothing imported them)
- `src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg` (Vite template leftovers)

## Rewritten (new layout / look)
| File | What changed |
|---|---|
| `src/index.css` | New tokens (paper, wash, ink, mark, alert, focus), Archivo font, bar patterns, reduced-motion |
| `src/components/ui.tsx` | Panel = white label with heavy top rule; square-ish buttons; 2px black inputs; Tabs = black active tab; square badges |
| `src/components/AppShell.tsx` | Sidebar replaced by a top bar (wordmark, text nav, log out). Mobile keeps bottom tabs, now with a Log out on top |
| `src/components/AuthLayout.tsx` | Green gradient + leaf art removed. White panel, huge headline, ruled list |
| `src/components/SummaryHero.tsx` | Ring + green card replaced by a label: big "kcal left", calorie bar, patterned macro bars with % of target |
| `src/components/diary/MealSection.tsx` | Icon circles removed; ruled section header, kcal subtotal, square + button |
| `src/components/diary/EntryRow.tsx` | Names wrap on phones instead of truncating; underlined Edit/Remove |
| `src/components/icons.tsx` | New LogoMark (label glyph) |
| `public/favicon.svg` | Was the default Vite logo. Now the label glyph |

## Restyled (small edits)
`DateNav`, `PasswordInput`, `AddPanel`, `lib/toast.tsx`, `pages/Dashboard`, `pages/Setup` (target box), plus every page: old colour names renamed, all-caps eyebrow headings removed, links underlined.

## Token rename (so you can grep your own code)
pine -> ink, pine-tint -> wash, gold -> mark, gold-tint -> mark-tint, brick -> alert, brick-tint -> alert-tint.
All `rounded-lg/xl/2xl/md` -> `rounded-sm`.

## Still on you
- Archivo loads from Google Fonts. Self-host it if you want no external request.
- I only screenshotted Diary, Add food, and Login. Click through Foods, Recipes, Weight, Progress, Settings, Setup once. They inherit the new tokens but I didn't review each by eye.
- Product names/copy are unchanged on purpose (tests pin some of it).
