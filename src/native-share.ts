import { Capacitor, registerPlugin } from "@capacitor/core";
import { newId, repo } from "./data";
const share = registerPlugin<{
  take: () => Promise<{
    text?: string;
    title?: string;
    base64?: string;
    type?: string;
    name?: string;
    error?: string;
  }>;
  addListener: (
    name: string,
    fn: () => void,
  ) => Promise<{ remove: () => void }>;
}>("ShareInbox");
export async function receiveNativeShare(onIncoming: () => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let active = true;
  const consume = async () => {
    const value = await share.take();
    if (!active) return;
    if (value.error) {
      window.dispatchEvent(
        new CustomEvent("share-error", { detail: value.error }),
      );
    }
    if (!value.text && !value.base64) return;
    const files: File[] = [];
    if (value.base64) {
      const bytes = Uint8Array.from(atob(value.base64), (c) => c.charCodeAt(0));
      files.push(
        new File([bytes], value.name || "Shared image", {
          type: value.type || "application/octet-stream",
        }),
      );
    }
    await repo.put("inbox", {
      id: newId(),
      text: value.text || "",
      title: value.title || "",
      url: "",
      files,
    });
    onIncoming();
  };
  const listener = await share.addListener("incoming", () => {
    void consume();
  });
  await consume();
  return () => {
    active = false;
    void listener.remove();
  };
}
