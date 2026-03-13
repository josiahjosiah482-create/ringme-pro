import { useState, useMemo } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

function generateNumbersForAreaCode(areaCode: string, dial: string): string[] {
  const seed = areaCode.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const numbers: string[] = [];
  for (let i = 0; i < 5; i++) {
    const prefix = ((seed * (i + 7) * 31) % 900 + 100).toString();
    const suffix = ((seed * (i + 13) * 17) % 9000 + 1000).toString();
    numbers.push(`${dial} (${areaCode}) ${prefix}-${suffix}`);
  }
  return numbers;
}

const US_AREA_CODES: { code: string; city: string }[] = [
  { code: "212", city: "New York, NY" },
  { code: "213", city: "Los Angeles, CA" },
  { code: "310", city: "Los Angeles, CA" },
  { code: "312", city: "Chicago, IL" },
  { code: "415", city: "San Francisco, CA" },
  { code: "617", city: "Boston, MA" },
  { code: "646", city: "New York, NY" },
  { code: "702", city: "Las Vegas, NV" },
  { code: "713", city: "Houston, TX" },
  { code: "718", city: "New York, NY" },
  { code: "786", city: "Miami, FL" },
  { code: "818", city: "Los Angeles, CA" },
  { code: "858", city: "San Diego, CA" },
  { code: "917", city: "New York, NY" },
  { code: "929", city: "New York, NY" },
  { code: "949", city: "Orange County, CA" },
];

const CA_AREA_CODES: { code: string; city: string }[] = [
  { code: "416", city: "Toronto, ON" },
  { code: "604", city: "Vancouver, BC" },
  { code: "514", city: "Montreal, QC" },
  { code: "613", city: "Ottawa, ON" },
  { code: "780", city: "Edmonton, AB" },
];

export default function NumberSelectorScreen() {
  const router = useRouter();
  const { setNumberSelected } = useAuth();
  const params = useLocalSearchParams<{ country: string; countryName: string; dial: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [areaCodeSearch, setAreaCodeSearch] = useState("");
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);

  const countryCode = params.country ?? "US";
  const dial = params.dial ?? "+1";
  const areaCodes = countryCode === "CA" ? CA_AREA_CODES : US_AREA_CODES;

  const filteredAreaCodes = useMemo(() => {
    const q = areaCodeSearch.trim();
    return areaCodes.filter(
      (a) => a.code.includes(q) || a.city.toLowerCase().includes(q.toLowerCase())
    );
  }, [areaCodeSearch, areaCodes]);

  const activeAreaCode = selectedAreaCode ?? filteredAreaCodes[0]?.code ?? "212";

  const numbers = useMemo(() => {
    return generateNumbersForAreaCode(activeAreaCode, dial);
  }, [activeAreaCode, dial]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await setNumberSelected(selected!);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Choose Your Number</Text>
          <Text style={styles.subtitle}>
            {params.countryName ?? "United States"} · {dial}
          </Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>SEARCH BY AREA CODE OR CITY</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. 212 or New York"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={areaCodeSearch}
            onChangeText={(t) => {
              setAreaCodeSearch(t);
              setSelectedAreaCode(null);
            }}
            keyboardType="default"
            returnKeyType="search"
          />
          {areaCodeSearch.length > 0 && (
            <Pressable onPress={() => { setAreaCodeSearch(""); setSelectedAreaCode(null); }}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
        <FlatList
          horizontal
          data={filteredAreaCodes}
          keyExtractor={(item) => item.code}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.areaCodeRow}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.areaChip,
                activeAreaCode === item.code && styles.areaChipActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                setSelectedAreaCode(item.code);
                setSelected(null);
              }}
            >
              <Text style={[styles.areaChipCode, activeAreaCode === item.code && styles.areaChipCodeActive]}>
                ({item.code})
              </Text>
              <Text style={[styles.areaChipCity, activeAreaCode === item.code && styles.areaChipCityActive]} numberOfLines={1}>
                {item.city}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.noAreaCodes}>No area codes found for "{areaCodeSearch}"</Text>
          }
        />
      </View>

      <FlatList
        data={numbers}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            Available numbers · ({activeAreaCode})
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.numberCard,
              selected === item && styles.numberCardSelected,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              setSelected(item);
              setConfirming(true);
            }}
          >
            <View style={styles.numberLeft}>
              <Text style={styles.phoneIcon}>📱</Text>
              <View>
                <Text style={styles.numberText}>{item}</Text>
                <Text style={styles.numberType}>Local number · Free</Text>
              </View>
            </View>
            {selected === item && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal visible={confirming} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>📱</Text>
            <Text style={styles.modalTitle}>Claim this number?</Text>
            <Text style={styles.modalNumber}>{selected}</Text>
            <Text style={styles.modalSub}>
              This will be your primary RingMe number. You can add burner numbers later.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D0520" />
              ) : (
                <Text style={styles.confirmBtnText}>Claim Number →</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setConfirming(false)}
            >
              <Text style={styles.cancelBtnText}>Choose Different</Text>
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
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#FF6EC7", fontSize: 22, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  searchLabel: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15, paddingVertical: 10 },
  clearIcon: { color: "rgba(255,255,255,0.4)", fontSize: 14, padding: 4 },
  areaCodeRow: { paddingRight: 8, gap: 8, paddingBottom: 4 },
  areaChip: {
    backgroundColor: "#1A0D35",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  areaChipActive: { backgroundColor: "rgba(255,110,199,0.12)", borderColor: "#FF6EC7" },
  areaChipCode: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" },
  areaChipCodeActive: { color: "#FF6EC7" },
  areaChipCity: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 },
  areaChipCityActive: { color: "rgba(255,110,199,0.7)" },
  noAreaCodes: { color: "rgba(255,255,255,0.4)", fontSize: 13, paddingVertical: 8 },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  listHeader: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", marginBottom: 12, letterSpacing: 1 },
  numberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A0D35",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  numberCardSelected: { borderColor: "#FF6EC7", backgroundColor: "rgba(255,110,199,0.07)" },
  numberLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  phoneIcon: { fontSize: 24 },
  numberText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  numberType: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  checkmark: { color: "#FF6EC7", fontSize: 20, fontWeight: "700" },
  separator: { height: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalEmoji: { fontSize: 48, marginBottom: 16 },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalNumber: { color: "#FF6EC7", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  modalSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  confirmBtn: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "700" },
  cancelBtn: { width: "100%", height: 48, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
});
