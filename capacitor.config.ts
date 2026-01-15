import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.securevault.manager",
  appName: "SecureVault Manager",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    FileOpener: {
    },
    Filesystem: {
    },
    Preferences: {
    },
    Haptics: {
    },
  },
};
export default config;
