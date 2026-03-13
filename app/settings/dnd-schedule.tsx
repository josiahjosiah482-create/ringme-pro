import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

const C = {
  bg: "#0D0520",
  card: "#1A0D35",
  card2: "#22103F",
  pink: "#FF6EC7",
  lav: "#C084FC",
  txt: "#FFFFFF",
  txt2: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

const PRESETS = [
  { label: "Night Owl", from: "23:00", until: "07:00" },
  { label: "Work Hours", from: "09:00", until: "17:00" },
  { label: "Sleep", from: "22:00", until: "08:00" },
  { label: "Weekend", from: "00:00", until: "10:00" },
];

export default function DndScheduleScreen() {
  const router = useRouter();
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndFrom, setDndFrom] = useState("22:00");
  const [dndUntil, setDndUntil] = useState("08:00");
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = trpc.userSettings.get.useQuery();
  const updateMutation = trpc.userSettings.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  useEffect(() => {
    if (settings) {
      setDndEnabled(settings.dndEnabled);
      setDndFrom(settings.dndFrom);
      setDndUntil(settings.dndUntil);
    }
  }, [settings]);

  const handleSave = () => {
    if (!/^\d{2}:\d{2}$/.test(dndFrom) || !/^\d{2}:\d{2}$/.test(dndUntil)) {
      Alert.alert("Invalid Time", "Please use HH:MM format (e.g. 22:00)");
      return;
    }
    updateMutation.mutate({ dndEnabled, dndFrom, dndUntil });
  };

  const applyPreset = (from: string, until: string) => {
    setDndFrom(from);
    setDndUntil(until);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Do Not Disturb</Text>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#0D0520" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{saved ? "✓ Saved" : "Save"}</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.pink} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* DND Toggle */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>🌙 Do Not Disturb</Text>
                <Text style={styles.toggleSubtitle}>
                  Silence calls and texts during scheduled hours
                </Text>
              </View>
              <Switch
                value={dndEnabled}
                onValueChange={setDndEnabled}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(255,110,199,0.4)" }}
                thumbColor={dndEnabled ? C.pink : "rgba(255,255,255,0.5)"}
              />
            </View>
          </View>

          {/* Schedule */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <Text style={styles.sectionSubtitle}>
              Calls and messages received during this window will be silenced and sent to voicemail.
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.timeLabel}>From</Text>
                <TextInput
                  style={[styles.timeInput, !dndEnabled && styles.disabled]}
                  value={dndFrom}
                  onChangeText={setDndFrom}
                  placeholder="22:00"
                  placeholderTextColor={C.txt2}
                  keyboardType="numbers-and-punctuation"
                  editable={dndEnabled}
                />
              </View>
              <Text style={styles.timeSeparator}>→</Text>
              <View style={styles.timeField}>
                <Text style={styles.timeLabel}>Until</Text>
                <TextInput
                  style={[styles.timeInput, !dndEnabled && styles.disabled]}
                  value={dndUntil}
                  onChangeText={setDndUntil}
                  placeholder="08:00"
                  placeholderTextColor={C.txt2}
                  keyboardType="numbers-and-punctuation"
                  editable={dndEnabled}
                />
              </View>
            </View>
          </View>

          {/* Presets */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Presets</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={({ pressed }) => [
                    styles.presetChip,
                    dndFrom === p.from && dndUntil === p.until && styles.presetChipActive,
                    pressed && { opacity: 0.7 },
                    !dndEnabled && styles.disabled,
                  ]}
                  onPress={() => dndEnabled && applyPreset(p.from, p.until)}
                >
                  <Text style={[
                    styles.presetLabel,
                    dndFrom === p.from && dndUntil === p.until && styles.presetLabelActive,
                  ]}>
                    {p.label}
                  </Text>
                  <Text style={[
                    styles.presetTime,
                    dndFrom === p.from && dndUntil === p.until && styles.presetLabelActive,
                  ]}>
                    {p.from} – {p.until}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              When DND is active, all inbound calls go to voicemail and messages are silenced.
              Emergency contacts (marked as favorites) can still reach you.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: C.pink, fontSize: 22, fontWeight: "600" },
  headerTitle: { flex: 1, color: C.txt, fontSize: 18, fontWeight: "700", marginLeft: 4 },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.pink,
    minWidth: 64,
    alignItems: "center",
  },
  saveBtnText: { color: "#0D0520", fontSize: 14, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: C.txt, fontSize: 16, fontWeight: "700" },
  toggleSubtitle: { color: C.txt2, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: C.txt, fontSize: 15, fontWeight: "700" },
  sectionSubtitle: { color: C.txt2, fontSize: 13, lineHeight: 18 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeField: { flex: 1, gap: 6 },
  timeLabel: { color: C.txt2, fontSize: 12, fontWeight: "600" },
  timeInput: {
    backgroundColor: C.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.txt,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  timeSeparator: { color: C.txt2, fontSize: 20, fontWeight: "300", marginTop: 20 },
  disabled: { opacity: 0.4 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    gap: 4,
  },
  presetChipActive: {
    backgroundColor: "rgba(255,110,199,0.12)",
    borderColor: "rgba(255,110,199,0.4)",
  },
  presetLabel: { color: C.txt, fontSize: 13, fontWeight: "700" },
  presetLabelActive: { color: C.pink },
  presetTime: { color: C.txt2, fontSize: 11 },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "rgba(192,132,252,0.08)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.2)",
    gap: 10,
    alignItems: "flex-start",
  },
  infoIcon: { fontSize: 18, marginTop: 2 },
  infoText: { flex: 1, color: C.lav, fontSize: 13, lineHeight: 18 },
});
