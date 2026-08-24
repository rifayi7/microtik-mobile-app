import { Platform, LogBox } from "react-native";

/**
 * Filter out known benign react-native-web deprecation warnings emitted by third-party libraries
 * such as @react-navigation / expo-router (e.g. "shadow*" style props and props.pointerEvents)
 */
export function initDeprecationSuppressor() {
  // Suppress in native LogBox
  LogBox.ignoreLogs([
    '"shadow*" style props are deprecated. Use "boxShadow".',
    "props.pointerEvents is deprecated. Use style.pointerEvents",
  ]);

  // Suppress in browser / web console
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof console !== "undefined") {
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    const isIgnored = (arg: any): boolean => {
      if (typeof arg === "string") {
        return (
          arg.includes('"shadow*" style props are deprecated') ||
          arg.includes("props.pointerEvents is deprecated") ||
          arg.includes("Use style.pointerEvents")
        );
      }
      return false;
    };

    console.warn = (...args: any[]) => {
      if (args.some(isIgnored)) return;
      originalWarn(...args);
    };

    console.error = (...args: any[]) => {
      if (args.some(isIgnored)) return;
      originalError(...args);
    };
  }
}
