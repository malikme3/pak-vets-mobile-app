import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemePreferenceProvider } from "../theme/ThemeProvider";

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
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="index" options={{ title: "Home" }} />
            <Stack.Screen
              name="animal-details"
              options={{ title: "Animal Details" }}
            />
            <Stack.Screen
              name="select-animal"
              options={{ title: "Select Animal" }}
            />
            <Stack.Screen
              name="create-animal"
              options={{ title: "Create Animal" }}
            />
            <Stack.Screen
              name="add-diagnosis"
              options={{ title: "Add Diagnosis" }}
            />
            <Stack.Screen
              name="add-treatment"
              options={{ title: "Add Treatment" }}
            />
            <Stack.Screen name="add-note" options={{ title: "Add Note" }} />
            <Stack.Screen name="add-media" options={{ title: "Add Media" }} />
            <Stack.Screen
              name="create-case"
              options={{ title: "Create Case" }}
            />
            <Stack.Screen
              name="case-detail"
              options={{ title: "Case Details" }}
            />
            <Stack.Screen
              name="nearby-cases"
              options={{ title: "Nearby Cases" }}
            />
          </Stack>
        </QueryClientProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}
