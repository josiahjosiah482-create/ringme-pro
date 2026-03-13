import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

const COUNTRIES = [
  { code: "US", flag: "🇺🇸", name: "United States", dial: "+1", voice: true, sms: true, mms: true },
  { code: "CA", flag: "🇨🇦", name: "Canada", dial: "+1", voice: true, sms: true, mms: true },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", dial: "+44", voice: true, sms: true, mms: false },
  { code: "AU", flag: "🇦🇺", name: "Australia", dial: "+61", voice: true, sms: true, mms: false },
  { code: "DE", flag: "🇩🇪", name: "Germany", dial: "+49", voice: true, sms: true, mms: false },
  { code: "FR", flag: "🇫🇷", name: "France", dial: "+33", voice: true, sms: true, mms: false },
  { code: "MX", flag: "🇲🇽", name: "Mexico", dial: "+52", voice: true, sms: true, mms: false },
  { code: "BR", flag: "🇧🇷", name: "Brazil", dial: "+55", voice: false, sms: true, mms: false },
  { code: "IN", flag: "🇮🇳", name: "India", dial: "+91", voice: false, sms: true, mms: false },
  { code: "JP", flag: "🇯🇵", name: "Japan", dial: "+81", voice: false, sms: true, mms: false },
];

export default function CountrySelectorScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search)
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Select Country</Text>
        <Text style={styles.subtitle}>Choose where your number will be based</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search countries..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.countryRow, pressed && { opacity: 0.7 }]}
            onPress={() =>
              router.push({
                pathname: "/number-select/numbers" as never,
                params: { country: item.code, countryName: item.name, dial: item.dial },
              })
            }
          >
            <Text style={styles.flag}>{item.flag}</Text>
            <View style={styles.countryInfo}>
              <Text style={styles.countryName}>{item.name}</Text>
              <Text style={styles.dialCode}>{item.dial}</Text>
            </View>
            <View style={styles.badges}>
              {item.voice && (
                <View style={[styles.badge, styles.badgeVoice]}>
                  <Text style={styles.badgeText}>VOICE</Text>
                </View>
              )}
              {item.sms && (
                <View style={[styles.badge, styles.badgeSms]}>
                  <Text style={styles.badgeText}>SMS</Text>
                </View>
              )}
              {item.mms && (
                <View style={[styles.badge, styles.badgeMms]}>
                  <Text style={styles.badgeText}>MMS</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  flag: { fontSize: 28 },
  countryInfo: { flex: 1 },
  countryName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  dialCode: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", gap: 4 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeVoice: { backgroundColor: "rgba(255,110,199,0.13)" },
  badgeSms: { backgroundColor: "#5BC8FF22" },
  badgeMms: { backgroundColor: "#FFE94A22" },
  badgeText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.55)" },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
});
