import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  repo,
  searchBookmarks,
  parseURL,
  deleteCollection,
  newId,
  type Bookmark,
  type Collection,
} from "../src/data";
const make = (p: Partial<Bookmark> = {}): Bookmark => ({
  id: newId(),
  kind: "note",
  title: "Long title",
  url: "",
  domain: "",
  note: "mobile reference",
  description: "",
  tags: ["design"],
  collectionId: "research",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  favorite: false,
  ocr: "Mountain travel journal",
  ...p,
});
test("searches all requested fields and combines terms", () => {
  const c: Collection[] = [{ id: "research", name: "Research lab", order: 0 }];
  const a = make({
    url: "https://example.org/path",
    domain: "example.org",
    description: "inspiration",
  });
  for (const term of [
    "long",
    "example.org",
    "mobile",
    "design",
    "Research",
    "Mountain",
    "inspiration",
  ])
    assert.equal(searchBookmarks([a], c, term).length, 1);
  assert.equal(searchBookmarks([a], c, "mobile mountain").length, 1);
  assert.equal(searchBookmarks([a], c, "notfound").length, 0);
});
test("URL validation rejects scripts and malformed URLs", () => {
  assert.equal(parseURL("example.org").href, "https://example.org/");
  for (const u of [
    "",
    "invalid",
    "javascript:alert(1)",
    "https://user:pass@example.com",
  ])
    assert.throws(() => parseURL(u));
});
test("persistent CRUD and collection deletion preserves items", async () => {
  const a = make();
  await repo.put("collections", { id: "research", name: "Research", order: 0 });
  await repo.put("bookmarks", a);
  assert.equal((await repo.get<Bookmark>("bookmarks", a.id))?.title, a.title);
  await repo.put("bookmarks", { ...a, title: "Edited" });
  assert.equal((await repo.get<Bookmark>("bookmarks", a.id))?.title, "Edited");
  await deleteCollection("research");
  assert.equal((await repo.get<Bookmark>("bookmarks", a.id))?.collectionId, "");
  assert.equal(await repo.get("collections", "research"), undefined);
  await repo.remove("bookmarks", a.id);
  assert.equal(await repo.get("bookmarks", a.id), undefined);
});
test("search over 10,000 items includes long notes and OCR", () => {
  const items = Array.from({ length: 10000 }, (_, i) =>
    make({
      title: `Item ${i}`,
      note: i === 7777 ? "needle ".repeat(2000) : "ordinary",
      ocr: "",
    }),
  );
  assert.equal(searchBookmarks(items, [], "needle").length, 1);
});
