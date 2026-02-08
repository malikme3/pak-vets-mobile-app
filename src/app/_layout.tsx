import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="animal-details" />
      <Stack.Screen name="create-visit" />
      <Stack.Screen name="select-animal" />
      <Stack.Screen name="create-animal" />
    </Stack>
  );
}
