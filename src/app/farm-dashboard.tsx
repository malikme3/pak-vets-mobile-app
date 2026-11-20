import { HeaderBackground } from "../features/farm-vitals/header-background";
import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { FarmSectionEditor } from "../features/farm-vitals/section-editor";
import { SpeciesIcon } from "../components/SpeciesIcon";
import {
  childFormTypes,
  getFarmReview,
  listFormTypes,
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

  const openFarm = useCallback(async (farmId: string, quiet = false) => {
    if (!quiet) setOpening(true);
    setError(null);
    try {
      const [next, types] = await Promise.all([
        getFarmReview(farmId),
        listFormTypes(),
      ]);
      setReview(next);
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
  const registered = review ? when(review.submittedAt) : "";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.dismissTo("/farm-board")}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>Farms dashboard</Text>
        </Pressable>

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
            <HeaderBackground
              imageUrl={review.headerBackgroundImageUrl}
              style={styles.identity}
            >
              <View style={styles.identityTop}>
                <View style={styles.farmMark}>
                  <Feather name="home" size={21} color={colors.green} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.profileLabel}>FARM PROFILE</Text>
                  <Text accessibilityRole="header" style={styles.name}>
                    {review.name}
                  </Text>
                  {owner ? (
                    <Text style={styles.meta}>Owner · {owner}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.identityFooter}>
                {registered ? (
                  <View style={styles.registered}>
                    <Feather name="calendar" size={13} color={colors.muted} />
                    <Text
                      accessibilityLabel={`Registered ${registered}`}
                      style={styles.registrationDate}
                    >
                      {registered}
                    </Text>
                  </View>
                ) : null}
                <View
                  accessible
                  accessibilityLabel={`${review.animals.length} registered ${review.animals.length === 1 ? "animal" : "animals"}`}
                  style={styles.animalBadge}
                >
                  <Feather name="activity" size={13} color={colors.surface} />
                  <Text style={styles.animalBadgeText}>
                    {review.animals.length}{" "}
                    {review.animals.length === 1 ? "animal" : "animals"}
                  </Text>
                </View>
              </View>
            </HeaderBackground>
            {sections.map((section, index) => {
              const key = `farm-${index}`;
              const directFields =
                section.edit?.fields.filter((field) => !field.source) ?? [];
              const expanded =
                editing === key || (openSections[key] ?? index === 0);
              return (
                <CollapseSection
                  key={key}
                  title={section.title}
                  count={section.rows.length + (section.utils?.length ?? 0)}
                  expanded={expanded}
                  onToggle={() => {
                    if (editing !== key) toggleSection(key, index === 0);
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
  identity: { ...farmCard, padding: 14, gap: 12 },
  identityTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmMark: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  profileLabel: {
    color: colors.green,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  identityFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  registered: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  registrationDate: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },
  animalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.green,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  animalBadgeText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
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
