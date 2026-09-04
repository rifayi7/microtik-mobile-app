// Backend Gateway Configuration
// Set SHOW_GATEWAY_CONFIG_SCREEN to true to manually enter/edit the Gateway Server URL
// Set SHOW_GATEWAY_CONFIG_SCREEN to false to connect directly to the configured backend
export const SHOW_GATEWAY_CONFIG_SCREEN = false;

export const DEFAULT_GATEWAY_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL || "https://microtik-nine.vercel.app";
