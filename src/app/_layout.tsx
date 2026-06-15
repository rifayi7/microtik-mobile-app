import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { GatewayProvider } from '../contexts/gateway-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GatewayProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(dashboard)" />
        </Stack>
      </ThemeProvider>
    </GatewayProvider>
  );
}
