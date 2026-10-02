import fs from "node:fs";

const protoPath = "src/Prototype.tsx";
const dataPath = "src/data.ts";

let p = fs.readFileSync(protoPath, "utf8");
let d = fs.readFileSync(dataPath, "utf8");

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Patch point not found: ${label}`);
  return source.replace(before, after);
}

// 1) Import vision analyzer.
p = replaceOnce(
  p,
  `  extractText,\n  deleteCollection,`,
  `  extractText,\n  deleteCollection,`,
  "data import anchor"
);

p = replaceOnce(
  p,
  `import "./design-tokens.css";`,
  `import { analyzeImage, getVisionKey, setVisionKey } from "./vision";\nimport "./design-tokens.css";`,
  "vision import"
);

// 2) Extend draft with visual search aliases.
p = replaceOnce(
  p,
  `  ocr: string;\n  fileName?: string;`,
  `  ocr: string;\n  visualText: string;\n  fileName?: string;`,
  "Draft visualText"
);

p = replaceOnce(
  p,
  `  ocr: "",\n});`,
  `  ocr: "",\n  visualText: "",\n});`,
  "emptyDraft visualText"
);

// 3) Add status state.
p = replaceOnce(
  p,
  `    [ocrStatus, setOcrStatus] = useState(""),\n    [limit, setLimit] = useState(60);`,
  `    [ocrStatus, setOcrStatus] = useState(""),\n    [visionStatus, setVisionStatus] = useState(""),\n    [limit, setLimit] = useState(60);`,
  "vision status state"
);

// 4) Reset status when adding.
p = replaceOnce(
  p,
  `    setOcrStatus("");\n    go("add");`,
  `    setOcrStatus("");\n    setVisionStatus("");\n    go("add");`,
  "reset vision status"
);

// 5) When choosing an image, clear old visual analysis
// and auto-run smart analysis.
const oldChoose = `      changed({
        assetId: id,
        title: draft.title || file.name,
        fileName: file.name,
        kind: ["link", "video", "note"].includes(draft.kind)
          ? draft.kind
          : file.type.startsWith("image/")
            ? "image"
            : "file",
        preview: undefined,
        ocr: "",
      });`;

const newChoose = `      const nextKind = ["link", "video", "note"].includes(draft.kind)
        ? draft.kind
        : file.type.startsWith("image/")
          ? "image"
          : "file";

      changed({
        assetId: id,
        title: draft.title || file.name,
        fileName: file.name,
        kind: nextKind,
        preview: undefined,
        ocr: "",
        visualText: "",
      });

      if (file.type.startsWith("image/")) {
        setTimeout(() => void runSmartImageAnalysis(id), 0);
      }`;

p = replaceOnce(
  p,
  oldChoose,
  newChoose,
  "chooseFile smart analysis"
);

// 6) Add smart image analysis function before runOCR.
const smartFn = `  async function runSmartImageAnalysis(assetId = draft.assetId) {
    if (!assetId) return;

    const key = getVisionKey();

    if (!key) {
      setVisionStatus(
        "Add your OpenRouter key in Profile to enable smart image analysis."
      );
      return;
    }

    setBusy(true);
    setVisionStatus("Understanding image…");

    try {
      const a = await repo.get<{ blob: Blob }>("assets", assetId);

      if (!a) throw Error("Image not found.");

      const result = await analyzeImage(a.blob, key);

      setDraft((current) => {
        if (current.assetId !== assetId) return current;

        const currentTags = current.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        const tags = [
          ...new Set([
            ...result.tags,
            ...currentTags
          ])
        ].slice(0, 14);

        return {
          ...current,

          title:
            !current.title.trim() ||
            current.title === current.fileName
              ? result.title
              : current.title,

          description:
            result.description ||
            current.description,

          tags: tags.join(", "),

          visualText: [
            result.title,
            result.description,
            ...result.tags,
            ...result.searchAliases,
            ...result.objects,
            ...result.contexts,
          ]
            .filter(Boolean)
            .join(" "),
        };
      });

      setVisionStatus(
        "Smart title, tags and searchable description added."
      );
    } catch (e) {
      setVisionStatus(
        (e as Error).message ||
          "Smart image analysis failed. You can still save the image."
      );
    } finally {
      setBusy(false);
    }
  }

`;

p = replaceOnce(
  p,
  `  async function runOCR() {`,
  smartFn + `  async function runOCR() {`,
  "smart function insertion"
);

// 7) Save visualText.
p = replaceOnce(
  p,
  `        ocr: draft.ocr,\n        assetId: draft.assetId,`,
  `        ocr: draft.ocr,\n        visualText: draft.visualText,\n        assetId: draft.assetId,`,
  "save visualText"
);

// 8) Make edit backward compatible with old bookmarks.
p = replaceOnce(
  p,
  `    setDraft({ ...b, tags: b.tags.join(", ") });`,
  `    setDraft({
      ...b,
      visualText: b.visualText ?? "",
      tags: b.tags.join(", ")
    });`,
  "edit compatibility"
);

// 9) Add Profile local API-key UI.
const profileNeedles = [
  `<h1>Profile</h1>`,
  `<h2>Profile</h2>`
];

let injected = false;

for (const needle of profileNeedles) {
  if (p.includes(needle)) {
    p = p.replace(
      needle,
      needle + `
              <section
                className="form-section"
                style={{ marginTop: 18 }}
              >
                <label
                  className="field-label"
                  htmlFor="vision-key"
                >
                  Smart image search
                </label>

                <Input
                  id="vision-key"
                  type="password"
                  defaultValue={getVisionKey()}
                  placeholder="OpenRouter API key"
                  autoComplete="off"
                  onBlur={(e) => {
                    setVisionKey(e.currentTarget.value);

                    setToast(
                      e.currentTarget.value.trim()
                        ? "Vision key saved on this device"
                        : "Vision key removed"
                    );
                  }}
                />

                <p
                  className="muted"
                  style={{ marginTop: 8 }}
                >
                  Stored only on this device.
                  Used to create image titles,
                  tags and search descriptions.
                </p>
              </section>`
    );

    injected = true;
    break;
  }
}

if (!injected) {
  console.warn(
    "Profile heading not found; API key can still be set from DevTools/localStorage key bookmarks.openrouterKey."
  );
}

// 10) Show smart-analysis status near existing OCR status.
if (p.includes(`{ocrStatus &&`)) {
  p = p.replace(
    `{ocrStatus &&`,
    `{visionStatus && (
                <p className="muted">
                  {visionStatus}
                </p>
              )}
              {ocrStatus &&`
  );
}

// Extend Bookmark type.
d = replaceOnce(
  d,
  `  ocr: string;\n  assetId?: string;`,
  `  ocr: string;\n  visualText?: string;\n  assetId?: string;`,
  "Bookmark visualText"
);

// Include visual understanding in search.
d = replaceOnce(
  d,
  `        b.ocr,\n        collections.find`,
  `        b.ocr,\n        b.visualText ?? "",\n        collections.find`,
  "search visualText"
);

fs.writeFileSync(protoPath, p);
fs.writeFileSync(dataPath, d);

console.log(
  "Smart Vision patch applied successfully."
);
