import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BLEProvider } from '../context/BLEContext';

export default function RootLayout() {
  return (
    <BLEProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0a0a0a' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SmartCounter', headerLargeTitle: true }} />
        <Stack.Screen name="workout" options={{ title: 'Live Workout' }} />
        <Stack.Screen name="history" options={{ title: 'Session History' }} />
      </Stack>
    </BLEProvider>
  );
}
