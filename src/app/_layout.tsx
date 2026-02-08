import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="animal-details" />
        <Stack.Screen name="create-visit" />
        <Stack.Screen name="select-animal" />
        <Stack.Screen name="create-animal" />
        <Stack.Screen name="visit-detail" />
        <Stack.Screen name="add-diagnosis" />
        <Stack.Screen name="add-treatment" />
        <Stack.Screen name="add-note" />
        <Stack.Screen name="add-media" />
      </Stack>
    </QueryClientProvider>
  );
}
