export type VisionResult = {
  title: string;
  description: string;
  tags: string[];
  searchAliases: string[];
  objects: string[];
  contexts: string[];
};

const KEY = "bookmarks.openrouterKey";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export function getVisionKey() {
  return localStorage.getItem(KEY) ?? "";
}

export function setVisionKey(value: string) {
  const clean = value.trim();
  if (clean) localStorage.setItem(KEY, clean);
  else localStorage.removeItem(KEY);
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function cleanArray(value: unknown, max = 16) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((x) => x.trim()).filter(Boolean))].slice(0, max);
}

function parseJson(text: string): VisionResult {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Vision model returned an invalid response.");
  const x = JSON.parse(stripped.slice(start, end + 1));
  return {
    title: String(x.title || "Saved image").trim().slice(0, 100),
    description: String(x.description || "").trim().slice(0, 800),
    tags: cleanArray(x.tags, 14),
    searchAliases: cleanArray(x.searchAliases, 24),
    objects: cleanArray(x.objects, 20),
    contexts: cleanArray(x.contexts, 12),
  };
}

export async function analyzeImage(blob: Blob, apiKey: string): Promise<VisionResult> {
  if (!apiKey.trim()) throw new Error("OpenRouter key is missing.");
  if (!blob.type.startsWith("image/")) throw new Error("Smart analysis supports images only.");

  const imageUrl = await blobToDataUrl(blob);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.15,
        max_tokens: 900,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image for a personal bookmark/search app.
Return ONLY valid JSON with this exact shape:
{
  "title": "short useful English title",
  "description": "one precise sentence describing what is visibly in the image",
  "tags": ["specific","useful","tags"],
  "searchAliases": ["English synonym","Arabic equivalent","common search phrase"],
  "objects": ["visible object or UI element"],
  "contexts": ["app/game/product/place/category when reasonably identifiable"]
}

Rules:
- Describe visible content, not hidden/private traits.
- For screenshots, identify the app/game/site only when reasonably clear and describe the screen purpose.
- Include useful Arabic AND English search aliases.
- Prefer concrete nouns: book, black box, Minecraft, server list, settings, mountain, receipt, etc.
- Never invent names, brands, people, or text that are not reasonably supported by the image.
- Do not repeat near-identical tags.
- Title should be useful when browsing a list.
- Return JSON only.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body?.error?.message ? ` ${body.error.message}` : "";
      } catch {}
      throw new Error(`Smart image analysis failed (${response.status}).${detail}`);
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Vision model returned no analysis.");
    return parseJson(content);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Smart image analysis timed out.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
