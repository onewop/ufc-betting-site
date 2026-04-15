import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.onewop.ufcbetting",
  appName: "Cage Vault",
  webDir: "build",

  android: {
    zoomEnabled: false,
    backgroundColor: "#0c0a09", // dark background
    // Do NOT add adjustMarginsForEdgeToEdge here — overlaysWebView: true already
    // makes the WebView full-bleed; adding that option causes Android to apply
    // native margins AND env() to both fire, creating a double-inset bounce.
  },

  plugins: {
    StatusBar: {
      style: "LIGHT",
      overlaysWebView: true, // WebView draws under status bar; CSS env() handles insets
      backgroundColor: "#92400e", // match nav colour so status bar blends in
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0c0a09", // match app background; prevents white flash on launch
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
