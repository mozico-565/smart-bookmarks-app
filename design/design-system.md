# Bookmarks design system

Reference truth: reference-light.png, reference-dark.png, and the supplied bookmark logo.
The generated reference boards use different phone aspect ratios. Device chrome is excluded from app fidelity; the production app uses real OS chrome and safe-area insets.

| Token | Light | Dark |
| --- | --- | --- |
| Background | #fafafa | #101111 |
| Surface | #ffffff | #171818 |
| Subtle surface | #eeeeef | #222323 |
| Text | #141516 | #f0f0f0 |
| Secondary text | #77787a | #a1a2a2 |
| Border | #e6e6e7 | #303132 |
| Primary button | #353638 | #ededee |

Shared dimensions: page inset 22px (18px below 375px), field radius 17px, surface radius 19px, collection card radius 16px, thumbnail radius 14px, collection gap 15px. Body 16px, metadata 13px, primary heading 29px. Main body and text entry respect browser text scaling. Radius and rhythm tokens are in src/design-tokens.css; theme tokens are in src/prototype.css.

Home and Add use the restrained dot texture; collections and lists use solid backgrounds. Two-column collection layout, fixed five-action bottom navigation with a circular centered plus, no colored gradients or glass surfaces. Motion 150–220ms and system reduced-motion support. Arabic-ready logical spacing and text alignment; English is the current UI language.
