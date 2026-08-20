import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { GatewayProvider } from '../contexts/gateway-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const CustomLightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4A60D6',
    background: '#F8FAFC',
    card: '#ffffff',
    text: '#1e293b',
    border: '#e2e8f0',
    notification: '#4A60D6',
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
