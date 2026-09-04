// Backend Gateway Configuration
// Set SHOW_GATEWAY_CONFIG_SCREEN to true to manually enter/edit the Gateway Server URL
// Set SHOW_GATEWAY_CONFIG_SCREEN to false to connect directly to the configured backend
export const SHOW_GATEWAY_CONFIG_SCREEN = false;

// NOTE: Set to localhost:3000 for active development/testing. Remember to switch back to Vercel production before final deployment!
export const DEFAULT_GATEWAY_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL || "http://localhost:3000";
