import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public/ocr", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  "public/ocr/worker.LICENSE.txt",
);
await copyFile(
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "public/ocr/tesseract-core-lstm.wasm.js",
);
await copyFile(
  "node_modules/tesseract.js-core/LICENSE",
  "public/ocr/core.LICENSE.txt",
);
for (const lang of ["eng", "ara"])
  await copyFile(
    `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    `public/ocr/${lang}.traineddata.gz`,
  );
