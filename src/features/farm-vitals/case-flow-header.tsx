import { StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { FlowPageHeading } from "./flow-page-heading";
import { farmCard } from "./presentation";

type Props = {
  title?: string;
  onBack: () => void;
  animalName: string;
  farmName: string;
  date: string;
  steps: string[];
  step: number;
  description: string;
};

export function CaseFlowHeader({
  onBack,
  title = "Add Case",
  animalName,
  farmName,
  date,
  steps,
  step,
  description,
}: Props) {
  const current = Math.min(step, Math.max(steps.length - 1, 0));
  return (
    <View style={styles.header}>
      <FlowPageHeading onBack={onBack} title={title} />
      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.icon}>
            <Feather
              name={animalName ? "heart" : "search"}
              size={20}
              color="#1E7F5C"
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.name}>{animalName || "Choose an animal"}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {farmName}
            </Text>
          </View>
          <View style={styles.draft}>
            <Text style={styles.draftText}>Draft</Text>
          </View>
        </View>
        {date ? (
          <View style={styles.date}>
            <Feather name="calendar" size={12} color="#63766C" />
            <Text style={styles.meta}>{date}</Text>
          </View>
        ) : null}
        {steps.length > 1 ? (
          <>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Case progress"
              accessibilityValue={{
                min: 1,
                max: steps.length,
                now: current + 1,
                text: `Step ${current + 1} of ${steps.length}: ${steps[current]}`,
              }}
              style={styles.progress}
            >
              {steps.map((label, index) => (
                <View
                  key={`${label}-${index}`}
                  style={[
                    styles.segment,
                    index <= current && styles.segmentDone,
                  ]}
                />
              ))}
            </View>
            <View style={styles.stageRow}>
              <View style={styles.stageIcon}>
                <Feather
                  name={
                    current === steps.length - 1 ? "check-circle" : "clipboard"
                  }
                  size={16}
                  color="#1E7F5C"
                />
              </View>
              <Text accessibilityRole="header" style={styles.stage}>
                {steps[current]}
              </Text>
            </View>
            <Text style={styles.description}>{description}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  card: { ...farmCard, padding: 14, gap: 10 },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#E7F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: "#173D32", fontSize: 17, fontWeight: "800" },
  meta: { color: "#63766C", fontSize: 11, lineHeight: 16 },
  draft: {
    backgroundColor: "#FFF1D7",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  draftText: { color: "#835914", fontSize: 10, fontWeight: "700" },
  date: { flexDirection: "row", alignItems: "center", gap: 6 },
  progress: { flexDirection: "row", gap: 5, marginTop: 2 },
  segment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: "#E4EBE3" },
  segmentDone: { backgroundColor: "#1E7F5C" },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  stageIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#E7F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  stage: { flex: 1, color: "#173D32", fontSize: 18, fontWeight: "800" },
  description: { color: "#63766C", fontSize: 12, lineHeight: 18 },
});
