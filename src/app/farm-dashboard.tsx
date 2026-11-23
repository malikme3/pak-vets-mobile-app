import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { FarmSectionEditor } from "../features/farm-vitals/section-editor";
import { SpeciesIcon } from "../components/SpeciesIcon";
import {
  childFormTypes,
  getFarmReview,
  listFormTypes,
  readableFarmImage,
  saveFarmProfileImages,
  uploadFarmImage,
  type FarmFormType,
  type FarmReview,
  type FarmReviewSection,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  surface: "#FFFFFF",
  danger: "#B42318",
  mint: "#E7F5EE",
};

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function visibleSections(review: FarmReview): FarmReviewSection[] {
  return review.sections.filter(
    (section) => section.rows.length > 0 || (section.utils?.length ?? 0) > 0,
  );
}

function ownerLine(review: FarmReview): string {
  for (const section of review.sections) {
    for (const util of section.utils ?? []) {
      const row = util.rows.find(
        (item) => /name/i.test(item.label) && item.value !== "Not provided",
      );
      if (row && /owner|contact/i.test(util.label)) return row.value;
    }
  }
  return "";
}

function ownerPhone(review: FarmReview): string {
  for (const section of review.sections) {
    for (const util of section.utils ?? []) {
      const row = util.rows.find(
        (item) =>
          /phone|mobile/i.test(item.label) && item.value !== "Not provided",
      );
      if (row && /owner|contact/i.test(util.label)) return row.value;
    }
  }
  return "";
}

function displayPhone(value: string): string {
  return value.replace(/^\+92-/i, "");
}

function locationCity(review: FarmReview): string {
  for (const section of review.sections) {
    for (const util of section.utils ?? []) {
      const row = util.rows.find(
        (item) => /city/i.test(item.label) && item.value !== "Not provided",
      );
      if (row && /location/i.test(util.label)) return row.value;
    }
  }
  return "";
}

function farmCategory(review: FarmReview): string {
  for (const section of review.sections) {
    const row = section.rows.find(
      (item) =>
        /category|classification/i.test(item.label) &&
        item.value !== "Not provided",
    );
    if (row) return row.value;
  }
  return "";
}

function CollapseSection({
  title,
  count,
  expanded,
  onToggle,
  onEdit,
  editDisabled,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  editDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeading}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={onToggle}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.count}>{count}</Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.green}
          />
        </Pressable>
        {onEdit ? (
          <EditSectionButton
            title={title}
            disabled={editDisabled}
            onPress={onEdit}
          />
        ) : null}
      </View>
      {expanded ? children : null}
    </View>
  );
}

function EditSectionButton({
  title,
  disabled,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.editSection, disabled && { opacity: 0.45 }]}
    >
      <Feather name="edit-2" size={14} color={colors.green} />
      <Text style={styles.editText}>Edit</Text>
    </Pressable>
  );
}

export default function FarmDashboardScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = Array.isArray(params.farmId)
    ? params.farmId[0]
    : params.farmId;
  const [review, setReview] = useState<FarmReview | null>(null);
  const [formTypes, setFormTypes] = useState<FarmFormType[]>([]);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [openUtils, setOpenUtils] = useState<Record<string, boolean>>({});
  const [profilePhotoSaving, setProfilePhotoSaving] = useState<
    "farm" | "owner" | null
  >(null);
  const [profilePhotoUrls, setProfilePhotoUrls] = useState({
    farm: "",
    owner: "",
  });
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(
    null,
  );

  const openFarm = useCallback(async (farmId: string, quiet = false) => {
    if (!quiet) setOpening(true);
    setError(null);
    try {
      const [next, types] = await Promise.all([
        getFarmReview(farmId),
        listFormTypes(),
      ]);
      setReview(next);
      const [farmPhotoUrl, ownerPhotoUrl] = await Promise.all([
        next.farmPhotoUrl
          ? readableFarmImage(next.farmPhotoUrl).catch(() => "")
          : Promise.resolve(""),
        next.ownerPhotoUrl
          ? readableFarmImage(next.ownerPhotoUrl).catch(() => "")
          : Promise.resolve(""),
      ]);
      setProfilePhotoUrls({ farm: farmPhotoUrl, owner: ownerPhotoUrl });
      setFormTypes(types);
      if (!quiet) {
        setOpenSections({});
        setOpenUtils({});
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This farm could not be opened.",
      );
    } finally {
      if (!quiet) setOpening(false);
    }
  }, []);

  async function changeProfilePhoto(kind: "farm" | "owner") {
    if (!review || profilePhotoSaving) return;
    setProfilePhotoError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: kind === "owner" ? [1, 1] : [16, 9],
        quality: 0.82,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      setProfilePhotoSaving(kind);
      const extension =
        /\.([a-z0-9]+)$/i.exec(asset.fileName ?? "")?.[1] ??
        (asset.mimeType?.split("/")[1] === "jpeg"
          ? "jpg"
          : (asset.mimeType?.split("/")[1] ?? "jpg"));
      const photoUrl = await uploadFarmImage(
        asset.uri,
        `${kind}-profile-${Date.now()}.${extension}`,
        farmId,
        "farm",
      );
      const readableUrl = await readableFarmImage(photoUrl);
      const changes =
        kind === "farm"
          ? { farmPhotoUrl: photoUrl }
          : { ownerPhotoUrl: photoUrl };
      await saveFarmProfileImages(farmId, changes);
      setReview((current) => (current ? { ...current, ...changes } : current));
      setProfilePhotoUrls((current) => ({ ...current, [kind]: readableUrl }));
    } catch (cause) {
      setProfilePhotoError(
        cause instanceof Error
          ? cause.message
          : "The photo could not be saved.",
      );
    } finally {
      setProfilePhotoSaving(null);
    }
  }

  function toggleSection(key: string, fallback: boolean) {
    setOpenSections((current) => ({
      ...current,
      [key]: !(current[key] ?? fallback),
    }));
  }

  useFocusEffect(
    useCallback(() => {
      if (farmId) void openFarm(farmId);
    }, [openFarm, farmId]),
  );

  if (!farmId) return <Redirect href="/farm-board" />;

  const sections = review ? visibleSections(review) : [];
  const owner = review ? ownerLine(review) : "";
  const phone = review ? ownerPhone(review) : "";
  const city = review ? locationCity(review) : "";
  const category = review ? farmCategory(review) : "";
  const registered = review ? when(review.submittedAt) : "";
  const coverHeight = Math.min(156, Math.max(118, screenWidth * 0.34));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <FlowPageHeading
          onBack={() => router.dismissTo("/farm-board")}
          title="Farm details"
        />

        {opening ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Opening farm…</Text>
          </View>
        ) : null}
        {error ? (
          <View>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openFarm(farmId)}
            >
              <Text style={styles.backText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {review && !opening ? (
          <>
            <View style={styles.profileCard}>
              <View style={[styles.cover, { height: coverHeight }]}>
                {profilePhotoUrls.farm ? (
                  <Image
                    source={{ uri: profilePhotoUrls.farm }}
                    resizeMode="cover"
                    style={styles.coverImage}
                  />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Feather name="image" size={28} color={colors.green} />
                  </View>
                )}
                <View style={styles.coverOverlay} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    review.farmPhotoUrl
                      ? "Change farm cover photo"
                      : "Add farm cover photo"
                  }
                  disabled={profilePhotoSaving !== null}
                  onPress={() => void changeProfilePhoto("farm")}
                  style={styles.coverEdit}
                >
                  {profilePhotoSaving === "farm" ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Feather name="camera" size={17} color={colors.surface} />
                  )}
                </Pressable>
              </View>
              <View style={styles.profileColumns}>
                <View style={styles.ownerColumn}>
                  <View style={styles.ownerPhotoWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        review.ownerPhotoUrl
                          ? "Change owner photo"
                          : "Add owner photo"
                      }
                      disabled={profilePhotoSaving !== null}
                      onPress={() => void changeProfilePhoto("owner")}
                      style={styles.ownerPhoto}
                    >
                      {profilePhotoUrls.owner ? (
                        <Image
                          source={{ uri: profilePhotoUrls.owner }}
                          resizeMode="cover"
                          style={styles.ownerImage}
                        />
                      ) : (
                        <Feather name="user" size={28} color={colors.green} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Upload owner photo"
                      disabled={profilePhotoSaving !== null}
                      onPress={() => void changeProfilePhoto("owner")}
                      style={styles.ownerPhotoEdit}
                    >
                      {profilePhotoSaving === "owner" ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.surface}
                        />
                      ) : (
                        <Feather
                          name="camera"
                          size={12}
                          color={colors.surface}
                        />
                      )}
                    </Pressable>
                  </View>
                  <Text numberOfLines={2} style={styles.ownerName}>
                    {owner || "Owner not provided"}
                  </Text>
                  <View style={styles.detailLine}>
                    <Feather name="phone" size={13} color={colors.green} />
                    <Text
                      numberOfLines={1}
                      style={phone ? styles.detailText : styles.detailMissing}
                    >
                      {phone ? displayPhone(phone) : "Phone not provided"}
                    </Text>
                  </View>
                  {registered ? (
                    <Text style={styles.registrationDate}>
                      Registered {registered}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.farmColumn}>
                  <Text style={styles.profileLabel}>FARM</Text>
                  <Text
                    accessibilityRole="header"
                    numberOfLines={2}
                    style={styles.farmName}
                  >
                    {review.name}
                  </Text>
                  <View style={styles.detailLine}>
                    <Feather name="map-pin" size={14} color={colors.green} />
                    <Text
                      numberOfLines={1}
                      style={city ? styles.detailText : styles.detailMissing}
                    >
                      {city || "Location not set"}
                    </Text>
                  </View>
                  <View style={styles.profileBadges}>
                    <View style={styles.animalCount}>
                      <Feather name="activity" size={14} color={colors.green} />
                      <Text style={styles.animalCountText}>
                        {review.animals.length}{" "}
                        {review.animals.length === 1 ? "animal" : "animals"}
                      </Text>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text
                        numberOfLines={1}
                        style={
                          category
                            ? styles.categoryText
                            : styles.categoryMissing
                        }
                      >
                        {category || "Category not set"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
            {profilePhotoError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {profilePhotoError}
              </Text>
            ) : null}
            {sections.map((section, index) => {
              const key = `farm-${index}`;
              const directFields =
                section.edit?.fields.filter((field) => !field.source) ?? [];
              const expanded = editing === key || (openSections[key] ?? false);
              return (
                <CollapseSection
                  key={key}
                  title={section.title}
                  count={section.rows.length + (section.utils?.length ?? 0)}
                  expanded={expanded}
                  onToggle={() => {
                    if (editing !== key) toggleSection(key, false);
                  }}
                  onEdit={
                    directFields.length ? () => setEditing(key) : undefined
                  }
                  editDisabled={editing !== null}
                >
                  {editing === key && section.edit ? (
                    <FarmSectionEditor
                      farmId={farmId}
                      draft={section.edit}
                      fields={directFields}
                      onCancel={() => setEditing(null)}
                      onSaved={async () => {
                        setEditing(null);
                        await openFarm(farmId, true);
                      }}
                    />
                  ) : (
                    section.rows.map((row, rowIndex) => (
                      <View key={`${key}-${rowIndex}`} style={styles.fact}>
                        <Text style={styles.factLabel}>{row.label}</Text>
                        <Text style={styles.factValue}>{row.value}</Text>
                      </View>
                    ))
                  )}
                  {(section.utils ?? []).map((util) => {
                    const utilKey = `${key}-${util.key}`;
                    const open =
                      editing === utilKey || (openUtils[utilKey] ?? false);
                    return (
                      <View key={utilKey}>
                        <View style={styles.utilHeading}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                            aria-expanded={open}
                            onPress={() => {
                              if (editing !== utilKey)
                                setOpenUtils((current) => ({
                                  ...current,
                                  [utilKey]: !open,
                                }));
                            }}
                            style={styles.utilToggle}
                          >
                            <Feather
                              name={util.filled ? "check" : "plus"}
                              size={16}
                              color={colors.green}
                            />
                            <Text style={styles.utilText}>{util.label}</Text>
                            <Feather
                              name={open ? "chevron-up" : "chevron-down"}
                              size={16}
                              color={colors.muted}
                            />
                          </Pressable>
                          {section.edit ? (
                            <EditSectionButton
                              title={util.label}
                              disabled={editing !== null}
                              onPress={() => setEditing(utilKey)}
                            />
                          ) : null}
                        </View>
                        {editing === utilKey && section.edit ? (
                          <FarmSectionEditor
                            farmId={farmId}
                            draft={section.edit}
                            fields={[util.field]}
                            onCancel={() => setEditing(null)}
                            onSaved={async () => {
                              setEditing(null);
                              await openFarm(farmId, true);
                            }}
                          />
                        ) : open ? (
                          util.rows.map((row, rowIndex) => (
                            <View
                              key={`${utilKey}-${rowIndex}`}
                              style={styles.fact}
                            >
                              <Text style={styles.factLabel}>{row.label}</Text>
                              <Text style={styles.factValue}>{row.value}</Text>
                            </View>
                          ))
                        ) : null}
                        {open && !util.rows.length && editing !== utilKey ? (
                          <Text style={styles.utilEmpty}>Nothing saved.</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </CollapseSection>
              );
            })}
            {childFormTypes(formTypes, "farm", [
              ...(review.animals.length ? ["animal"] : []),
              ...review.records.map((record) => record.kind),
            ]).map((type) => {
              const entries =
                type.key === "animal"
                  ? review.animals
                  : review.records.filter((record) => record.kind === type.key);
              const title = type.key === "animal" ? "Animals" : type.label;
              return (
                <View key={type.key} style={styles.childSection}>
                  <View style={styles.animalHead}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {type.key === "animal" ? (
                      <View
                        accessible
                        accessibilityLabel={`${review.animals.length} total ${review.animals.length === 1 ? "animal" : "animals"}`}
                        style={styles.animalTotalBadge}
                      >
                        <Text style={styles.animalTotalText}>
                          {review.animals.length}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: "/add-farm-animal",
                          params: { farmId: review.farmId, kind: type.key },
                        })
                      }
                      style={styles.add}
                    >
                      <Feather name="plus" size={14} color="#FFFFFF" />
                      <Text style={styles.addText}>Add</Text>
                    </Pressable>
                  </View>
                  {type.key === "animal" ? (
                    review.animals.length ? (
                      review.animals.map((animal) => {
                        const date = when(animal.submittedAt);
                        return (
                          <Pressable
                            key={animal.entryId}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${animal.name}`}
                            onPress={() =>
                              router.push({
                                pathname: "/farm-animal",
                                params: {
                                  farmId: review.farmId,
                                  entryId: animal.entryId,
                                },
                              })
                            }
                            style={styles.row}
                          >
                            <View style={styles.avatar}>
                              {animal.species ? (
                                <SpeciesIcon
                                  species={animal.species}
                                  size={36}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text style={styles.initial}>
                                  {animal.name.slice(0, 1).toUpperCase()}
                                </Text>
                              )}
                            </View>
                            <View style={styles.copy}>
                              <Text numberOfLines={1} style={styles.rowTitle}>
                                {animal.name}
                              </Text>
                              <Text numberOfLines={1} style={styles.help}>
                                {[animal.species, date]
                                  .filter(Boolean)
                                  .join(" · ") || "Animal"}
                              </Text>
                            </View>
                            <Feather
                              name="chevron-right"
                              size={16}
                              color={colors.green}
                            />
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.help}>
                        No animals have been added yet.
                      </Text>
                    )
                  ) : entries.length ? (
                    entries.map((record) => (
                      <Pressable
                        key={record.entryId}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${record.name}`}
                        onPress={() =>
                          router.push({
                            pathname: "/farm-history",
                            params: {
                              farmId: review.farmId,
                              entryId: record.entryId,
                            },
                          })
                        }
                        style={styles.row}
                      >
                        <View style={styles.avatar}>
                          <Text style={styles.initial}>
                            {record.name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.copy}>
                          <Text numberOfLines={1} style={styles.rowTitle}>
                            {record.name}
                          </Text>
                          {when(record.submittedAt) ? (
                            <Text style={styles.help}>
                              {when(record.submittedAt)}
                            </Text>
                          ) : null}
                        </View>
                        <Feather
                          name="chevron-right"
                          size={16}
                          color={colors.green}
                        />
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.help}>None yet.</Text>
                  )}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  profileCard: {
    ...farmCard,
    overflow: "hidden",
    padding: 0,
    gap: 0,
    backgroundColor: colors.surface,
  },
  cover: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.mint,
  },
  coverImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  coverPlaceholder: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFEEE7",
  },
  coverOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(23,61,50,0.08)",
  },
  coverEdit: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,61,50,0.82)",
  },
  profileColumns: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  profileBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  ownerColumn: {
    flex: 0.4,
    minWidth: 0,
    padding: 9,
    borderWidth: 1,
    borderColor: "#DCE9E1",
    borderRadius: 16,
    backgroundColor: "#FBFDFB",
    shadowColor: "#173D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  ownerPhotoWrap: {
    position: "relative",
    alignSelf: "flex-start",
    marginTop: -42,
    marginLeft: -2,
    marginBottom: 8,
  },
  ownerPhoto: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
    borderWidth: 4,
    borderColor: colors.surface,
    overflow: "hidden",
    elevation: 3,
  },
  ownerImage: { width: "100%", height: "100%" },
  ownerPhotoEdit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  ownerName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 5,
  },
  farmColumn: {
    flex: 0.6,
    minWidth: 0,
    alignSelf: "stretch",
    padding: 9,
    paddingTop: 14,
    gap: 7,
    borderWidth: 1,
    borderColor: "#DCE9E1",
    borderRadius: 16,
    backgroundColor: "#FBFDFB",
    shadowColor: "#173D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  profileLabel: {
    color: colors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  farmName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  detailText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12 },
  detailMissing: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontSize: 11,
    fontStyle: "italic",
  },
  animalCount: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.mint,
  },
  animalCountText: { color: colors.green, fontSize: 12, fontWeight: "700" },
  categoryBadge: {
    alignSelf: "flex-start",
    maxWidth: "68%",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.mint,
  },
  categoryText: { color: colors.green, fontSize: 11, fontWeight: "700" },
  categoryMissing: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    fontStyle: "italic",
  },
  registrationDate: { color: colors.muted, fontSize: 10 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  card: {
    ...farmCard,
  },
  sectionHeader: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  factLabel: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "600" },
  factValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
    gap: 6,
  },
  editSection: {
    ...farmButton,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  editText: { color: colors.green, fontSize: 13, fontWeight: "700" },
  utilHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 8,
  },
  utilToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  utilText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  utilEmpty: {
    color: colors.muted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  animalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  childSection: { gap: 12 },
  animalTotalBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  animalTotalText: { color: colors.green, fontSize: 12, fontWeight: "800" },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.green,
    ...farmButton,
  },
  addText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...farmCard,
  },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  initial: { color: colors.green, fontSize: 15, fontWeight: "800" },
});
