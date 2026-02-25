import { useEffect, useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/useTheme";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCreateCase } from "../features/cases/hooks";

/**
 * Create-case orchestrator (no form).
 * - No animalId: redirect to select-animal; after pick, that screen creates case and goes to case-detail.
 * - With animalId: create case with defaults, then replace to case-detail.
 */
export default function CreateCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { data: doctor, isLoading: doctorLoading } = useCurrentDoctor();
  const createCaseMutation = useCreateCase();
  const didNavigateRef = useRef(false);
  const createStartedRef = useRef(false);

  const rawAnimalId = params.animalId ?? params.AnimalId;
  const animalId =
    rawAnimalId != null && String(rawAnimalId).trim() !== ""
      ? Number(rawAnimalId)
      : undefined;

  useEffect(() => {
    if (didNavigateRef.current) return;
    if (doctorLoading) return;

    if (!doctor) {
      didNavigateRef.current = true;
      router.replace("/select-animal?createCaseAfterSelect=1");
      return;
    }

    if (!animalId || animalId <= 0 || !Number.isFinite(animalId)) {
      didNavigateRef.current = true;
      router.replace("/select-animal?createCaseAfterSelect=1");
      return;
    }

    if (createStartedRef.current) return;
    createStartedRef.current = true;

    let cancelled = false;
    const run = async () => {
      try {
        const caseData = await createCaseMutation.mutateAsync({
          animalId,
          doctorId: doctor.doctorId,
          caseDatetime: new Date().toISOString(),
          chiefComplaint: undefined,
          status: "COMPLETED",
        });
        if (cancelled) return;
        didNavigateRef.current = true;
        router.replace(`/case-detail?caseId=${caseData.caseId}&fromCreate=1`);
      } catch {
        if (cancelled) return;
        createStartedRef.current = false;
        didNavigateRef.current = true;
        router.replace("/select-animal?createCaseAfterSelect=1");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [animalId, doctor, doctorLoading, createCaseMutation, router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
