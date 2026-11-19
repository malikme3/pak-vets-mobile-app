import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import {
  getFarmReview,
  type FarmAnimalReview,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  surface: "#FFFFFF",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  danger: "#B42318",
};

export default function AnimalCaseDashboard() {
  const router = useRouter();
  const { farmId, animalEntryId } = useLocalSearchParams<{
    farmId: string;
    animalEntryId: string;
  }>();
  const [animal, setAnimal] = useState<FarmAnimalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      setAnimal(null);

      async function load() {
        try {
          if (!farmId || !animalEntryId)
            throw new Error("Open the case dashboard from an animal page.");
          const farm = await getFarmReview(farmId);
          const selected = farm.animals.find(
            (item) => item.entryId === animalEntryId,
          );
          if (!selected)
            throw new Error("This animal is no longer on the farm.");
          if (!cancelled) setAnimal(selected);
        } catch (cause) {
          if (!cancelled)
            setError(
              cause instanceof Error
                ? cause.message
                : "The cases could not be loaded.",
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [farmId, animalEntryId, attempt]),
  );

  const cases = [...(animal?.cases ?? [])].sort((left, right) =>
    right.openedAt.localeCompare(left.openedAt),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FlatList
        contentContainerStyle={styles.content}
        data={cases}
        keyExtractor={(item) => item.entryId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.back}
            >
              <Feather name="arrow-left" size={18} color={colors.green} />
              <Text style={styles.link}>Animal</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              Case dashboard
            </Text>
            {animal ? (
              <>
                <Text style={styles.subtitle}>{animal.name}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/health-case",
                      params: { farmId, animalEntryId },
                    })
                  }
                  style={styles.action}
                >
                  <Feather name="plus" size={16} color={colors.surface} />
                  <Text style={styles.actionText}>Add case</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading cases"
              color={colors.green}
            />
          ) : error ? (
            <View style={styles.status}>
              <Text style={styles.error}>{error}</Text>
              {farmId && animalEntryId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((current) => current + 1)}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={styles.subtitle}>No cases for this animal yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const opened = new Date(item.openedAt);
          const date = Number.isNaN(opened.getTime())
            ? ""
            : opened.toLocaleDateString();
          const status = item.status === "draft" ? "Draft" : "Saved";
          return (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/health-case-detail",
                  params: { farmId, entryId: item.entryId },
                })
              }
            >
              <View style={styles.copy}>
                <Text numberOfLines={2} style={styles.caseTitle}>
                  {item.complaint ||
                    (item.status === "draft" ? "Draft case" : "Health case")}
                </Text>
                <Text style={styles.subtitle}>
                  {[status, date].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  header: { gap: 10, marginBottom: 6 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
  },
  link: { color: colors.green, fontSize: 15, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14 },
  action: {
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  copy: { flex: 1, gap: 4 },
  caseTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  status: { gap: 8 },
  error: { color: colors.danger, fontSize: 14 },
});
