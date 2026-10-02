export function newId() {
  const a = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(a, (n) => n.toString(16).padStart(2, "0")).join("");
}
export type Kind = "link" | "image" | "note" | "video" | "file";
export type Bookmark = {
  id: string;
  kind: Kind;
  title: string;
  url: string;
  domain: string;
  note: string;
  description: string;
  tags: string[];
  collectionId: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  ocr: string;
  visualText?: string;
  assetId?: string;
  preview?: string;
  fileName?: string;
};
export type Collection = {
  id: string;
  name: string;
  order: number;
  coverId?: string;
};
export type Settings = { theme: "light" | "dark" | "system" };
let connection: Promise<IDBDatabase>;
function db() {
  return (connection ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("bookmarks-local", 1);
    r.onupgradeneeded = () => {
      for (const s of [
        "bookmarks",
        "collections",
        "assets",
        "settings",
        "inbox",
      ])
        r.result.createObjectStore(s, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
async function op<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
) {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = run(t.objectStore(store));
    let result: T;
    r.onsuccess = () => {
      result = r.result;
    };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export const repo = {
  all: <T>(s: string) => op<T[]>(s, "readonly", (x) => x.getAll()),
  get: <T>(s: string, id: string) =>
    op<T | undefined>(s, "readonly", (x) => x.get(id)),
  put: (s: string, value: unknown) => op(s, "readwrite", (x) => x.put(value)),
  remove: (s: string, id: string) => op(s, "readwrite", (x) => x.delete(id)),
};
export async function deleteCollection(id: string) {
  const d = await db();
  const items = await repo.all<Bookmark>("bookmarks");
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction(["collections", "bookmarks"], "readwrite");
    t.objectStore("collections").delete(id);
    items
      .filter((b) => b.collectionId === id)
      .forEach((b) =>
        t
          .objectStore("bookmarks")
          .put({ ...b, collectionId: "", updatedAt: Date.now() }),
      );
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f]/g, "")
    .toLocaleLowerCase();
}
export function searchBookmarks(
  items: Bookmark[],
  collections: Collection[],
  query: string,
) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return items.filter((b) => {
    const text = normalize(
      [
        b.title,
        b.url,
        b.domain,
        b.note,
        b.description,
        b.tags.join(" "),
        b.ocr,
        b.visualText ?? "",
        collections.find((c) => c.id === b.collectionId)?.name ?? "",
      ].join(" "),
    );
    return terms.every((t) => text.includes(t));
  });
}
export function parseURL(input: string) {
  const value = input.trim();
  if (!value) throw Error("Enter a URL.");
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname.includes(".") ||
    url.username ||
    url.password
  )
    throw Error("Enter a valid http or https URL.");
  return url;
}
export function relativeTime(date: number) {
  const m = Math.max(0, Math.floor((Date.now() - date) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m} minutes ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hours ago`;
  return `${Math.floor(m / 1440)} days ago`;
}
export function dayLabel(date: number) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  return d.toDateString() === today.toDateString()
    ? "Today"
    : d.toDateString() === yesterday.toDateString()
      ? "Yesterday"
      : d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
}
export async function storeFile(file: File) {
  if (file.size > 40 * 1024 * 1024)
    throw Error("Choose a file smaller than 40 MB.");
  let blob: Blob = file;
  if (
    file.type.startsWith("image/") &&
    !file.type.includes("gif") &&
    !file.type.includes("svg")
  ) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.88),
      );
      bitmap.close();
    } catch {
      blob = file;
    }
  }
  if (file.type.includes("svg"))
    throw Error("Please use a PNG, JPEG, or WebP image.");
  const id = newId();
  await repo.put("assets", { id, blob, name: file.name, type: file.type });
  return id;
}
export async function extractText(blob: Blob, onProgress: (n: number) => void) {
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void worker?.terminate();
      reject(Error("OCR timed out"));
    }, 90000);
  });
  const task = (async () => {
    worker = await createWorker("eng+ara", 1, {
      workerPath: new URL("/ocr/worker.min.js", location.href).href,
      corePath: new URL("/ocr/tesseract-core-lstm.wasm.js", location.href).href,
      langPath: new URL("/ocr", location.href).href,
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === "recognizing text") onProgress(m.progress);
      },
    });
    if (timedOut) {
      await worker.terminate();
      throw Error("OCR timed out");
    }
    return (await worker.recognize(blob)).data.text;
  })();
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer!);
    void worker?.terminate();
  }
}
// Search is kept behind one interface so a future local semantic ranker can supplement lexical search.
