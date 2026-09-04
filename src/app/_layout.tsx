import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { GatewayProvider } from '../contexts/gateway-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDeprecationSuppressor } from '../lib/suppress-warnings';

initDeprecationSuppressor();

const CustomLightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#DC2626',
    background: '#F8FAFC',
    card: '#ffffff',
    text: '#1e293b',
    border: '#e2e8f0',
    notification: '#DC2626',
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GatewayProvider>
        <ThemeProvider value={CustomLightTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(dashboard)" />
          </Stack>
        </ThemeProvider>
      </GatewayProvider>
    </SafeAreaProvider>
  );
}
