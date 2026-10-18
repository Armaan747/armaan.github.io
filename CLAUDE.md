# Portfolio site: Mohammed Armaan

Static portfolio for a fresher aiming at UAV design roles in India (fixed-wing and rotorcraft).
Hosted on GitHub Pages at https://armaan747.github.io/armaan.github.io/ (repo `armaan747/armaan.github.io`).
It is a project site, so the base path is `/armaan.github.io/`. Always use **relative URLs**, never a leading slash.

## Principles
- Clean and minimal. The goal is to look like someone who means business and gets down to work.
- No unnecessary animation, no gradients, no neon or RGB colours, no scroll effects, no carousels, no emoji.
- Light and dark themes follow the device (`prefers-color-scheme`) by default. A header button (`js/theme.js`) lets the visitor override it; the choice is saved in localStorage and applied via `data-theme` on `<html>` before first paint. Never blind a recruiter with a white flash.
- Plain HTML, CSS and JS. No build step, no framework, no npm dependencies on the site. Keep it that way.
- Accessible: semantic headings, alt text on every meaningful image, visible focus states, labels on controls, works with keyboard.
- Mobile first. Nothing may scroll sideways at 390 px wide.
- Prefer small, reviewable changes. Show a diff before committing.

## Design skills
Design skills are installed locally in `.claude/skills/` (kept out of git): `frontend-design`, `minimalist-ui`, `redesign-existing-projects`, plus Impeccable if installed. Use them for critique and direction, but the Principles above always win. In particular ignore any skill advice to add gradients, background photos, placeholder images (picsum), animation, emoji, or photos of people, and do not pull in fonts or assets from a CDN. Before any visual change, show a mock and get approval, and do not re-add a drawing, stats strip or section numbers (rejected earlier).

## Layout
- `index.html`: single-page home (Projects, Experience, Publications, Skills, Contact). The flagship project card has a thumbnail.
- `variable-stability-uav.html`: project page with the 3D viewer, CFD table, figures and build notes. Each new project gets its own page, copied from this one.
- `cessna-172.html`: Cessna project page with the section-slider viewer (`models/cessna172.stl`, 166k triangles, same origin as the original SolidWorks export). Its home-page card also has a live viewer. The page also carries the project write-up from the author's minor-project report (first airframe: design basis, structure, components, assembly, first-flight failure analysis; the XFLR5/CFD section was removed on purpose as too rudimentary, do not re-add it) and the rebuild section with an embedded LinkedIn flight video. That iframe is the one deliberate third-party embed on the site (the author asked for it); keep an "Open it on LinkedIn" fallback link next to it. The report lists a second member who did not work on this project: do not credit him.
- `rover.html`, `js/viewer-rover.js`, `models/rover.stl`: lunar rover prototype page, covering only the author's part (detailed design and additive manufacturing of the prototype, components, field tests); the rover concept, analysis and report are Gopika Sankar's graduation project, so keep the credit line. The web STL is a decimated copy (about 200k triangles, 10 MB) of the 1M-triangle CAD export; the original (`talktoclaude/rover/rover.STL`, 47 MB) stays out of git. Regenerate any web STL the same way rather than shipping a huge one. The page calls the model "CAD model": the CAD shows two crew seats the built prototype does not appear to have, so do not call it the printed prototype until confirmed. Its limitation (sinks and loses traction on very soft sand) must stay on the page.
- `lander.html`, `js/viewer-lander.js`, `models/lander.stl`: PlanetX CubeSat lander page (2nd place, Dubai Airshow 2025). The author did all the CAD, rapid prototyping and DfAM in a team of four (do not name the others). The STL is the final CAD with a dummy 1U cube, used as is (67k triangles). Simulations (ANSYS) and the deck's g-force claim are left off on purpose. The home card carries a live viewer, ids `lander-viewer`/`lander-canvas`/`lander-status`. Source folder `talktoclaude/lander/` stays out of git.
- `styles.css`: all styling, using CSS variables (`--bg --text --muted --line --accent --surface`). The accent is aviation orange (#c2410c light, #ff9a4d dark). Aviation touches are type-led: a dashed centreline rule above each h2, and small-caps labels with tabular numerals on spec lines (`dl.plate`) and readouts. The dark overrides sit in a `@media (prefers-color-scheme: dark)` block plus a matching `:root[data-theme="dark"]` rule.
- `js/viewer-core.js`: shared stage (renderer, camera, orbit, resize, theme). `js/viewer.js` (UAV) and `js/viewer-cessna.js` (Cessna, two section sliders, one active at a time, stencil-capped cut) build on it. Import it with the same `?v=N` as the pages.
- `js/theme.js`: light/dark toggle, loaded in the head of every page. The dark variables in `styles.css` exist twice (media query and `[data-theme="dark"]`); keep them identical. The viewer listens for the `themechange` event.
- `vendor/`: three.js r170 plus STLLoader, OrbitControls and BufferGeometryUtils, vendored locally. Do not switch to a CDN. Wire it with the importmap in the page head:
  `{"imports":{"three":"./vendor/three.module.min.js","three/addons/":"./vendor/"}}`
- `models/`: STL exports from SolidWorks.
- `img/`: optimised JPEGs (at most about 1200 px wide).
- `img/logos/`: tool logos (SVG, see its README.txt for sources). They are drawn as flat single-colour masks in `styles.css` (`.logo-*`), never in brand colours, so they follow the theme. Add a logo only if an accurate mark exists; do not invent one. Shown in a centred row in the hero. Three organisation marks (Ultratec, Egnatia, Amity University Dubai) sit beside the Experience headings (`.org-logo`); they are the organisations' own white-on-transparent files, cropped to the wordmark (Amity shield and Egnatia anniversary mark dropped on purpose).
- `js/contact.js`: copies the email address when a mailto link is clicked (mailto does nothing without a mail app) and says so in the `.copy-note` live region.
- `assets/Mohammed_Armaan_CV.pdf`
- `.nojekyll` must stay.

## Cache busting
GitHub Pages caches CSS and JS for roughly 10 minutes. When `styles.css` or `js/viewer.js` changes, bump the `?v=N` query on every page that links them (currently `?v=18`).

## 3D viewer rules (a past bug cost a day, do not regress it)
- The viewer container needs `position:relative; aspect-ratio; overflow:hidden`. The canvas is `position:absolute; inset:0; width:100%; height:100%`. Never let the canvas sit in the normal flow, because a ResizeObserver feedback loop makes the page grow forever.
- The critical viewer CSS is duplicated in an inline `<style>` in each project page head so it works even with a stale cached stylesheet. Keep it.
- `resize()` ignores changes under 2 px. Keep that guard.
- Every viewer has a Full screen button, added automatically by `createStage()` in `js/viewer-core.js` (Fullscreen API with a fixed-overlay fallback for iPhone). New viewers must be built on `createStage()`, and the markup must keep the `.viewer` host and its `.viewer-ui` controls as siblings in one parent element, because that parent is what goes full screen.
- Render on demand (`requestAnimationFrame` only after a control change). No continuous loop, no auto-rotate.
- Model units are mm. +Z is the nose, +Y is up, the wing runs along X. Normals are creased at 35 degrees with edge lines.
- Export STLs from SolidWorks as multibody parts with "Do not translate output data to positive space" so the bodies share an origin. Moving parts are a separate STL so JS can translate them.
- For a new project: export STL (binary, finer resolution for curved surfaces), add it to `models/`, copy the project page, adjust the FIT table (projected size per view), the camera target and the slider limits.

## Facts for the UAV project (the ASET 2026 paper is the authority)
- Span 1.8 m, AR 6.47, wing area 0.501 m2, Clark Y, AUW 3.6 kg.
- Tail arm 790 mm retracted, 990 mm extended (200 mm stroke). Tail volume coefficient 0.36 to 0.44, linear in between.
- CFD: ANSYS Fluent, k-omega SST, about 3.6M cells. Values at 15 m/s: dCm/dalpha -0.0031 to -0.0049 per deg, L/D at 0 deg 7.61 to 8.51.
- FEA (SolidWorks, 3g): wood spars 20x20 mm, FOS 3.69, tip deflection 14.85 mm. Carbon boom FOS 21.7, 4.99 mm.
- CG shift 6.16 mm. Tail group 260 g, battery 400 g. ESP32 with BTS7960 drivers. CoreWing F405-Wing V2 on ArduPlane. 25 Hz logger.
- Status: ground-tested only (taxi up to 5 m/s). Flights are pending GCAA airspace clearance. Never claim it has flown.
- CFD sweep: 18 runs, confirmed by the author (matches the paper; supersedes the report's 36).
- If the report and the paper disagree, use the paper and flag the difference.

## Content rules
- Never invent numbers, dates, awards or claims. If something is unknown, leave it out or ask.
- No personal phone number on the public site. The email is m747.armaan@gmail.com.
- No photos with people in them unless asked. Crop or omit.
- Describe results the way an engineer would: state the value, the conditions and the limitation.
- Other projects: RC Cessna 172 (1:8, 1.42 m, 3.6 kg AUW, spiral-vase PETG wings, three-piece fuselage; first airframe crashed after take-off from over-sensitive pitch control; the rebuild's second flight was better but trim and an unexpected battery run-out ended in a second crash; short endurance from high weight. Never say it "flew successfully" without that context), hybrid-power cloud-seeding UAV (2.4 m concept, started prototype), lunar rover (team project: the author did detailed design and the PETG prototype, 6-DoF arm, 6 wheels, ESP32, field-tested on sand and gravel; page and viewer exist). The cloud-seeding UAV still needs an STL export from the author before its page can have a viewer.

## Checks before every commit
1. Serve locally (`python -m http.server`) and open the page.
2. Check light mode, dark mode, and a 390 px wide viewport. No horizontal scroll.
3. Check the browser console for errors and confirm all images load.
4. Check the 3D viewer loads, orbits, and the slider moves the tail.
5. Commit with a short imperative message, then push to `main`.
