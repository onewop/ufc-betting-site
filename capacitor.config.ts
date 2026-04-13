import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.onewop.ufcbetting",
  appName: "UFC Betting",
  webDir: "build",

  android: {
    zoomEnabled: false, // Disables pinch-to-zoom
    backgroundColor: "#0c0a09", // stone-950 – avoids white flash on load
  },

  plugins: {
    StatusBar: {
      style: "DARK", // Use 'LIGHT' if your site has a light background
    },
  },
};

export default config;
