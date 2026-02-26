import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { AppInput } from "../components/ui/AppInput";
import { useCurrentDoctor, useUpdateDoctor } from "../features/doctors/hooks";
import { useCasesByDoctor, useDeleteCase } from "../features/cases/hooks";
import { useAnimalImages, useAnimal } from "../features/animals/hooks";
import { caseApi } from "../services/vetApi";
import { getFirebaseAuth } from "../services/firebase";
import { getBucketName, getUploadSignedUrl } from "../services/sharedServicesApi";
import {
  getCaseDistanceKm,
  formatCaseDistanceLabel,
} from "../utils/formatDistance";
import type { Case } from "../types/api";

const ACTIVE_CASES_LIMIT_MIN = 1;
const ACTIVE_CASES_LIMIT_MAX = 100;
const ACTIVE_CASES_LIMIT_DEFAULT = 15;
const NEARBY_RADIUS_KM = 0.5;

function sanitizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isValidPhone(value: string) {
  return value.length === 11 && value.startsWith("0");
}

function resolveImageExtension(uri: string, fileName?: string | null) {
  const name = fileName || uri.split("/").pop() || "";
  const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch?.[1]?.toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext && ["jpg", "png", "webp"].includes(ext)) return ext;
  return "jpg";
}

function resolveImageContentType(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function formatPhone(value: string) {
  const digits = sanitizePhone(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}

function isPlaceholderDoctorName(name?: string | null, email?: string | null) {
  const normalizedName = name?.trim().toLowerCase() || "";
  const normalizedEmail = email?.trim().toLowerCase() || "";
  if (!normalizedName) return true;
  if (normalizedName === "doctor") return true;
  if (normalizedEmail && normalizedName === normalizedEmail) return true;
  return false;
}

export default function DashboardScreen() {
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const clearAuth = useAuthStore((state) => state.clear);
  const isAuthed = authStatus === "signedIn";
  const {
    colors,
    isAltTheme,
    variant,
    isNeonTheme,
    isEcoTheme,
    toggleThemeVariant,
    themeName,
    copy,
  } = useTheme();
  const [activeCasesLimit, setActiveCasesLimit] = useState(
    ACTIVE_CASES_LIMIT_DEFAULT,
  );
  const [finding, setFinding] = useState(false);
  const [nearbyCases, setNearbyCases] = useState<Case[] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDoctorType, setProfileDoctorType] = useState("DVM");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileAvatarLocalUri, setProfileAvatarLocalUri] = useState<
    string | null
  >(null);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const hasAutoOpenedProfileModalRef = useRef(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePhoneError, setProfilePhoneError] = useState<string | null>(
    null,
  );
  const {
    data: doctor,
    isLoading: doctorLoading,
    error: doctorError,
    refetch: refetchDoctor,
  } = useCurrentDoctor();
  const updateDoctorMutation = useUpdateDoctor();
  const {
    data: allCases,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useCasesByDoctor(doctor?.doctorId ?? 0);
  const deleteCaseMutation = useDeleteCase();

  useFocusEffect(
    useCallback(() => {
      if (doctor?.doctorId) refetchCases();
    }, [doctor?.doctorId, refetchCases]),
  );

  const activeCases = useMemo(
    () =>
      allCases
        ? [...allCases]
            .filter((c) => c.isActive)
            .sort(
              (a, b) =>
                new Date(b.caseDatetime).getTime() -
                new Date(a.caseDatetime).getTime(),
            )
            .slice(0, activeCasesLimit)
        : [],
    [allCases, activeCasesLimit],
  );

  const needsProfileUpdate = useMemo(() => {
    if (!doctor) return false;
    return isPlaceholderDoctorName(doctor.fullName, doctor.email);
  }, [doctor]);

  const doctorDisplayName = useMemo(() => {
    if (!doctor) return "";
    if (isPlaceholderDoctorName(doctor.fullName, doctor.email)) {
      return "<Your Name>";
    }
    return doctor.fullName?.trim() || "<Your Name>";
  }, [doctor]);

  useEffect(() => {
    if (!doctor) return;
    setProfileName(
      isPlaceholderDoctorName(doctor.fullName, doctor.email)
        ? ""
        : (doctor.fullName ?? ""),
    );
    setProfileDoctorType(doctor.doctorType ?? "DVM");
    setProfilePhone((doctor.phone ?? "").replace(/\D/g, ""));
    setProfileCity(doctor.cityName ?? "");
    setProfileAvatarUrl(doctor.profileAvatarUrl ?? "");
    setProfileAvatarLocalUri(null);
    if (!needsProfileUpdate) {
      hasAutoOpenedProfileModalRef.current = false;
    } else if (!hasAutoOpenedProfileModalRef.current) {
      setProfileModalVisible(true);
      hasAutoOpenedProfileModalRef.current = true;
    }
  }, [doctor, needsProfileUpdate]);

  const findNearby = useCallback(async () => {
    if (!doctor) return;
    setLocationError(null);
    setFinding(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Location permission is required to find nearby cases.",
        );
        setFinding(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const cases = await caseApi.getCasesByDoctor(doctor.doctorId, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        radiusKm: NEARBY_RADIUS_KM,
      });
      setNearbyCases(cases);
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : "Could not get location",
      );
      setNearbyCases(null);
    } finally {
      setFinding(false);
    }
  }, [doctor]);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleCasePress = useCallback(
    (caseId: number) => {
      router.push(`/case-detail?caseId=${caseId}`);
    },
    [router],
  );

  const handleDeleteCase = useCallback(
    (caseItem: Case) => {
      Alert.alert(
        "Delete Case",
        `Delete Case #${caseItem.caseId}? This will remove the case and all related diagnoses, treatments, and notes.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteCaseMutation.mutateAsync(caseItem.caseId);
              } catch (error) {
                Alert.alert(
                  "Error",
                  error instanceof Error
                    ? error.message
                    : "Failed to delete case",
                );
              }
            },
          },
        ],
      );
    },
    [deleteCaseMutation],
  );

  const renderCaseItem = useCallback(
    ({ item }: { item: Case }) => (
      <CaseRow
        caseItem={item}
        formatDate={formatDate}
        onPress={() => handleCasePress(item.caseId)}
        onDelete={() => handleDeleteCase(item)}
        isDeleting={deleteCaseMutation.isPending}
      />
    ),
    [
      formatDate,
      handleCasePress,
      handleDeleteCase,
      deleteCaseMutation.isPending,
    ],
  );

  if (!isAuthed) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (doctorLoading || casesLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor && !doctorLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Failed to load doctor data
          </Text>
          {doctorError && (
            <Text style={[styles.errorDetail, { color: colors.muted }]}>
              {doctorError instanceof Error
                ? doctorError.message
                : "Unknown error"}
            </Text>
          )}
          <Button
            title="Retry"
            onPress={() => refetchDoctor()}
            variant="primary"
            style={styles.retryButton}
            leftIcon={
              <FontAwesome name="refresh" size={14} color={colors.onPrimary} />
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return null;
  }

  const handleNewCase = () => {
    router.push("/create-case");
  };

  const handlePickProfileImage = async () => {
    if (!doctor) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need access to your photos to set a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert("Upload failed", "Selected image is unavailable.");
      return;
    }
    const ext = resolveImageExtension(asset.uri, asset.fileName);
    const contentType = resolveImageContentType(ext);
    const s3Key = `doctors/profile_doctorId-${doctor.doctorId}.${ext}`;
    const bucketName = getBucketName();
    setProfileAvatarUploading(true);
    try {
      const { signedUrl, fileUrl } = await getUploadSignedUrl(
        bucketName,
        s3Key,
        "type=doctor-profile",
      );
      const fileInfo = await new File(asset.uri).info();
      if (!fileInfo.exists) throw new Error("File does not exist");
      const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(fileBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": contentType },
      });
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse
          .text()
          .catch(() => uploadResponse.statusText);
        throw new Error(`S3 upload failed: ${errorText || uploadResponse.statusText}`);
      }
      setProfileAvatarUrl(fileUrl);
      setProfileAvatarLocalUri(asset.uri);
    } catch (err) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Unable to upload profile photo.",
      );
    } finally {
      setProfileAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!doctor) return;
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileError("Full name is required.");
      return;
    }
    const normalizedPhone = sanitizePhone(profilePhone);
    if (!isValidPhone(normalizedPhone)) {
      setProfilePhoneError("Phone must start with 0 and be 11 digits.");
      return;
    }
    setProfilePhoneError(null);
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch {
      // Skip location if unavailable
    }
    try {
      await updateDoctorMutation.mutateAsync({
        doctorId: doctor.doctorId,
        request: {
          fullName: trimmedName,
          phone: normalizedPhone,
          doctorType: profileDoctorType.trim() || "DVM",
          cityName: profileCity.trim() || undefined,
          latitude,
          longitude,
          profileAvatarUrl: profileAvatarUrl || undefined,
        },
      });
      setProfileModalVisible(false);
      setProfileError(null);
    } catch (err) {
      Alert.alert(
        "Update failed",
        err instanceof Error ? err.message : "Unable to update profile.",
      );
    }
  };

  const heroAvatarUri =
    profileAvatarLocalUri || profileAvatarUrl || doctor.profileAvatarUrl || "";
  const nearbyHintText = copy.nearbyHint.replace(
    "{{radius}}",
    String(NEARBY_RADIUS_KM),
  );
  const nextThemeLabel =
    variant === "classic"
      ? "Neon Menagerie Orbit"
      : variant === "neonMenagerieOrbit"
        ? "Eco-Organic"
        : "Classic Clinical";
  const nextThemeIcon: keyof typeof FontAwesome.glyphMap =
    variant === "classic"
      ? "magic"
      : variant === "neonMenagerieOrbit"
        ? "leaf"
        : "sun-o";

  return (
    <>
      <StatusBar style="auto" />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Card
            style={[
              styles.heroCard,
              isAltTheme && styles.heroCardAlt,
              {
                backgroundColor: `${colors.primary}14`,
                borderColor: isAltTheme ? `${colors.accent}88` : colors.border,
              },
            ]}
          >
            {isAltTheme ? (
              <>
                <View
                  style={[
                    styles.heroTextureBlob,
                    { backgroundColor: `${colors.accent}35` },
                  ]}
                />
                <View
                  style={[
                    styles.heroTextureRing,
                    { borderColor: `${colors.primary}5f` },
                  ]}
                />
              </>
            ) : null}
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <FontAwesome
                  name="stethoscope"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.heroBadgeText,
                    isAltTheme && styles.heroBadgeTextAlt,
                    { color: colors.primary },
                  ]}
                >
                  {copy.dashboardLabel}
                </Text>
              </View>
              <View style={styles.heroTopActions}>
                <TouchableOpacity
                  style={[
                    styles.themeToggle,
                    {
                      backgroundColor: isAltTheme
                        ? `${colors.accent}2e`
                        : `${colors.primary}1a`,
                      borderColor: isAltTheme
                        ? `${colors.accent}a8`
                        : `${colors.primary}65`,
                    },
                  ]}
                  onPress={toggleThemeVariant}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch theme from ${themeName} to ${nextThemeLabel}`}
                >
                  <FontAwesome
                    name={nextThemeIcon}
                    size={12}
                    color={isAltTheme ? colors.accent : colors.primary}
                  />
                  <Text
                    style={[
                      styles.themeToggleText,
                      { color: isAltTheme ? colors.accent : colors.primary },
                    ]}
                  >
                    {nextThemeLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.heroTitleRow}>
              <View style={styles.heroWelcomeRow}>
                {heroAvatarUri ? (
                  <Image
                    source={{ uri: heroAvatarUri }}
                    style={styles.heroAvatar}
                  />
                ) : (
                  <FontAwesome
                    name="user-md"
                    size={14}
                    color={colors.primary}
                  />
                )}
                <Text
                  style={[
                    styles.heroWelcomeText,
                    isNeonTheme && styles.heroWelcomeTextAlt,
                    { color: colors.text },
                  ]}
                  numberOfLines={2}
                >
                  Welcome Dr. {doctorDisplayName}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.logoutIconButton,
                  {
                    borderColor: `${colors.danger}45`,
                    backgroundColor: `${colors.danger}12`,
                  },
                ]}
                onPress={async () => {
                  const auth = getFirebaseAuth();
                  if (auth.currentUser) {
                    await auth.signOut();
                  }
                  await clearAuth();
                }}
                activeOpacity={0.8}
              >
                <FontAwesome name="sign-out" size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.heroSubtitle,
                isNeonTheme && styles.heroSubtitleAlt,
                { color: colors.muted },
              ]}
            >
              {copy.dashboardSubtitle}
            </Text>
            <View style={styles.profileActionsRow}>
              <View style={styles.locationRow}>
                {doctor.cityName ? (
                  <>
                    <FontAwesome
                      name="map-marker"
                      size={13}
                      color={colors.muted}
                    />
                    <Text
                      style={[
                        styles.locationText,
                        (isNeonTheme || isEcoTheme) && styles.locationTextAlt,
                        { color: colors.muted },
                      ]}
                      numberOfLines={1}
                    >
                      {doctor.cityName}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={[
                      styles.locationPlaceholder,
                      { color: colors.muted },
                    ]}
                  >
                    City optional
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.profileEditButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}12`,
                  },
                ]}
                onPress={() => setProfileModalVisible(true)}
                activeOpacity={0.8}
              >
                <FontAwesome name="pencil" size={12} color={colors.primary} />
                <Text
                  style={[styles.profileEditText, { color: colors.primary }]}
                >
                  Edit profile
                </Text>
              </TouchableOpacity>
            </View>
            {needsProfileUpdate ? (
              <Text style={[styles.profileHint, { color: colors.muted }]}>
                Please add your full name
              </Text>
            ) : null}
          </Card>

          <View style={styles.quickActionsSection}>
            <Button
              title={copy.primaryActionTitle}
              onPress={handleNewCase}
              variant="primary"
              leftIcon={
                <FontAwesome name="plus" size={12} color={colors.onPrimary} />
              }
            />
            <Button
              title={
                finding ? copy.nearbyActionLoadingTitle : copy.nearbyActionTitle
              }
              onPress={findNearby}
              variant="secondary"
              style={styles.quickActionButton}
              disabled={finding}
              leftIcon={
                <FontAwesome
                  name="location-arrow"
                  size={12}
                  color={colors.primary}
                />
              }
            />
          </View>

          <View style={styles.recentCasesSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTextWrap}>
                <Text
                  style={[
                    styles.sectionTitle,
                    (isNeonTheme || isEcoTheme) && styles.sectionTitleAlt,
                    { color: colors.text },
                  ]}
                >
                  {copy.openCasesTitle}
                </Text>
                <Text
                  style={[
                    styles.sectionCaption,
                    (isNeonTheme || isEcoTheme) && styles.sectionCaptionAlt,
                    styles.sectionCaptionNoUpper,
                    { color: colors.muted },
                  ]}
                >
                  {copy.openCasesCaption}
                </Text>
              </View>
              <View style={styles.limitCounter}>
                <View style={styles.limitHintWrap}>
                  <FontAwesome
                    name="info-circle"
                    size={11}
                    color={colors.muted}
                  />
                  <Text style={[styles.limitHintText, { color: colors.muted }]}>
                    Show up to
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setActiveCasesLimit((n) =>
                      Math.max(ACTIVE_CASES_LIMIT_MIN, n - 1),
                    )
                  }
                  style={[
                    styles.limitButton,
                    {
                      borderColor: `${colors.primary}44`,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Decrease list limit"
                >
                  <FontAwesome name="minus" size={12} color={colors.primary} />
                </TouchableOpacity>
                <Text
                  style={[styles.limitValue, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {activeCasesLimit}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setActiveCasesLimit((n) =>
                      Math.min(ACTIVE_CASES_LIMIT_MAX, n + 1),
                    )
                  }
                  style={[
                    styles.limitButton,
                    {
                      borderColor: `${colors.primary}44`,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Increase list limit"
                >
                  <FontAwesome name="plus" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {activeCases.length > 0 ? (
              <View style={styles.casesList}>
                {activeCases.map((item) => (
                  <View key={item.caseId} style={styles.caseCardSpacer}>
                    {renderCaseItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  {copy.noCasesText}
                </Text>
              </Card>
            )}
          </View>

          {nearbyCases !== null && (
            <View style={styles.nearbySection}>
              <View style={styles.nearbyHeader}>
                <FontAwesome
                  name="crosshairs"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    (isNeonTheme || isEcoTheme) && styles.sectionTitleAlt,
                    { color: colors.text },
                  ]}
                >
                  {copy.nearbyTitle}
                </Text>
              </View>
              {locationError && (
                <Text
                  style={[styles.nearbyError, { color: colors.danger }]}
                  numberOfLines={2}
                >
                  {locationError}
                </Text>
              )}
              <Text
                style={[
                  styles.nearbyHint,
                  (isNeonTheme || isEcoTheme) && styles.nearbyHintAlt,
                  { color: colors.muted },
                ]}
              >
                {nearbyHintText}
              </Text>
              {nearbyCases.length > 0 ? (
                <View style={styles.casesList}>
                  {nearbyCases.map((item) => (
                    <View key={item.caseId} style={styles.caseCardSpacer}>
                      {renderCaseItem({ item })}
                    </View>
                  ))}
                </View>
              ) : (
                <Card style={styles.emptyCard}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {copy.noNearbyText}
                  </Text>
                </Card>
              )}
            </View>
          )}
        </ScrollView>
        <Modal
          visible={profileModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setProfileModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalSheet, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Complete your profile
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                Full name and phone are required. City is optional.
              </Text>
              <TouchableOpacity
                style={[
                  styles.avatarPickerRow,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
                onPress={handlePickProfileImage}
                activeOpacity={0.8}
                disabled={profileAvatarUploading}
              >
                {profileAvatarLocalUri || profileAvatarUrl ? (
                  <Image
                    source={{
                      uri: profileAvatarLocalUri || profileAvatarUrl,
                    }}
                    style={styles.avatarPreview}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: `${colors.primary}12` },
                    ]}
                  >
                    <FontAwesome
                      name="user"
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                )}
                <View style={styles.avatarPickerTextWrap}>
                  <Text style={[styles.avatarPickerTitle, { color: colors.text }]}>
                    Profile photo
                  </Text>
                  <Text
                    style={[styles.avatarPickerSubtitle, { color: colors.muted }]}
                  >
                    {profileAvatarUploading
                      ? "Uploading..."
                      : "Tap to choose an image"}
                  </Text>
                </View>
              </TouchableOpacity>
              <AppInput
                label="Full name"
                value={profileName}
                onChangeText={(value) => {
                  setProfileName(value);
                  if (profileError) setProfileError(null);
                }}
                autoCapitalize="words"
                placeholder="<Your Name>"
                error={profileError ?? undefined}
              />
              <AppInput
                label="Doctor type"
                value={profileDoctorType}
                onChangeText={setProfileDoctorType}
                autoCapitalize="characters"
                placeholder="DVM"
              />
              <AppInput
                label="Phone number"
                value={formatPhone(profilePhone)}
                onChangeText={(value) => {
                  const sanitized = sanitizePhone(value).slice(0, 11);
                  setProfilePhone(sanitized);
                  if (profilePhoneError) setProfilePhoneError(null);
                }}
                keyboardType="phone-pad"
                placeholder="03xx-xxx-xxxx"
                maxLength={13}
                error={profilePhoneError ?? undefined}
              />
              <AppInput
                label="City"
                value={profileCity}
                onChangeText={setProfileCity}
                autoCapitalize="words"
                placeholder="City name (optional)"
              />
              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setProfileModalVisible(false)}
                  style={styles.modalCancelBtn}
                  disabled={
                    updateDoctorMutation.isPending || profileAvatarUploading
                  }
                />
                <Button
                  title={updateDoctorMutation.isPending ? "Saving..." : "Save"}
                  variant="primary"
                  onPress={handleSaveProfile}
                  style={styles.modalNextBtn}
                  disabled={
                    updateDoctorMutation.isPending || profileAvatarUploading
                  }
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 0,
    overflow: "hidden",
    position: "relative",
  },
  heroCardAlt: {
    borderWidth: 1,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroTextureBlob: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -48,
    right: -50,
  },
  heroTextureRing: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    bottom: -96,
    left: -42,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroBadgeTextAlt: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
    flex: 1,
  },
  heroTitleAlt: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroWelcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  heroAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  heroWelcomeText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    flex: 1,
  },
  heroWelcomeTextAlt: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  heroSubtitleAlt: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  heroFooterActions: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  logoutIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "500",
  },
  locationTextAlt: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  locationPlaceholder: {
    fontSize: 13,
    fontWeight: "500",
  },
  profileActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profileEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  profileEditText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickActionsSection: {
    marginTop: 14,
    gap: 12,
  },
  quickActionButton: {
    marginTop: 0,
  },
  recentCasesSection: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 10,
  },
  sectionHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 0,
  },
  sectionTitleAlt: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "800",
    fontSize: 17,
  },
  sectionCaption: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionCaptionAlt: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionCaptionNoUpper: {
    textTransform: "none",
    letterSpacing: 0,
  },
  limitCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    marginLeft: "auto",
    marginTop: 2,
  },
  limitHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 2,
  },
  limitHintText: {
    fontSize: 11,
    fontWeight: "500",
  },
  limitButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  limitValue: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 22,
    textAlign: "center",
  },
  nearbySection: {
    marginTop: 26,
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  nearbyHint: {
    fontSize: 14,
    marginBottom: 10,
  },
  nearbyHintAlt: {
    fontSize: 13,
    letterSpacing: 0.25,
  },
  nearbyError: {
    fontSize: 14,
    marginBottom: 8,
  },
  casesList: {
    gap: 0,
  },
  caseCardSpacer: {
    marginBottom: 12,
  },
  emptyCard: {
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
  },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 72,
    borderWidth: 1,
  },
  caseCardPhoto: {
    width: 72,
    height: 72,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
  },
  caseCardPhotoImage: {
    width: 72,
    height: 72,
  },
  caseCardPhotoPlaceholder: {
    fontSize: 20,
    fontWeight: "700",
  },
  caseCardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    minWidth: 0,
  },
  caseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  caseCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },
  caseCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    maxWidth: 84,
  },
  distanceBadgeIconWrap: {
    marginRight: 4,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  caseCardStatusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  caseCardComplaint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 1,
    opacity: 0.95,
  },
  caseCardMeta: {
    fontSize: 12,
    opacity: 0.78,
  },
  caseCardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    paddingRight: 10,
  },
  caseCardDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  avatarPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  avatarPreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPickerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  avatarPickerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  avatarPickerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalNextBtn: {
    flex: 1,
  },
});

interface CaseRowProps {
  caseItem: Case;
  formatDate: (dateString: string) => string;
  onPress: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

function CaseRow({
  caseItem,
  formatDate,
  onPress,
  onDelete,
  isDeleting,
}: CaseRowProps) {
  const { colors, isAltTheme } = useTheme();
  const { data: animalImages = [] } = useAnimalImages(caseItem.animalId);
  const { data: animal } = useAnimal(caseItem.animalId);
  const faceUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;
  const ownerName = animal?.farmer?.fullName ?? "-";
  const status = caseItem.status ?? "IN_PROGRESS";
  const isCompleted = status === "COMPLETED";
  const distanceKm = getCaseDistanceKm(caseItem);
  const distanceLabel = formatCaseDistanceLabel(distanceKm);

  return (
    <View
      style={[
        styles.caseCard,
        {
          backgroundColor: colors.surface,
          borderColor: `${colors.border}`,
          shadowColor: isAltTheme ? colors.accent : "#0f172a",
          shadowOpacity: isAltTheme ? 0.18 : 0.07,
          shadowRadius: isAltTheme ? 11 : 7,
          shadowOffset: { width: 0, height: isAltTheme ? 8 : 3 },
          elevation: isAltTheme ? 5 : 2,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.caseCardPhoto}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {faceUrl ? (
          <Image
            source={{ uri: faceUrl }}
            style={styles.caseCardPhotoImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[styles.caseCardPhotoPlaceholder, { color: colors.muted }]}
          >
            ?
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.caseCardBody}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View>
          <View style={styles.caseCardHeader}>
            <Text
              style={[styles.caseCardTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              Case #{caseItem.caseId}
            </Text>
            <View style={styles.caseCardHeaderRight}>
              {distanceLabel ? (
                <View
                  style={[
                    styles.distanceBadge,
                    { backgroundColor: `${colors.primary}18` },
                  ]}
                >
                  <View style={styles.distanceBadgeIconWrap}>
                    <FontAwesome
                      name="map-marker"
                      size={10}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.distanceBadgeText,
                      { color: colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {distanceLabel}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.caseCardStatusIcon,
                  {
                    backgroundColor: isCompleted
                      ? (colors.success ?? "#22c55e") + "22"
                      : (colors.warning ?? "#eab308") + "22",
                    borderWidth: isAltTheme ? 1 : 0,
                    borderColor: isCompleted
                      ? `${colors.success}67`
                      : `${colors.warning}67`,
                  },
                ]}
              >
                <FontAwesome
                  name={isCompleted ? "check-circle" : "clock-o"}
                  size={14}
                  color={isCompleted ? colors.success : colors.warning}
                />
              </View>
            </View>
          </View>
          {caseItem.chiefComplaint ? (
            <Text
              style={[styles.caseCardComplaint, { color: colors.text }]}
              numberOfLines={1}
            >
              {caseItem.chiefComplaint}
            </Text>
          ) : null}
          <Text
            style={[styles.caseCardMeta, { color: colors.muted }]}
            numberOfLines={1}
          >
            {ownerName} · {formatDate(caseItem.caseDatetime)}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.caseCardActions}>
        <TouchableOpacity
          onPress={onDelete}
          disabled={isDeleting}
          style={[
            styles.caseCardDeleteBtn,
            { borderColor: `${colors.danger}a3` },
            isDeleting && { opacity: 0.5 },
          ]}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <FontAwesome name="trash-o" size={13} color={colors.danger} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
