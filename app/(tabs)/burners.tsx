import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const PURPOSES = [
  { emoji: "💼", label: "Work / Job Search" },
  { emoji: "💘", label: "Dating" },
  { emoji: "🛒", label: "Marketplace" },
  { emoji: "🏠", label: "Rental / Housing" },
  { emoji: "🎮", label: "Gaming" },
  { emoji: "🤝", label: "Business" },
  { emoji: "✈️", label: "Travel" },
  { emoji: "🎯", label: "Other" },
];

const BURNER_COLORS = ["#FFE94A", "#C084FC", "#5BC8FF", "#FF7A5C", "#FF6EC7", "#4DFFB4", "#FF9F00", "#F0ABFF"];

function formatCountdown(expiresAt: Date): { text: string; urgency: "ok" | "warn" | "critical" } {
  const now = Date.now();
  const diff = expiresAt.getTime() - now;
  if (diff <= 0) return { text: "Expired", urgency: "critical" };

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 3) return { text: `${days}d ${hours}h`, urgency: "ok" };
  if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, urgency: "warn" };
  if (hours > 0) return { text: `${hours}h ${mins}m`, urgency: "warn" };
  if (mins > 0) return { text: `${mins}m ${secs}s`, urgency: "critical" };
  return { text: `${secs}s`, urgency: "critical" };
}

type BurnerItem = {
  id: number;
  number: string;
  burnerName: string | null;
  burnerEmoji: string | null;
  burnerColor: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

function BurnerCard({ item, onBurn, onSettings }: { item: BurnerItem; onBurn: (id: number, number: string) => void; onSettings: (item: BurnerItem) => void }) {
  const [countdown, setCountdown] = useState<{ text: string; urgency: "ok" | "warn" | "critical" } | null>(null);

  useEffect(() => {
    if (!item.expiresAt || !item.isActive) return;
    const update = () => setCountdown(formatCountdown(item.expiresAt!));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [item.expiresAt, item.isActive]);

  const color = item.burnerColor ?? "#FF6EC7";
  const urgency = countdown?.urgency ?? "ok";
  const urgencyColor = urgency === "critical" ? "#FF7A5C" : urgency === "warn" ? "#FFE94A" : color;

  // Compute expiry progress bar width
  let progressPct = 0;
  if (item.expiresAt && item.isActive) {
    const total = item.expiresAt.getTime() - item.createdAt.getTime();
    const remaining = item.expiresAt.getTime() - Date.now();
    progressPct = Math.max(0, Math.min(100, (remaining / total) * 100));
  }

  return (
    <View style={[styles.burnerCard, !item.isActive && styles.burnerCardExpired]}>
      <View style={styles.burnerCardHeader}>
        <View style={[styles.burnerEmoji, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={styles.burnerEmojiText}>{item.burnerEmoji ?? "🔥"}</Text>
        </View>
        <View style={styles.burnerCardInfo}>
          <Text style={styles.burnerName}>{item.burnerName ?? "Burner"}</Text>
          <Text style={styles.burnerNumber}>{item.number}</Text>
        </View>
        {item.isActive ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onSettings(item)}
            >
              <Text style={styles.settingsBtnText}>⚙️</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.burnBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onBurn(item.id, item.number)}
            >
              <Text style={styles.burnBtnText}>🔥 Burn</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.expiredTag}>
            <Text style={styles.expiredTagText}>EXPIRED</Text>
          </View>
        )}
      </View>

      {/* Live countdown */}
      {item.isActive && countdown && (
        <View style={styles.countdownRow}>
          <Text style={[styles.countdownLabel, { color: urgencyColor }]}>
            {urgency === "critical" ? "⚠️ " : "⏱ "}Expires in
          </Text>
          <Text style={[styles.countdownValue, { color: urgencyColor }]}>{countdown.text}</Text>
        </View>
      )}

      {/* Progress bar */}
      {item.isActive && (
        <View style={styles.expiryBar}>
          <View
            style={[
              styles.expiryFill,
              {
                width: `${progressPct}%` as any,
                backgroundColor: urgencyColor,
              },
            ]}
          />
        </View>
      )}

      {!item.isActive && (
        <Text style={styles.expiredText}>
          Burned {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : ""}
        </Text>
      )}
    </View>
  );
}

type BurnerMode = "active" | "forward" | "voicemail_only";

export default function BurnersTab() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBurnerName, setNewBurnerName] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [selectedColor, setSelectedColor] = useState(BURNER_COLORS[0]);
  const [confirmBurnId, setConfirmBurnId] = useState<{ id: number; number: string } | null>(null);
  const [settingsBurner, setSettingsBurner] = useState<BurnerItem | null>(null);
  const [settingsMode, setSettingsMode] = useState<BurnerMode>("active");
  const [settingsForwardTo, setSettingsForwardTo] = useState("");

  const { data: phoneNumbers = [], refetch } = trpc.phoneNumbers.list.useQuery();
  const createMutation = trpc.phoneNumbers.create.useMutation({
    onSuccess: () => refetch(),
  });
  const burnMutation = trpc.phoneNumbers.burn.useMutation({
    onSuccess: () => refetch(),
  });
  const updateModeMutation = trpc.phoneNumbers.updateMode.useMutation({
    onSuccess: () => {
      refetch();
      setSettingsBurner(null);
      Alert.alert("Settings Saved", "Burner mode updated successfully.");
    },
  });

  const burners = phoneNumbers.filter((p) => p.isBurner);
  const activeBurners = burners.filter((b) => b.isActive);
  const expiredBurners = burners.filter((b) => !b.isActive);

  const handleBurn = (id: number, number: string) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // FIX 11: Warn if burning early (more than 48hrs remaining)
    const burner = activeBurners.find((b) => b.id === id);
    if (burner?.expiresAt) {
      const hoursLeft = (new Date(burner.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft > 48) {
        Alert.alert(
          "⚠️ Burn Early?",
          `This burner still has ${Math.floor(hoursLeft)} hours remaining. Burning it now will permanently release the number. This cannot be undone.`,
          [
            { text: "Keep It", style: "cancel" },
            { text: "Burn Anyway", style: "destructive", onPress: () => setConfirmBurnId({ id, number }) },
          ]
        );
        return;
      }
    }
    setConfirmBurnId({ id, number });
  };

  const handleOpenSettings = (item: BurnerItem) => {
    setSettingsBurner(item);
    setSettingsMode("active");
    setSettingsForwardTo("");
  };

  const handleSaveSettings = () => {
    if (!settingsBurner) return;
    if (settingsMode === "forward" && !settingsForwardTo.trim()) {
      Alert.alert("Forward To Required", "Please enter a phone number to forward calls to.");
      return;
    }
    updateModeMutation.mutate({
      id: settingsBurner.id,
      mode: settingsMode,
      forwardTo: settingsMode === "forward" ? settingsForwardTo.trim() : undefined,
    });
  };

  const confirmBurn = () => {
    if (!confirmBurnId) return;
    burnMutation.mutate({ id: confirmBurnId.id, twilioNumber: confirmBurnId.number });
    setConfirmBurnId(null);
  };

  const handleCreate = () => {
    if (!newBurnerName.trim() || !selectedPurpose) return;
    const purpose = PURPOSES.find((p) => p.emoji === selectedPurpose);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + selectedDuration);

    // Use a placeholder number (in production, provision via Twilio API)
    const mockNumber = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

    createMutation.mutate({
      number: mockNumber,
      countryCode: "US",
      isBurner: true,
      burnerName: newBurnerName.trim(),
      burnerEmoji: selectedPurpose,
      burnerColor: selectedColor,
      expiresAt,
    });

    setShowCreateModal(false);
    setNewBurnerName("");
    setSelectedPurpose(null);
    setSelectedDuration(7);
    setSelectedColor(BURNER_COLORS[0]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Burners 🔥</Text>
          <Text style={styles.headerSub}>{activeBurners.length} active</Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable
            style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/number-select/buy" as never)}
          >
            <Text style={styles.buyBtnText}>📱 Buy</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Active burners */}
        {activeBurners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active</Text>
            {activeBurners.map((item) => (
              <BurnerCard
                key={item.id}
                item={{ ...item, expiresAt: item.expiresAt ? new Date(item.expiresAt) : null, createdAt: new Date(item.createdAt) }}
                onBurn={handleBurn}
                onSettings={handleOpenSettings}
              />
            ))}
          </View>
        )}

        {/* Expired burners */}
        {expiredBurners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Burned</Text>
            {expiredBurners.map((item) => (
              <BurnerCard
                key={item.id}
                item={{ ...item, expiresAt: item.expiresAt ? new Date(item.expiresAt) : null, createdAt: new Date(item.createdAt) }}
                onBurn={handleBurn}
                onSettings={handleOpenSettings}
              />
            ))}
          </View>
        )}

        {burners.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔥</Text>
            <Text style={styles.emptyTitle}>No burners yet</Text>
            <Text style={styles.emptySub}>Create a disposable number for privacy</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirm Burn Modal */}
      <Modal visible={!!confirmBurnId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmEmoji}>🔥</Text>
            <Text style={styles.confirmTitle}>Burn this number?</Text>
            <Text style={styles.confirmText}>
              This will permanently deactivate {confirmBurnId?.number} and release it from Twilio. This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={({ pressed }) => [styles.confirmCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setConfirmBurnId(null)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBurnBtn, pressed && { opacity: 0.7 }]}
                onPress={confirmBurn}
              >
                <Text style={styles.confirmBurnText}>🔥 Burn It</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔥 New Burner</Text>
            <Text style={styles.modalSub}>Create a disposable number</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Nickname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dating App"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newBurnerName}
                onChangeText={setNewBurnerName}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Purpose</Text>
              <View style={styles.purposeGrid}>
                {PURPOSES.map((p) => (
                  <Pressable
                    key={p.emoji}
                    style={({ pressed }) => [
                      styles.purposeChip,
                      selectedPurpose === p.emoji && styles.purposeChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedPurpose(p.emoji)}
                  >
                    <Text style={styles.purposeEmoji}>{p.emoji}</Text>
                    <Text style={[styles.purposeLabel, selectedPurpose === p.emoji && styles.purposeLabelActive]}>
                      {p.label.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Color</Text>
              <View style={styles.colorRow}>
                {BURNER_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotActive]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {[3, 7, 14, 30].map((d) => (
                  <Pressable
                    key={d}
                    style={({ pressed }) => [
                      styles.durationChip,
                      selectedDuration === d && styles.durationChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedDuration(d)}
                  >
                    <Text style={[styles.durationText, selectedDuration === d && styles.durationTextActive]}>
                      {d}d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalBtns}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCreateBtn,
                  (!newBurnerName.trim() || !selectedPurpose) && styles.modalCreateBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleCreate}
                disabled={!newBurnerName.trim() || !selectedPurpose}
              >
                <Text style={styles.modalCreateText}>🔥 Create Burner</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Burner Settings Modal */}
      <Modal visible={!!settingsBurner} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Burner Settings</Text>
            <Text style={styles.modalSub}>{settingsBurner?.number}</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Call Mode</Text>
              {(["active", "forward", "voicemail_only"] as BurnerMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={({ pressed }) => [
                    styles.modeOption,
                    settingsMode === m && styles.modeOptionActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setSettingsMode(m)}
                >
                  <Text style={[styles.modeOptionText, settingsMode === m && styles.modeOptionTextActive]}>
                    {m === "active" ? "📞 Active (normal)" : m === "forward" ? "➡️ Forward calls" : "📩 Voicemail only"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {settingsMode === "forward" && (
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Forward To Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
                  value={settingsForwardTo}
                  onChangeText={setSettingsForwardTo}
                />
              </View>
            )}

            <View style={styles.modalBtns}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setSettingsBurner(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalCreateBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSaveSettings}
                disabled={updateModeMutation.isPending}
              >
                <Text style={styles.modalCreateText}>✅ Save Settings</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 8, alignItems: "center" },
  buyBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buyBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
  createBtn: {
    backgroundColor: "rgba(255,110,199,0.13)",
    borderWidth: 1,
    borderColor: "#FF6EC7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createBtnText: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },

  section: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sectionTitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },

  burnerCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1a3a1f",
    gap: 10,
  },
  burnerCardExpired: { opacity: 0.6 },
  burnerCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  burnerEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  burnerEmojiText: { fontSize: 22 },
  burnerCardInfo: { flex: 1 },
  burnerName: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  burnerNumber: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  burnBtn: {
    backgroundColor: "#FF7A5C22",
    borderWidth: 1,
    borderColor: "#FF7A5C",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  burnBtnText: { color: "#FF7A5C", fontSize: 12, fontWeight: "700" },
  settingsBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsBtnText: { fontSize: 14 },
  modeOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 6,
  },
  modeOptionActive: {
    backgroundColor: "rgba(255,110,199,0.12)",
    borderColor: "rgba(255,110,199,0.4)",
  },
  modeOptionText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
  modeOptionTextActive: { color: "#FF6EC7" },
  expiredTag: {
    backgroundColor: "#1a3a1f",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  expiredTagText: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  countdownRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countdownLabel: { fontSize: 12, fontWeight: "600" },
  countdownValue: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },

  expiryBar: { height: 3, backgroundColor: "#1a3a1f", borderRadius: 2, overflow: "hidden" },
  expiryFill: { height: 3, borderRadius: 2 },
  expiredText: { color: "rgba(255,255,255,0.55)", fontSize: 12 },

  emptyContainer: { alignItems: "center", paddingVertical: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  emptySub: { color: "rgba(255,255,255,0.55)", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    borderTopWidth: 1,
    borderColor: "#1a3a1f",
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  modalSub: { color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: -8 },
  modalField: { gap: 8 },
  modalLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: "#0D0520",
    borderWidth: 1,
    borderColor: "#1a3a1f",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
  },
  purposeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  purposeChip: {
    backgroundColor: "#0D0520",
    borderWidth: 1,
    borderColor: "#1a3a1f",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
    minWidth: 72,
  },
  purposeChipActive: { backgroundColor: "rgba(255,110,199,0.13)", borderColor: "#FF6EC7" },
  purposeEmoji: { fontSize: 20 },
  purposeLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  purposeLabelActive: { color: "#FF6EC7" },
  colorRow: { flexDirection: "row", gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#FFFFFF" },
  durationRow: { flexDirection: "row", gap: 8 },
  durationChip: {
    flex: 1,
    backgroundColor: "#0D0520",
    borderWidth: 1,
    borderColor: "#1a3a1f",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  durationChipActive: { backgroundColor: "rgba(255,110,199,0.13)", borderColor: "#FF6EC7" },
  durationText: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  durationTextActive: { color: "#FF6EC7" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#1a3a1f",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  modalCancelText: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" },
  modalCreateBtn: {
    flex: 2,
    backgroundColor: "#FF6EC7",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  modalCreateBtnDisabled: { backgroundColor: "#1a3a1f" },
  modalCreateText: { color: "#0D0520", fontSize: 15, fontWeight: "800" },

  confirmCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#1a3a1f",
  },
  confirmEmoji: { fontSize: 44 },
  confirmTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  confirmText: { color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "center", lineHeight: 20 },
  confirmBtns: { flexDirection: "row", gap: 10, width: "100%" },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: "#1a3a1f",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  confirmCancelText: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" },
  confirmBurnBtn: {
    flex: 1,
    backgroundColor: "#FF7A5C22",
    borderWidth: 1,
    borderColor: "#FF7A5C",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  confirmBurnText: { color: "#FF7A5C", fontSize: 15, fontWeight: "800" },
});
