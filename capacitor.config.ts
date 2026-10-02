import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.bookmarks.local",
  appName: "Bookmarks",
  webDir: "dist-app",
  server: { androidScheme: "https" },
};
export default config;
