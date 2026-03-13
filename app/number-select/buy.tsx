import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

type NumberType = "standard" | "burner";

const BURNER_EMOJIS = ["🔥", "👻", "🕵️", "🎭", "🌚", "⚡", "🦊", "🐉"];
const BURNER_COLORS = ["#FFE94A", "#C084FC", "#5BC8FF", "#FF7A5C", "#FF6EC7", "#4DFFB4", "#FF9F00", "#F0ABFF"];
const DURATION_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "No expiry", days: 0 },
];

export default function BuyNumberScreen() {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState("");
  const [numberType, setNumberType] = useState<NumberType>("standard");
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [burnerName, setBurnerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(BURNER_EMOJIS[0]);
  const [selectedColor, setSelectedColor] = useState(BURNER_COLORS[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[2]);
  const [isProvisioning, setIsProvisioning] = useState(false);

  const searchMutation = trpc.twilio.searchNumbers.useMutation({
    onSuccess: (data) => {
      setResults(data.numbers);
    },
    onError: (err) => {
      Alert.alert("Search Failed", err.message);
    },
  });

  const provisionMutation = trpc.twilio.provisionNumber.useMutation({
    onSuccess: (data) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsProvisioning(false);
      setShowConfigModal(false);
      Alert.alert(
        "Number Provisioned! 🎉",
        `${data.phoneNumber} is now yours and ready to use.`,
        [{ text: "Go to Messages", onPress: () => router.replace("/(tabs)" as never) }]
      );
    },
    onError: (err) => {
      setIsProvisioning(false);
      Alert.alert("Provisioning Failed", err.message);
    },
  });

  const handleSearch = useCallback(() => {
    if (areaCode.length !== 3 && areaCode.length !== 0) {
      Alert.alert("Invalid Area Code", "Please enter a 3-digit area code or leave blank to search all.");
      return;
    }
    searchMutation.mutate({
      areaCode: areaCode || undefined,
      countryCode: "US",
      limit: 10,
    });
  }, [areaCode]);

  const handleSelectNumber = (num: AvailableNumber) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNumber(num);
    setShowConfigModal(true);
  };

  const handleProvision = () => {
    if (!selectedNumber) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProvisioning(true);
    provisionMutation.mutate({
      phoneNumber: selectedNumber.phoneNumber,
      isBurner: numberType === "burner",
      burnerName: numberType === "burner" ? (burnerName || "Burner") : undefined,
      burnerEmoji: numberType === "burner" ? selectedEmoji : undefined,
      burnerColor: numberType === "burner" ? selectedColor : undefined,
      expiresInDays: numberType === "burner" && selectedDuration.days > 0 ? selectedDuration.days : undefined,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Get a Number 📱</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.phoneNumber}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Type selector */}
            <View style={styles.typeRow}>
              {(["standard", "burner"] as NumberType[]).map((t) => (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.typeBtn,
                    numberType === t && styles.typeBtnActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setNumberType(t)}
                >
                  <Text style={styles.typeEmoji}>{t === "standard" ? "📱" : "🔥"}</Text>
                  <Text style={[styles.typeBtnText, numberType === t && styles.typeBtnTextActive]}>
                    {t === "standard" ? "Standard" : "Burner"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <View style={styles.descCard}>
              <Text style={styles.descText}>
                {numberType === "standard"
                  ? "A permanent second number for calls, texts, and privacy. Stays active until you cancel."
                  : "A temporary number that auto-deletes after your chosen duration. Perfect for one-time use."}
              </Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
              <View style={styles.areaCodeInput}>
                <Text style={styles.areaCodePrefix}>+1 (</Text>
                <TextInput
                  style={styles.areaCodeField}
                  placeholder="NXX"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={areaCode}
                  onChangeText={(t) => setAreaCode(t.replace(/\D/g, "").slice(0, 3))}
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <Text style={styles.areaCodeSuffix}>)</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSearch}
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0D0520" />
                ) : (
                  <Text style={styles.searchBtnText}>Search</Text>
                )}
              </Pressable>
            </View>

            {results.length > 0 && (
              <Text style={styles.resultsLabel}>
                {results.length} number{results.length !== 1 ? "s" : ""} available
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          searchMutation.isPending ? null : (
            <View style={styles.emptyContainer}>
              {searchMutation.isIdle ? (
                <>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={styles.emptyTitle}>Search for a number</Text>
                  <Text style={styles.emptySubtitle}>Enter an area code or leave blank to browse all US numbers</Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyEmoji}>😔</Text>
                  <Text style={styles.emptyTitle}>No numbers found</Text>
                  <Text style={styles.emptySubtitle}>Try a different area code</Text>
                </>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.numberCard, pressed && { opacity: 0.85 }]}
            onPress={() => handleSelectNumber(item)}
          >
            <View style={styles.numberLeft}>
              <Text style={styles.numberFriendly}>{item.friendlyName}</Text>
              <Text style={styles.numberMeta}>
                {[item.locality, item.region].filter(Boolean).join(", ") || item.isoCountry}
              </Text>
              <View style={styles.capsBadges}>
                {item.capabilities.voice && (
                  <View style={styles.capBadge}><Text style={styles.capText}>📞 Voice</Text></View>
                )}
                {item.capabilities.sms && (
                  <View style={styles.capBadge}><Text style={styles.capText}>💬 SMS</Text></View>
                )}
                {item.capabilities.mms && (
                  <View style={styles.capBadge}><Text style={styles.capText}>🖼️ MMS</Text></View>
                )}
              </View>
            </View>
            <View style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>Select</Text>
            </View>
          </Pressable>
        )}
      />

      {/* Config Modal */}
      <Modal visible={showConfigModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {numberType === "burner" ? "🔥 Configure Burner" : "📱 Confirm Number"}
            </Text>
            <Text style={styles.modalNumber}>{selectedNumber?.friendlyName}</Text>

            {numberType === "burner" && (
              <>
                {/* Burner name */}
                <TextInput
                  style={styles.burnerNameInput}
                  placeholder="Nickname (e.g. Work, Dating, Travel)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={burnerName}
                  onChangeText={setBurnerName}
                  maxLength={32}
                />

                {/* Emoji picker */}
                <Text style={styles.pickerLabel}>Choose an emoji</Text>
                <View style={styles.emojiRow}>
                  {BURNER_EMOJIS.map((e) => (
                    <Pressable
                      key={e}
                      style={({ pressed }) => [
                        styles.emojiBtn,
                        selectedEmoji === e && styles.emojiBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setSelectedEmoji(e)}
                    >
                      <Text style={styles.emojiText}>{e}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Color picker */}
                <Text style={styles.pickerLabel}>Choose a color</Text>
                <View style={styles.colorRow}>
                  {BURNER_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={({ pressed }) => [
                        styles.colorBtn,
                        { backgroundColor: c },
                        selectedColor === c && styles.colorBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setSelectedColor(c)}
                    />
                  ))}
                </View>

                {/* Duration */}
                <Text style={styles.pickerLabel}>Expires in</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => (
                    <Pressable
                      key={d.label}
                      style={({ pressed }) => [
                        styles.durationBtn,
                        selectedDuration.label === d.label && styles.durationBtnActive,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setSelectedDuration(d)}
                    >
                      <Text style={[styles.durationText, selectedDuration.label === d.label && styles.durationTextActive]}>
                        {d.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Confirm */}
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, isProvisioning && styles.confirmBtnDisabled]}
              onPress={handleProvision}
              disabled={isProvisioning}
            >
              {isProvisioning ? (
                <ActivityIndicator size="small" color="#0D0520" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {numberType === "burner" ? "🔥 Activate Burner" : "📱 Get This Number"}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => { setShowConfigModal(false); setSelectedNumber(null); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 28, color: "#FF6EC7", fontWeight: "300" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.3 },

  typeRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#1A0D35", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  typeBtnActive: { backgroundColor: "rgba(255,110,199,0.13)", borderColor: "#FF6EC7" },
  typeEmoji: { fontSize: 18 },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.55)" },
  typeBtnTextActive: { color: "#FF6EC7" },

  descCard: {
    marginHorizontal: 20, marginTop: 12, padding: 14,
    backgroundColor: "#1A0D35", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  descText: { fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 19 },

  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 16 },
  areaCodeInput: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#1A0D35", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12, height: 48,
  },
  areaCodePrefix: { fontSize: 16, color: "rgba(255,255,255,0.55)" },
  areaCodeField: { flex: 1, fontSize: 18, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  areaCodeSuffix: { fontSize: 16, color: "rgba(255,255,255,0.55)" },
  searchBtn: {
    paddingHorizontal: 20, height: 48, borderRadius: 12,
    backgroundColor: "#FF6EC7", alignItems: "center", justifyContent: "center",
  },
  searchBtnText: { fontSize: 15, fontWeight: "700", color: "#0D0520" },

  resultsLabel: { fontSize: 12, color: "rgba(255,255,255,0.55)", paddingHorizontal: 20, marginTop: 16, marginBottom: 4 },

  emptyContainer: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 20 },

  numberCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginTop: 10, padding: 16,
    backgroundColor: "#1A0D35", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  numberLeft: { flex: 1 },
  numberFriendly: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
  numberMeta: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 },
  capsBadges: { flexDirection: "row", gap: 6 },
  capBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "rgba(255,110,199,0.07)", borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,110,199,0.2)",
  },
  capText: { fontSize: 11, color: "#FF6EC7" },
  selectBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#FF6EC7",
  },
  selectBtnText: { fontSize: 13, fontWeight: "700", color: "#0D0520" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1A0D35", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", textAlign: "center", marginBottom: 4 },
  modalNumber: { fontSize: 24, fontWeight: "700", color: "#FF6EC7", textAlign: "center", marginBottom: 20 },

  burnerNameInput: {
    backgroundColor: "#0D0520", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: "#FFFFFF", marginBottom: 16,
  },
  pickerLabel: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.55)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },

  emojiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0D0520", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  emojiBtnActive: { borderColor: "#FF6EC7", backgroundColor: "rgba(255,110,199,0.07)" },
  emojiText: { fontSize: 22 },

  colorRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  colorBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  colorBtnActive: { borderColor: "#ffffff", transform: [{ scale: 1.15 }] },

  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  durationBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#0D0520", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  durationBtnActive: { backgroundColor: "rgba(255,110,199,0.13)", borderColor: "#FF6EC7" },
  durationText: { fontSize: 13, color: "rgba(255,255,255,0.55)" },
  durationTextActive: { color: "#FF6EC7", fontWeight: "600" },

  confirmBtn: {
    backgroundColor: "#FF6EC7", borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginBottom: 12,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#0D0520" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 15, color: "rgba(255,255,255,0.55)" },
});
