import {
  useEffect,
  useState,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import {
  GearIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PersonIcon,
  Link2Icon,
  ImageIcon,
  FileTextIcon,
  DotsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  ExternalLinkIcon,
  CalendarIcon,
  MixerHorizontalIcon,
  CheckIcon,
  DownloadIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import {
  House as HomeIcon,
  FolderSimple as ArchiveIcon,
  BookmarkSimple as BookmarkIcon,
} from "@phosphor-icons/react";
import {
  MobileScroll,
  KeyboardInput,
  KeyboardTextarea,
  BottomSheet,
  useKeyboard,
} from "./mobile";
import {
  newId,
  repo,
  searchBookmarks,
  parseURL,
  relativeTime,
  dayLabel,
  storeFile,
  extractText,
  deleteCollection,
  type Bookmark,
  type Collection,
  type Kind,
} from "./data";
import { analyzeImage, getVisionKey, setVisionKey } from "./vision";
import "./design-tokens.css";
import "./prototype.css";
type Page =
  "home" | "collections" | "all" | "add" | "search" | "details" | "profile";
type Draft = {
  kind: Kind;
  url: string;
  title: string;
  note: string;
  description: string;
  tags: string;
  collectionId: string;
  assetId?: string;
  preview?: string;
  ocr: string;
  visualText: string;
  fileName?: string;
  id?: string;
};
const StandaloneContext = createContext(false);
function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return useContext(StandaloneContext) ? (
    <input {...props} />
  ) : (
    <KeyboardInput {...props} />
  );
}
function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return useContext(StandaloneContext) ? (
    <textarea {...props} />
  ) : (
    <KeyboardTextarea {...props} />
  );
}
const emptyDraft = (kind: Kind = "link"): Draft => ({
  kind,
  url: "",
  title: "",
  note: "",
  description: "",
  tags: "",
  collectionId: "",
  ocr: "",
  visualText: "",
});
const IconButton = ({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) => (
  <motion.button
    type="button"
    className="icon-button"
    aria-label={label}
    onClick={onClick}
    whileTap={{ scale: 0.92 }}
  >
    {children}
  </motion.button>
);
export default function Prototype() {
  const keyboard = useKeyboard();
  return <BookmarkApp dismissKeyboard={() => keyboard.hide()} />;
}
export function BookmarkApp({
  standalone = false,
  dismissKeyboard = () => {},
}: {
  standalone?: boolean;
  dismissKeyboard?: () => void;
}) {
  const [page, setPage] = useState<Page>("home"),
    [items, setItems] = useState<Bookmark[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [theme, setTheme] = useState<"light" | "dark" | "system">("system"),
    [systemDark, setSystemDark] = useState(
      matchMedia("(prefers-color-scheme: dark)").matches,
    ),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [collectionFilter, setCollectionFilter] = useState(""),
    [favoriteOnly, setFavoriteOnly] = useState(false),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<Draft>(emptyDraft()),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [sheet, setSheet] = useState(""),
    [menuItem, setMenuItem] = useState<Bookmark>(),
    [menuCollection, setMenuCollection] = useState<Collection>(),
    [collectionName, setCollectionName] = useState(""),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [ocrStatus, setOcrStatus] = useState(""),
    [visionStatus, setVisionStatus] = useState(""),
    [limit, setLimit] = useState(60);
  const fileRef = useRef<HTMLInputElement>(null),
    coverRef = useRef<HTMLInputElement>(null),
    metadataToken = useRef(0);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  async function reload() {
    const [b, c] = await Promise.all([
      repo.all<Bookmark>("bookmarks"),
      repo.all<Collection>("collections"),
    ]);
    setItems(b.sort((a, b) => b.createdAt - a.createdAt));
    setCollections(c.sort((a, b) => a.order - b.order));
  }
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await reload();
        const t = await repo.get<{ id: string; value: typeof theme }>(
          "settings",
          "theme",
        );
        if (t) setTheme(t.value);
        if (cancelled) return;
        setReady(true);
        const inbox = await repo.all<{
          id: string;
          title: string;
          text: string;
          url: string;
          files: File[];
        }>("inbox");
        const p = new URLSearchParams(location.search);
        const shared = inbox[0] ?? {
          title: p.get("title") ?? "",
          text: p.get("text") ?? "",
          url: p.get("url") ?? "",
          files: [],
        };
        if (shared.url || shared.text || shared.files.length) {
          const url =
            shared.url || shared.text.match(/https?:\/\/\S+/)?.[0] || "";
          const d = {
            ...emptyDraft(url ? "link" : "note"),
            url,
            title: shared.title,
            note: shared.text,
          };
          if (shared.files[0]) {
            d.kind = shared.files[0].type.startsWith("image/")
              ? "image"
              : "file";
            d.assetId = await storeFile(shared.files[0]);
            d.fileName = shared.files[0].name;
            d.title ||= d.fileName;
          }
          setDraft(d);
          setPage("add");
          if (inbox[0]) await repo.remove("inbox", inbox[0].id);
          history.replaceState(null, "", location.pathname);
        }
      } catch {
        setError(
          "Could not open local storage. Please allow storage for this app.",
        );
      }
    };
    void load();
    window.addEventListener("share-ready", load);
    const shareError = (e: Event) =>
      setError((e as CustomEvent<string>).detail);
    window.addEventListener("share-error", shareError);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSystemDark(media.matches);
    media.addEventListener("change", fn);
    return () => {
      cancelled = true;
      window.removeEventListener("share-ready", load);
      window.removeEventListener("share-error", shareError);
      media.removeEventListener("change", fn);
    };
  }, []);
  useEffect(() => {
    const ids = [
      ...new Set(
        [
          ...items.map((i) => i.assetId),
          ...collections.map((c) => c.coverId),
          draft.assetId,
        ].filter(Boolean),
      ),
    ] as string[];
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const a = await repo.get<{ blob: Blob }>("assets", id);
          if (!a) return [id, ""];
          const u = URL.createObjectURL(a.blob);
          created.push(u);
          return [id, u];
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
      created.forEach(URL.revokeObjectURL);
    };
  }, [items, collections, draft.assetId]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2600);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (standalone) {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#101111" : "#fafafa");
    }
  }, [dark, standalone]);
  function go(p: Page) {
    dismissKeyboard();
    setPage(p);
    setError("");
    setFilter("All");
    setLimit(60);
    if (p !== "all") setCollectionFilter("");
  }
  function add(kind: Kind = "link") {
    metadataToken.current++;
    setDraft(emptyDraft(kind));
    setOcrStatus("");
    setVisionStatus("");
    go("add");
  }
  function openSheet(name: string) {
    dismissKeyboard();
    setSheet(name);
  }
  function thumb(b: Bookmark | Draft) {
    return b.assetId ? urls[b.assetId] : b.preview;
  }

  function changed(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  async function metadata() {
    const token = ++metadataToken.current;
    try {
      const u = parseURL(draft.url);
      changed({ url: u.href });
      // Public websites commonly block CORS. Metadata never locks the Save button.
      const r = await fetch(u.href, {
        signal: AbortSignal.timeout(5000),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!r.ok) throw Error();
      const html = await r.text();
      const doc = new DOMParser().parseFromString(
        html.slice(0, 2_000_000),
        "text/html",
      );
      const image = doc
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content");
      const preview = image ? new URL(image, u).href : undefined;
      if (token === metadataToken.current)
        setDraft((d) => ({
          ...d,
          title:
            d.title === u.hostname.replace(/^www\./, "") || !d.title
              ? doc
                  .querySelector('meta[property="og:title"]')
                  ?.getAttribute("content") ||
                doc.title ||
                u.hostname
              : d.title,
          description:
            doc
              .querySelector('meta[name="description"]')
              ?.getAttribute("content") || "",
          preview: preview?.startsWith("https:") ? preview : undefined,
        }));
    } catch {
      if (token === metadataToken.current)
        setToast("Preview unavailable. You can still save this link.");
    }
  }
  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const id = await storeFile(file);
      const nextKind = ["link", "video", "note"].includes(draft.kind)
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
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function runSmartImageAnalysis(assetId = draft.assetId) {
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

  async function runOCR() {
    if (!draft.assetId) return;
    const assetId = draft.assetId;
    setBusy(true);
    setOcrStatus("Preparing local OCR…");
    try {
      const a = await repo.get<{ blob: Blob }>("assets", draft.assetId);
      if (!a) throw Error();
      const text = await extractText(a.blob, (n) =>
        setOcrStatus(`Reading image… ${Math.round(n * 100)}%`),
      );
      setDraft((d) => (d.assetId === assetId ? { ...d, ocr: text } : d));
      setOcrStatus(
        text.trim()
          ? "Text extracted and searchable."
          : "No readable text found.",
      );
    } catch {
      setOcrStatus(
        "OCR unavailable. Save the image and try again when online.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError("");
    try {
      let url = "",
        domain = "";
      if (draft.kind === "link" || draft.kind === "video") {
        const u = parseURL(draft.url);
        url = u.href;
        domain = u.hostname.replace(/^www\./, "");
        const duplicate = items.find((i) => i.url === url && i.id !== draft.id);
        if (duplicate) {
          setError(
            "This URL is already saved. Edit the existing bookmark instead.",
          );
          return;
        }
      }
      if (["image", "file"].includes(draft.kind) && !draft.assetId)
        throw Error("Choose an image or file.");
      if (draft.kind === "note" && !draft.note.trim())
        throw Error("Write a note before saving.");
      const old = items.find((b) => b.id === draft.id);
      const b: Bookmark = {
        id: draft.id || newId(),
        kind: draft.kind,
        title:
          draft.title.trim() ||
          domain ||
          draft.note.trim().slice(0, 70) ||
          draft.fileName ||
          "Untitled",
        url,
        domain,
        note: draft.note,
        description: draft.description,
        tags: [
          ...new Set(
            draft.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        ],
        collectionId: draft.collectionId,
        createdAt: old?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        favorite: old?.favorite ?? false,
        ocr: draft.ocr,
        visualText: draft.visualText,
        assetId: draft.assetId,
        preview: draft.preview,
        fileName: draft.fileName,
      };
      await repo.put("bookmarks", b);
      await reload();
      metadataToken.current++;
      go("home");
      setToast("Bookmark saved");
    } catch (e) {
      setError(
        (e as Error).message || "Could not save. Device storage may be full.",
      );
    }
  }
  async function favorite(b: Bookmark) {
    try {
      await repo.put("bookmarks", {
        ...b,
        favorite: !b.favorite,
        updatedAt: Date.now(),
      });
      await reload();
      setToast(b.favorite ? "Removed from favorites" : "Added to favorites");
    } catch {
      setError("Could not update bookmark.");
    }
  }
  function edit(b: Bookmark) {
    setDraft({
      ...b,
      visualText: b.visualText ?? "",
      tags: b.tags.join(", ")
    });
    setSheet("");
    go("add");
  }
  async function removeItem(b: Bookmark) {
    try {
      await repo.remove("bookmarks", b.id);
      if (b.assetId) await repo.remove("assets", b.assetId);
      setSheet("");
      await reload();
      if (page === "details") go("all");
      setToast("Bookmark deleted");
    } catch {
      setError("Could not delete bookmark.");
    }
  }
  async function saveCollection() {
    if (!collectionName.trim()) return;
    try {
      await repo.put("collections", {
        id: menuCollection?.id ?? newId(),
        name: collectionName.trim(),
        order: menuCollection?.order ?? collections.length,
        coverId: menuCollection?.coverId,
      });
      await reload();
      setSheet("");
      setToast("Collection saved");
    } catch {
      setError("Could not save collection.");
    }
  }
  function newCollection() {
    setMenuCollection(undefined);
    setCollectionName("");
    openSheet("collection-form");
  }
  async function exportData() {
    try {
      const data = {
        version: 1,
        bookmarks: items,
        collections,
        assets: await Promise.all(
          (
            await repo.all<{
              id: string;
              blob: Blob;
              name: string;
              type: string;
            }>("assets")
          ).map(async (a) => ({
            ...a,
            blob: await new Promise<string>((res) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.readAsDataURL(a.blob);
            }),
          })),
        ),
      };
      const u = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = u;
      a.download = "bookmarks-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch {
      setError("Backup could not be created.");
    }
  }
  const typeMatches = (b: Bookmark) =>
    filter === "All" ||
    ((filter === "Links" || filter === "Link") && b.kind === "link") ||
    ((filter === "Images" || filter === "Image") && b.kind === "image") ||
    ((filter === "Notes" || filter === "Note") && b.kind === "note") ||
    (filter === "Video" && b.kind === "video");
  const found = searchBookmarks(items, collections, query)
    .filter(typeMatches)
    .filter(
      (b) =>
        (!collectionFilter || b.collectionId === collectionFilter) &&
        (!favoriteOnly || b.favorite),
    );
  const detail = items.find((b) => b.id === selected);
  const Pills = ({ values }: { values: string[] }) => (
    <div className="pills" role="group" aria-label="Filter by type">
      {values.map((v) => (
        <motion.button
          key={v}
          className={filter === v ? "selected" : ""}
          onClick={() => {
            setFilter(v);
            setLimit(60);
          }}
          whileTap={{ scale: 0.95 }}
        >
          {filter === v && (
            <motion.span className="pill-indicator" layoutId="filter" />
          )}
          <span>{v}</span>
        </motion.button>
      ))}
    </div>
  );
  function ImagePreview({
    src,
    hero = false,
    id,
  }: {
    src?: string;
    hero?: boolean;
    id?: string;
  }) {
    return (
      <motion.div
        className={hero ? "hero-image" : "thumbnail"}
        layoutId={id ? `image-${id}` : undefined}
      >
        <BookmarkIcon />
        {src && (
          <img
            src={src}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </motion.div>
    );
  }
  function Row({ b }: { b: Bookmark }) {
    return (
      <motion.div
        className="bookmark-row"
        layout
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <button
          className="row-main"
          onClick={() => {
            setSelected(b.id);
            go("details");
          }}
        >
          <ImagePreview src={thumb(b)} id={b.id} />
          <span className="row-copy">
            <strong>{b.title}</strong>
            <small>
              {page === "home"
                ? relativeTime(b.createdAt)
                : `${b.domain || b.kind} · ${relativeTime(b.createdAt)}`}
            </small>
          </span>
        </button>
        <IconButton
          label={`Options for ${b.title}`}
          onClick={() => {
            setMenuItem(b);
            openSheet("item");
          }}
        >
          <DotsHorizontalIcon />
        </IconButton>
      </motion.div>
    );
  }
  function Empty({
    text = "Nothing saved yet",
    sub = "Save a link, image, or note to find it here.",
  }: {
    text?: string;
    sub?: string;
  }) {
    return (
      <div className="empty">
        <BookmarkIcon />
        <strong>{text}</strong>
        <p>{sub}</p>
      </div>
    );
  }
  const body = (
    <motion.main
      className={`screen-content ${page === "home" ? "home-content" : page === "add" ? "add-content" : ""}`}
      key={page}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.18 }}
    >
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!ready && <p>Opening your bookmarks…</p>}
      {page === "home" && (
        <>
          <header className="toolbar">
            <IconButton label="Settings" onClick={() => go("profile")}>
              <GearIcon />
            </IconButton>
            <IconButton label="Search" onClick={() => go("search")}>
              <MagnifyingGlassIcon />
            </IconButton>
          </header>
          <div className="brand">
            <img
              src={dark ? "/brand/logo-dark.png" : "/brand/logo-crop.png"}
              alt="Bookmarks logo"
            />
            <h1>Bookmarks</h1>
            <p>Save what matters.</p>
          </div>
          <button
            className="search-box home-search"
            onClick={() => go("search")}
          >
            <MagnifyingGlassIcon />
            <span>Search bookmarks...</span>
          </button>
          <div className="quick-actions">
            {(
              [
                { kind: "link", label: "Link", icon: <Link2Icon /> },
                { kind: "image", label: "Screenshot", icon: <ImageIcon /> },
                { kind: "note", label: "Note", icon: <FileTextIcon /> },
                { kind: "file", label: "More", icon: <PlusIcon /> },
              ] as const
            ).map((a) => (
              <motion.button
                key={a.kind}
                onClick={() =>
                  a.kind === "file" ? openSheet("more") : add(a.kind)
                }
                whileTap={{ scale: 0.95 }}
              >
                {a.icon}
                <span>{a.label}</span>
              </motion.button>
            ))}
          </div>
          <div className="section-heading">
            <h2>Recent</h2>
            <button
              onClick={() => {
                setQuery("");
                setFavoriteOnly(false);
                go("all");
              }}
            >
              See all
            </button>
          </div>
          {items.length ? (
            <AnimatePresence>
              {items.slice(0, 8).map((b) => (
                <Row b={b} key={b.id} />
              ))}
            </AnimatePresence>
          ) : (
            <Empty />
          )}
        </>
      )}
      {page === "collections" && (
        <>
          <header className="heading">
            <h1>Collections</h1>
            <IconButton
              label="Collection options"
              onClick={() => openSheet("collections-options")}
            >
              <DotsHorizontalIcon />
            </IconButton>
          </header>
          <Pills values={["All", "Links", "Images", "Notes"]} />
          <div className="collection-grid">
            {collections
              .filter(
                (c) =>
                  filter === "All" ||
                  items.some((b) => b.collectionId === c.id && typeMatches(b)),
              )
              .map((c) => {
                const entries = items.filter((b) => b.collectionId === c.id);
                const cover = c.coverId
                  ? urls[c.coverId]
                  : entries.map(thumb).find(Boolean);
                return (
                  <motion.div layout className="collection-card" key={c.id}>
                    <button
                      className="collection-open"
                      onClick={() => {
                        setQuery("");
                        setFavoriteOnly(false);
                        go("all");
                        setCollectionFilter(c.id);
                      }}
                    >
                      <div className="collection-cover">
                        {cover ? <img src={cover} alt="" /> : <ArchiveIcon />}
                      </div>
                      <strong>{c.name}</strong>
                      <small>{entries.length} items</small>
                    </button>
                    <IconButton
                      label={`Options for ${c.name}`}
                      onClick={() => {
                        setMenuCollection(c);
                        openSheet("collection");
                      }}
                    >
                      <DotsHorizontalIcon />
                    </IconButton>
                  </motion.div>
                );
              })}
            <motion.button
              layout
              className="new-collection"
              onClick={newCollection}
            >
              <PlusIcon />
              <span>New Collection</span>
            </motion.button>
          </div>
        </>
      )}
      {(page === "all" || page === "search") && (
        <>
          {page === "search" ? (
            <header className="heading">
              <h1>Search</h1>
            </header>
          ) : (
            <header className="toolbar centered">
              <IconButton label="Back" onClick={() => go("home")}>
                <ChevronLeftIcon />
              </IconButton>
              <h2>
                {collections.find((c) => c.id === collectionFilter)?.name ||
                  "All Bookmarks"}
              </h2>
              <IconButton
                label="Bookmark list options"
                onClick={() => openSheet("filters")}
              >
                <DotsHorizontalIcon />
              </IconButton>
            </header>
          )}
          <div className="search-toolbar">
            <div className="search-box">
              <MagnifyingGlassIcon />
              <Input
                aria-label="Search bookmarks"
                value={query}
                placeholder={
                  page === "search"
                    ? "Search bookmarks..."
                    : "Search in all bookmarks..."
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(60);
                }}
              />
              {query && (
                <IconButton label="Clear search" onClick={() => setQuery("")}>
                  <Cross2Icon />
                </IconButton>
              )}
            </div>
            {page === "all" && (
              <button
                className="filter-control"
                aria-label="Filter bookmarks"
                onClick={() => openSheet("filters")}
              >
                <MixerHorizontalIcon />
              </button>
            )}
          </div>
          <Pills
            values={
              page === "search"
                ? ["All", "Links", "Images", "Notes", "Collections"]
                : ["All", "Link", "Image", "Note", "Video"]
            }
          />
          {filter === "Collections" ? (
            <>
              {collections
                .filter((c) =>
                  c.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((c) => (
                  <button
                    className="field collection-result"
                    key={c.id}
                    onClick={() => {
                      go("all");
                      setQuery("");
                      setCollectionFilter(c.id);
                    }}
                  >
                    <ArchiveIcon />
                    {c.name}
                    <ChevronRightIcon />
                  </button>
                ))}
            </>
          ) : (
            <>
              {page === "search" && (
                <p className="result-count">Results ({found.length})</p>
              )}
              {found.length ? (
                found.slice(0, limit).map((b, i) => (
                  <div key={b.id}>
                    {page === "all" &&
                      (i === 0 ||
                        dayLabel(found[i - 1].createdAt) !==
                          dayLabel(b.createdAt)) && (
                        <h2 className="date-heading">
                          {dayLabel(b.createdAt)}
                        </h2>
                      )}
                    <Row b={b} />
                  </div>
                ))
              ) : (
                <Empty
                  text={query ? "No results" : "No bookmarks here"}
                  sub={
                    query
                      ? "Try a different word, tag, or collection."
                      : "Your saved items will appear here."
                  }
                />
              )}{" "}
              {found.length > limit && (
                <button
                  className="field"
                  onClick={() => setLimit((l) => l + 60)}
                >
                  Show more
                </button>
              )}
            </>
          )}
        </>
      )}
      {page === "add" && (
        <>
          <header className="toolbar">
            <IconButton label="Cancel" onClick={() => go("home")}>
              <Cross2Icon />
            </IconButton>
            <motion.button
              className="primary save"
              onClick={save}
              disabled={busy}
              whileTap={{ scale: 0.96 }}
            >
              {busy ? "Working…" : "Save"}
            </motion.button>
          </header>
          <div className="add-tabs">
            {(["link", "image", "note"] as Kind[]).map((k) => (
              <button
                className={draft.kind === k ? "active" : ""}
                key={k}
                onClick={() => changed({ kind: k })}
              >
                {k === "image" ? "Screenshot" : k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          {(draft.kind === "link" || draft.kind === "video") && (
            <>
              <div className="search-box url-box">
                <Link2Icon />
                <Input
                  aria-label="URL"
                  value={draft.url}
                  placeholder="Paste a link..."
                  onChange={(e) => {
                    metadataToken.current++;
                    setBusy(false);
                    changed({ url: e.target.value, preview: undefined });
                  }}
                  onBlur={() => {
                    if (draft.url) void metadata();
                  }}
                />
                <IconButton
                  label="Clear URL"
                  onClick={() => changed({ url: "", preview: undefined })}
                >
                  <Cross2Icon />
                </IconButton>
              </div>
              {draft.url && (
                <div className="link-preview">
                  <ImagePreview src={thumb(draft)} />
                  <div>
                    <strong>{draft.title || "Link preview"}</strong>
                    <small>
                      {(() => {
                        try {
                          return parseURL(draft.url).hostname;
                        } catch {
                          return "Enter a valid URL";
                        }
                      })()}
                    </small>
                  </div>
                </div>
              )}
            </>
          )}
          {(draft.kind === "image" || draft.kind === "file") && (
            <>
              <button
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
              >
                {thumb(draft) ? (
                  <img src={thumb(draft)} alt="Selected attachment" />
                ) : (
                  <>
                    <ImageIcon />
                    <span>
                      Choose{" "}
                      {draft.kind === "file" ? "file" : "screenshot or image"}
                    </span>
                  </>
                )}
              </button>
              {draft.kind === "image" && draft.assetId && (
                <button className="field" disabled={busy} onClick={runOCR}>
                  Extract text from image
                </button>
              )}
              {visionStatus && (
                <p className="muted">
                  {visionStatus}
                </p>
              )}
              {ocrStatus && (
                <p role="status" className="hint">
                  {ocrStatus}
                </p>
              )}
            </>
          )}
          <label className="form-label">
            Title
            <Input
              className="field"
              value={draft.title}
              aria-label="Title"
              placeholder="Title"
              onChange={(e) => changed({ title: e.target.value })}
            />
          </label>
          <label className="form-label">
            Collection
            <button
              className="field collection-select"
              onClick={() => openSheet("choose-collection")}
            >
              <ArchiveIcon />
              <span>
                {collections.find((c) => c.id === draft.collectionId)?.name ||
                  "Unsorted"}
              </span>
              <ChevronRightIcon />
            </button>
          </label>
          <label className="form-label">
            {draft.kind === "note" ? "Note" : "Add a note (optional)"}
            <Textarea
              className="field note-field"
              aria-label="Note"
              value={draft.note}
              placeholder="Write a note..."
              onChange={(e) => changed({ note: e.target.value })}
            />
          </label>
          <div className="attachments">
            {thumb(draft) && <img src={thumb(draft)} alt="Attachment" />}
            <button
              aria-label="Add attachment"
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon />
            </button>
          </div>
          <label className="form-label">
            Tags (comma separated)
            <Input
              className="field"
              aria-label="Tags"
              placeholder="Travel, Inspiration"
              value={draft.tags}
              onChange={(e) => changed({ tags: e.target.value })}
            />
          </label>
          {draft.ocr && (
            <details>
              <summary>Extracted text</summary>
              <Textarea
                className="field"
                aria-label="Extracted text"
                value={draft.ocr}
                onChange={(e) => changed({ ocr: e.target.value })}
              />
            </details>
          )}
        </>
      )}
      {page === "details" && detail && (
        <>
          <header className="toolbar">
            <IconButton label="Back" onClick={() => go("all")}>
              <ChevronLeftIcon />
            </IconButton>
            <div className="toolbar-actions">
              <IconButton
                label={detail.favorite ? "Remove favorite" : "Favorite"}
                onClick={() => favorite(detail)}
              >
                <BookmarkIcon weight={detail.favorite ? "fill" : "regular"} />
              </IconButton>
              <IconButton
                label="Bookmark options"
                onClick={() => {
                  setMenuItem(detail);
                  openSheet("item");
                }}
              >
                <DotsHorizontalIcon />
              </IconButton>
            </div>
          </header>
          <ImagePreview src={thumb(detail)} hero id={detail.id} />
          <h1 className="detail-title">{detail.title}</h1>
          <p className="source">
            <Link2Icon />
            {detail.domain || detail.fileName || detail.kind}
          </p>
          <div className="tags">
            {detail.tags.map((t) => (
              <button
                key={t}
                onClick={() => {
                  go("search");
                  setQuery(t);
                }}
              >
                {t}
              </button>
            ))}
            <button aria-label="Edit tags" onClick={() => edit(detail)}>
              <PlusIcon />
            </button>
          </div>
          <p className="description">{detail.note || detail.description}</p>
          {detail.url && (
            <a
              className="primary open-link"
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Link <ExternalLinkIcon />
            </a>
          )}
          {detail.assetId && (
            <a
              className="primary open-link"
              href={urls[detail.assetId]}
              download={detail.fileName || "image.jpg"}
            >
              Download <DownloadIcon />
            </a>
          )}
          <label className="form-label">
            Saved in
            <button
              className="field collection-select"
              onClick={() => {
                setMenuItem(detail);
                openSheet("move");
              }}
            >
              <ArchiveIcon />
              <span>
                {collections.find((c) => c.id === detail.collectionId)?.name ||
                  "Unsorted"}
              </span>
              <ChevronRightIcon />
            </button>
          </label>
          <label className="form-label">
            Saved on
            <div className="saved-date">
              <CalendarIcon />
              {new Date(detail.createdAt).toLocaleString()}
            </div>
          </label>
          {detail.ocr && (
            <details>
              <summary>Extracted text</summary>
              <p className="description">{detail.ocr}</p>
            </details>
          )}
        </>
      )}
      {page === "profile" && (
        <>
          <header className="heading">
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
          </header>
          <div className="profile-brand">
            <img
              src={dark ? "/brand/logo-dark.png" : "/brand/logo-crop.png"}
              alt=""
            />
            <h2>Your bookmarks</h2>
            <p>
              {items.length} items · {collections.length} collections
            </p>
          </div>
          <h2 className="date-heading">Appearance</h2>
          <div className="theme-options">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                className="field"
                aria-pressed={theme === t}
                key={t}
                onClick={async () => {
                  setTheme(t);
                  await repo.put("settings", { id: "theme", value: t });
                }}
              >
                {t[0].toUpperCase() + t.slice(1)}
                {theme === t && <CheckIcon />}
              </button>
            ))}
          </div>
          <button
            className="field settings-row"
            onClick={() => {
              go("all");
              setFavoriteOnly(true);
              setQuery("");
            }}
          >
            <StarIcon />
            Favorites
            <ChevronRightIcon />
          </button>
          <button className="field settings-row" onClick={exportData}>
            <DownloadIcon />
            Export local backup
          </button>
          <p className="hint">Saved on this device. No account required.</p>
        </>
      )}
    </motion.main>
  );
  const sheetContent = (
    <>
      {sheet === "more" && (
        <>
          <button
            className="sheet-action"
            onClick={() => {
              setSheet("");
              add("file");
            }}
          >
            Save a file
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setSheet("");
              add("video");
            }}
          >
            Save a video link
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setSheet("");
              newCollection();
            }}
          >
            New collection
          </button>
        </>
      )}
      {sheet === "item" && menuItem && (
        <>
          <button className="sheet-action" onClick={() => edit(menuItem)}>
            Edit bookmark
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              favorite(menuItem);
              setSheet("");
            }}
          >
            {menuItem.favorite ? "Remove from favorites" : "Add to favorites"}
          </button>
          <button className="sheet-action" onClick={() => setSheet("move")}>
            Move to collection
          </button>
          <button
            className="sheet-action danger"
            onClick={() => setSheet("delete-item")}
          >
            Delete bookmark
          </button>
        </>
      )}
      {sheet === "delete-item" && menuItem && (
        <>
          <p>Delete “{menuItem.title}”? This cannot be undone.</p>
          <button
            className="primary danger"
            onClick={() => removeItem(menuItem)}
          >
            Delete bookmark
          </button>
        </>
      )}
      {(sheet === "choose-collection" || sheet === "move") && (
        <>
          {[{ id: "", name: "Unsorted" }, ...collections].map((c) => (
            <button
              className="sheet-action"
              key={c.id}
              onClick={async () => {
                if (sheet === "move" && menuItem) {
                  await repo.put("bookmarks", {
                    ...menuItem,
                    collectionId: c.id,
                    updatedAt: Date.now(),
                  });
                  await reload();
                } else changed({ collectionId: c.id });
                setSheet("");
              }}
            >
              <ArchiveIcon />
              {c.name}
            </button>
          ))}
          <button className="sheet-action" onClick={newCollection}>
            <PlusIcon />
            New collection
          </button>
        </>
      )}
      {sheet === "collections-options" && (
        <>
          <button className="sheet-action" onClick={newCollection}>
            New collection
          </button>
          <p className="hint">
            Use a collection’s menu to change its cover or order.
          </p>
        </>
      )}
      {sheet === "collection" && menuCollection && (
        <>
          <button
            className="sheet-action"
            onClick={() => {
              setCollectionName(menuCollection.name);
              setSheet("collection-form");
            }}
          >
            Rename collection
          </button>
          <button
            className="sheet-action"
            onClick={() => coverRef.current?.click()}
          >
            Choose cover image
          </button>
          <button
            className="sheet-action"
            onClick={async () => {
              const first = collections[0];
              if (first && first.id !== menuCollection.id) {
                await repo.put("collections", {
                  ...menuCollection,
                  order: first.order - 1,
                });
                await reload();
              }
              setSheet("");
            }}
          >
            Move to first
          </button>
          <button
            className="sheet-action danger"
            onClick={() => setSheet("delete-collection")}
          >
            Delete collection
          </button>
        </>
      )}
      {sheet === "delete-collection" && menuCollection && (
        <>
          <p>
            Delete “{menuCollection.name}”? Its bookmarks will move to Unsorted.
          </p>
          <button
            className="primary danger"
            onClick={async () => {
              await deleteCollection(menuCollection.id);
              await reload();
              setSheet("");
              setToast("Collection deleted. Bookmarks kept.");
            }}
          >
            Delete collection
          </button>
        </>
      )}
      {sheet === "collection-form" && (
        <>
          <label className="form-label">
            Name
            <Input
              className="field"
              aria-label="Collection name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Collection name"
            />
          </label>
          <button
            className="primary"
            disabled={!collectionName.trim()}
            onClick={saveCollection}
          >
            Save collection
          </button>
        </>
      )}
      {sheet === "filters" && (
        <>
          <button
            className="sheet-action"
            onClick={() => {
              setFavoriteOnly((v) => !v);
              setSheet("");
            }}
          >
            {favoriteOnly ? "Show all bookmarks" : "Favorites only"}
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setCollectionFilter("");
              setFavoriteOnly(false);
              setSheet("");
            }}
          >
            Clear filters
          </button>
        </>
      )}
    </>
  );
  return (
    <StandaloneContext.Provider value={standalone}>
      <MotionConfig reducedMotion="user">
        <div
          className={`bookmark-app ${standalone ? "standalone" : ""}`}
          data-theme={dark ? "dark" : "light"}
        >
          {standalone ? (
            <div className="native-scroll">{body}</div>
          ) : (
            <MobileScroll className="app-scroll">{body}</MobileScroll>
          )}
          {!["add", "details"].includes(page) && (
            <nav className="bottom-nav" aria-label="Main navigation">
              {(
                [
                  {
                    id: "home",
                    label: "Home",
                    icon: (
                      <HomeIcon weight={page === "home" ? "fill" : "regular"} />
                    ),
                  },
                  {
                    id: "collections",
                    label: "Collections",
                    icon: (
                      <ArchiveIcon
                        weight={page === "collections" ? "fill" : "regular"}
                      />
                    ),
                  },
                  { id: "add", label: "Add bookmark", icon: <PlusIcon /> },
                  {
                    id: "search",
                    label: "Search",
                    icon: <MagnifyingGlassIcon />,
                  },
                  { id: "profile", label: "Profile", icon: <PersonIcon /> },
                ] as const
              ).map((n) => (
                <motion.button
                  key={n.id}
                  className={`${n.id === "add" ? "nav-add" : ""} ${page === n.id ? "active" : ""}`}
                  aria-label={n.label}
                  aria-current={page === n.id ? "page" : undefined}
                  onClick={() => (n.id === "add" ? add() : go(n.id))}
                  whileTap={{ scale: n.id === "add" ? 1.1 : 0.94 }}
                >
                  {n.icon}
                  {n.id !== "add" && <span>{n.label}</span>}
                </motion.button>
              ))}
            </nav>
          )}
          <AnimatePresence>
            {toast && (
              <motion.div
                role="status"
                className="toast"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <CheckIcon />
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
          <input
            className="hidden-file"
            type="file"
            ref={fileRef}
            accept={
              draft.kind === "file"
                ? undefined
                : "image/png,image/jpeg,image/webp,image/gif"
            }
            onChange={(e) => {
              void chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            className="hidden-file"
            type="file"
            ref={coverRef}
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f && menuCollection) {
                try {
                  const id = await storeFile(f);
                  await repo.put("collections", {
                    ...menuCollection,
                    coverId: id,
                  });
                  await reload();
                  setSheet("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }
              e.target.value = "";
            }}
          />
          {standalone ? (
            <Dialog.Root
              open={!!sheet}
              onOpenChange={(v) => {
                if (!v) setSheet("");
              }}
            >
              <Dialog.Overlay className="native-sheet-backdrop" />
              <Dialog.Content asChild>
                <motion.section
                  className="native-sheet"
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <header>
                    <Dialog.Title asChild>
                      <h2>
                        {sheet === "collection-form" ? "Collection" : "Options"}
                      </h2>
                    </Dialog.Title>
                    <IconButton
                      label="Close options"
                      onClick={() => setSheet("")}
                    >
                      <Cross2Icon />
                    </IconButton>
                  </header>
                  <Dialog.Description className="visually-hidden">
                    Manage your saved items and collections.
                  </Dialog.Description>
                  {sheetContent}
                </motion.section>
              </Dialog.Content>
            </Dialog.Root>
          ) : (
            <BottomSheet
              open={!!sheet}
              onOpenChange={(v) => {
                if (!v) setSheet("");
              }}
              title={sheet === "collection-form" ? "Collection" : "Options"}
            >
              <div className="sheet-content">{sheetContent}</div>
            </BottomSheet>
          )}
        </div>
      </MotionConfig>
    </StandaloneContext.Provider>
  );
}
