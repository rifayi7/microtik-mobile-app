// Backend Gateway Configuration
// Set SHOW_GATEWAY_CONFIG_SCREEN to true to manually enter/edit the Gateway Server URL
// Set SHOW_GATEWAY_CONFIG_SCREEN to false to connect directly to the configured backend
export const SHOW_GATEWAY_CONFIG_SCREEN = false;

// Automatically uses localhost:3000 in local development (__DEV__ is true when running `npx expo start`),
// and uses the production Vercel URL in production builds or when EXPO_PUBLIC_GATEWAY_URL is provided.
export const DEFAULT_GATEWAY_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  (__DEV__ ? "http://localhost:3000" : "https://microtik-nine.vercel.app");
