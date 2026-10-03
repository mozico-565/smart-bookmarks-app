import fs from "node:fs";

const path = "src/Prototype.tsx";
let s = fs.readFileSync(path, "utf8");

function once(before, after, label) {
  if (!s.includes(before)) {
    throw new Error(`Patch point not found: ${label}`);
  }

  s = s.replace(before, after);
}

// Add state used by the Profile connection test.
once(
  `    [visionStatus, setVisionStatus] = useState(""),
    [limit, setLimit] = useState(60);`,
  `    [visionStatus, setVisionStatus] = useState(""),
    [visionKeyStatus, setVisionKeyStatus] = useState(""),
    [limit, setLimit] = useState(60);`,
  "vision key status state"
);

// Add a visible manual AI analysis button.
// Automatic analysis remains enabled too.
once(
  `              {draft.kind === "image" && draft.assetId && (
                <button className="field" disabled={busy} onClick={runOCR}>
                  Extract text from image
                </button>
              )}`,
  `              {draft.kind === "image" && draft.assetId && (
                <div className="theme-options">
                  <button
                    className="field"
                    disabled={busy}
                    onClick={() => void runSmartImageAnalysis()}
                  >
                    Analyze image with AI
                  </button>

                  <button
                    className="field"
                    disabled={busy}
                    onClick={runOCR}
                  >
                    Extract text from image
                  </button>
                </div>
              )}`,
  "manual AI analyze button"
);

// Replace the old key block that was inserted inside
// the Profile heading with a proper visible settings section.
const oldProfile = `          <header className="heading">
            <h1>Profile</h1>
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
              </section>
          </header>`;

const newProfile = `          <header className="heading">
            <h1>Profile</h1>
          </header>

          <section className="form-section smart-vision-settings">
            <h2 className="date-heading">
              Smart Image Search
            </h2>

            <p className="hint">
              AI can understand saved images and generate
              a useful title, description, tags, and
              Arabic + English search terms.
            </p>

            <label
              className="form-label"
              htmlFor="vision-key"
            >
              OpenRouter API key

              <Input
                id="vision-key"
                className="field"
                type="password"
                defaultValue={getVisionKey()}
                placeholder="sk-or-v1-..."
                autoComplete="off"
              />
            </label>

            <button
              className="field settings-row"
              type="button"
              disabled={busy}
              onClick={async () => {
                const input = document.getElementById(
                  "vision-key"
                ) as HTMLInputElement | null;

                const key =
                  input?.value.trim() ?? "";

                if (!key) {
                  setVisionKey("");
                  setVisionKeyStatus(
                    "Enter an OpenRouter key first."
                  );
                  return;
                }

                setVisionKey(key);
                setBusy(true);

                setVisionKeyStatus(
                  "Testing connection…"
                );

                try {
                  const response = await fetch(
                    "https://openrouter.ai/api/v1/models",
                    {
                      headers: {
                        Authorization:
                          \`Bearer \${key}\`,
                      },
                    }
                  );

                  if (!response.ok) {
                    throw new Error(
                      \`Connection failed (\${response.status})\`
                    );
                  }

                  setVisionKeyStatus(
                    "Connected. Smart image search is ready."
                  );
                } catch (e) {
                  setVisionKeyStatus(
                    (e as Error).message ||
                      "Could not connect to OpenRouter."
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <CheckIcon />
              Save & Test Connection
            </button>

            {visionKeyStatus && (
              <p
                role="status"
                className="hint"
              >
                {visionKeyStatus}
              </p>
            )}

            <p className="hint">
              The key is stored only on this device
              and is never committed to GitHub.
            </p>
          </section>`;

once(
  oldProfile,
  newProfile,
  "profile Smart Image Search section"
);

fs.writeFileSync(path, s);

console.log(
  "Smart Vision V2 patch applied."
);
