import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { trpc } from "@/lib/trpc";

export default function ExportDataScreen() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = trpc.userData.export.useQuery(undefined, {
    enabled: false,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await refetch();
      if (!result.data) throw new Error("No data returned");

      const json = JSON.stringify(result.data, null, 2);

      if (Platform.OS === "web") {
        // Web: trigger download via blob
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ringme-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert("Export Complete", "Your data has been downloaded.");
      } else {
        // Native: write to temp file and share
        const fileName = `ringme-export-${new Date().toISOString().slice(0, 10)}.json`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "Export RingMe Data" });
        } else {
          Alert.alert("Export Complete", `Data saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      console.error("[Export] Failed:", err);
      Alert.alert("Export Failed", "Could not export your data. Please try again.");
    } finally {
      setExporting(false);
    }
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
        <Text style={styles.headerTitle}>Export Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📦</Text>
          <Text style={styles.infoTitle}>Export Your Data</Text>
          <Text style={styles.infoText}>
            Download a complete copy of your RingMe data as a JSON file. This includes your messages, call logs, contacts, voicemails, and phone numbers.
          </Text>
        </View>

        {/* What's included */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's included</Text>
          {[
            { icon: "💬", label: "Conversations & Messages" },
            { icon: "📞", label: "Call Logs" },
            { icon: "👥", label: "Contacts" },
            { icon: "🎙️", label: "Voicemails" },
            { icon: "📱", label: "Phone Numbers" },
          ].map((item) => (
            <View key={item.label} style={styles.includeRow}>
              <Text style={styles.includeIcon}>{item.icon}</Text>
              <Text style={styles.includeLabel}>{item.label}</Text>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ))}
        </View>

        {/* Export button */}
        <Pressable
          style={({ pressed }) => [styles.exportBtn, (exporting || isLoading) && styles.exportBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={handleExport}
          disabled={exporting || isLoading}
        >
          {exporting ? (
            <ActivityIndicator color="#0D0520" size="small" />
          ) : (
            <Text style={styles.exportBtnText}>⬇ Export My Data</Text>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          Your data is exported in JSON format. This file contains personal information — keep it secure.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#FF6EC7", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  content: { padding: 20, gap: 20 },
  infoCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.2)",
  },
  infoIcon: { fontSize: 40 },
  infoTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  infoText: { color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", lineHeight: 20 },
  section: {
    backgroundColor: "#1A0D35",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  includeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  includeIcon: { fontSize: 18, width: 24, textAlign: "center" },
  includeLabel: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  checkmark: { color: "#4DFFB4", fontSize: 16, fontWeight: "700" },
  exportBtn: {
    backgroundColor: "#FF6EC7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnDisabled: { backgroundColor: "#1A0D35", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  exportBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "800" },
  footerNote: { color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", lineHeight: 18 },
});
