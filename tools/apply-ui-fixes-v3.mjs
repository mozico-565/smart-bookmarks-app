import fs from "node:fs";

const cssPath = "src/prototype.css";
const tsxPath = "src/Prototype.tsx";

let css = fs.readFileSync(cssPath, "utf8");
let tsx = fs.readFileSync(tsxPath, "utf8");

function appendOnce(text, marker, addition) {
  if (!text.includes(marker)) {
    text += "\n" + addition + "\n";
  }
  return text;
}

/*
 * V3 UI fixes:
 * 1. Fix Search filter overflow.
 * 2. Improve logo sharpness.
 * 3. Shorter/smoother entrance.
 * 4. Preserve Smart Vision.
 */

css = appendOnce(
  css,
  "/* Smart Bookmarks V3 UI fixes */",
  `/* Smart Bookmarks V3 UI fixes */

/* Search filters */
.pills {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  scroll-padding-inline: 4px;
  padding-inline: 0 4px;
}

.pills::-webkit-scrollbar {
  display: none;
}

.pills > button {
  flex: 0 0 auto !important;
  min-width: max-content;
  white-space: nowrap;
  padding-inline: 18px;
}

/* Crisp logo */
.brand img {
  width: clamp(136px, 42vw, 184px);
  height: clamp(136px, 42vw, 184px);
  object-fit: contain;
  object-position: center;

  filter: none !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;

  image-rendering: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

[data-theme="dark"] .brand img,
.dark .brand img {
  filter: none !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

/* Short smooth entrance */
.screen-content {
  animation:
    bookmarks-v3-enter
    180ms
    cubic-bezier(.2,.75,.25,1)
    both;
}

@keyframes bookmarks-v3-enter {
  from {
    opacity: 0;
    transform: translateY(3px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .screen-content {
    animation: none !important;
    transition: none !important;
  }
}`
);

/* Reduce the old Framer entrance movement */
tsx = tsx.replace(
  `initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.18 }}`,

  `initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.16,
        ease: [0.2, 0.75, 0.25, 1]
      }}`
);

/*
 * logo-dark.png is considerably smaller than
 * the large original logo asset.
 *
 * Use the high-resolution source and avoid
 * blur-producing dark-theme filters.
 */
tsx = tsx.replace(
  `src={dark ? "/brand/logo-dark.png" : "/brand/logo-crop.png"}`,
  `src="/brand/logo-crop.png"`
);

fs.writeFileSync(cssPath, css);
fs.writeFileSync(tsxPath, tsx);

console.log("V3 UI fixes applied:");
console.log("- Search filters fixed");
console.log("- High-resolution logo enabled");
console.log("- Entrance motion improved");
console.log("- Smart Vision preserved");