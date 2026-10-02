# Bookmarks visual and functional QA

final result: passed

Scope: browser implementation of the six requested screens, both themes, and mobile layout. This is not an Android APK or installed-PWA certification.

## Source and normalization

Source visual truth: design/reference-light.png and design/reference-dark.png, supplied bookmark logo at public/brand/logo.png. Original attachments are in ../upload.
Light board: 1024×1536 px. Dark board: 1536×1404 px. The generated boards use different phone proportions and sample content; there is no single shared pixel viewport or font file. Device bezels, fake status bars, and home indicators are excluded from production-app fidelity. Production respects real safe areas.
Implementation: actual cloud Chrome, app.html inside a QA viewport iframe, 390×844 CSS px, screenshot crop 390×844 px. Screenshot crop geometry is retained in qa/*-box.json. Composite boards retain relative proportions for qualitative comparison, not a numerical pixel-difference score.

## Evidence

Full-view comparisons: qa/light-verified-comparison.jpg and qa/dark-verified-comparison.jpg, opened alongside their respective source boards in the same image input.
All six browser captures per theme: qa/{light,dark}-{home,collections,details}-final-v2.jpg and qa/{light,dark}-{all,search,add}-corrected-v2.jpg.
Focused field/filter/nav regions: qa/light-focused.jpg and qa/dark-focused.jpg; the full-resolution individual 390×844 captures were also inspected for readable typography, border radius, logo crop, list alignment, and active icons.
Content state: real records created through the UI, including a saved URL, an uploaded OCR image, and a user-created collection. Source travel/design samples were deliberately not shipped as seed records. Screenshots precede the later collection-delete QA step.

## Iterations and fixes

1. P2: home search button lost its surface because the button reset overrode it. Added a scoped surface rule and recaptured.
2. P2: initial logo included excess outer whitespace; cropped the supplied asset to its tile. Dark uses its supplied dark logo tile. No logo redesign.
3. P2: archive-shaped nav icon differed from the folder in the source. Replaced with Phosphor folder/house/bookmark icons and filled selected variants.
4. P1: animation exits could delay fast navigation. Removed the blocking wait-mode page exit; retained keyed motion entrances, shared thumbnail layout IDs, row/collection layout transitions, toast presence, and sheet motion. Repeated the flows successfully.
5. P2: All Bookmarks placed the filter in the header. Restored header overflow and a separate filter button beside the search field. Reopened and recaptured in both themes.
6. P2: focused search input drew a rectangular native focus outline inside the rounded field. Replaced with the rounded parent border state. Recaptured both themes.
7. P2: Add lacked its source dot pattern. Restored the subtle shared dot texture. Recaptured both themes.
8. Capture verification: early animation-frame captures were discarded. Final captures were taken after a separate navigation/state observation; no fading/transient frame is used as final evidence.

## Required fidelity surfaces

Typography: matched compact system-like sans hierarchy, heading/body/metadata sizes, weights, line wrapping and truncation; platform glyph rendering varies slightly from the generated source. P3 only.
Spacing/layout: measured page inset, two-column cards, rounded fields, circular center plus, row thumbnails, toolbar order, and fixed bottom navigation. Responsive metrics below show no unintended horizontal overflow.
Colors/tokens: monochrome palettes, quiet dots on Home/Add, gray surfaces, inverted primary actions in dark mode. Shared color/radius/rhythm tokens in source files.
Images/assets: supplied logo preserved and cropped for placement; real uploaded image stored in IndexedDB and rendered at thumbnail/hero sizes. Sample photography is not fabricated or hardcoded.
Copy/content: required labels and screen anatomy preserved. Counts, dates, collections, titles and search results come from records. Expected empty/unsorted/fallback states differ from populated reference examples.

## Responsive checks

Actual browser iframe CSS sizes: 360×800, 390×844, 412×915, 430×932.
For every size, native-scroll.scrollWidth equals clientWidth and nav bottom/right equal viewport height/width. Measurements: qa/responsive.json. Scrollbars hidden in CSS while scrolling remains active; Android WebView also disables native vertical/horizontal scrollbars in MainActivity.

## Browser functional checks

Saved URL -> Home -> All Bookmarks -> notes search -> details -> original-link href -> edit -> move to collection -> favorite.
Created collection -> moved one item -> renamed -> deleted -> original bookmark retained in Unsorted.
Uploaded PNG -> local English/Arabic OCR engine -> extracted “Screenshot Brain / Mountain travel journal / Save what matters.” -> saved -> searched “Mountain” (not in title) -> matching image result -> details.
Created a long note (over 2,000 characters), persisted it, then deleted it with the confirmation flow.
Rejected invalid URL and duplicate URL.
Reload kept actual records and theme; no seed dataset is present.
Console inspected: no application-impacting errors after excluding browser-extension diagnostics and expected best-effort metadata CORS failure.

## Build / automated checks

npm run build:app: passed (standalone production application).
npm run build: passed (preview/runtime build).
npm run check:runtime: passed, all 28 protected runtime files preserved.
npx cap sync android: passed.
npm test: 11 passed (4 storage/search/10,000-item tests, 3 PWA share/offline/manifest tests, 4 output/worker tests).

## Limits and P3 follow-up

No Android SDK or Java 21 in this environment: no APK compilation or physical-phone share test was claimed. GitHub Actions workflow is included.
PWA share POST and offline shell tested at service-worker level; OS installation/share-picker flow not tested because the preview is HTTP. Production hosting must be HTTPS.
OCR engine/language data bundled locally; English fixture tested, Arabic accuracy and a blank-image fixture not separately measured.
Metadata fallback tested; successful metadata extraction from third-party websites is limited by their CORS policy. Save remains enabled independently of metadata.
Reference boards have different aspect ratios and content. No literal 100% pixel-match score is claimed.
Remaining P3: platform font rendering and minimum touch-target adjustments at extreme accessibility scaling; physical Android keyboard/safe-area verification still needed.
