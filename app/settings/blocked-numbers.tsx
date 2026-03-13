import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
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
  danger: "#FF5C5C",
};

export default function BlockedNumbersScreen() {
  const router = useRouter();
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: blocked, isLoading, refetch } = trpc.blockedNumbers.list.useQuery();
  const addMutation = trpc.blockedNumbers.add.useMutation({
    onSuccess: () => {
      setNewNumber("");
      setNewLabel("");
      setShowAdd(false);
      refetch();
    },
    onError: (err) => Alert.alert("Error", err.message),
  });
  const removeMutation = trpc.blockedNumbers.remove.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => Alert.alert("Error", err.message),
  });

  const handleAdd = () => {
    const cleaned = newNumber.trim().replace(/\s/g, "");
    if (!cleaned || cleaned.length < 7) {
      Alert.alert("Invalid Number", "Please enter a valid phone number.");
      return;
    }
    addMutation.mutate({ number: cleaned, label: newLabel.trim() || undefined });
  };

  const handleRemove = (id: number, number: string) => {
    Alert.alert("Unblock Number", `Unblock ${number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", style: "destructive", onPress: () => removeMutation.mutate({ id }) },
    ]);
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
        <Text style={styles.headerTitle}>Blocked Numbers</Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShowAdd((v) => !v)}
        >
          <Text style={styles.addBtnText}>{showAdd ? "✕" : "+ Add"}</Text>
        </Pressable>
      </View>

      {/* Add form */}
      {showAdd && (
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>Block a Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={C.txt2}
            value={newNumber}
            onChangeText={setNewNumber}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Label (optional, e.g. Spam Caller)"
            placeholderTextColor={C.txt2}
            value={newLabel}
            onChangeText={setNewLabel}
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [styles.blockBtn, pressed && { opacity: 0.8 }]}
            onPress={handleAdd}
            disabled={addMutation.isPending}
          >
            {addMutation.isPending ? (
              <ActivityIndicator color="#0D0520" size="small" />
            ) : (
              <Text style={styles.blockBtnText}>🚫 Block Number</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.pink} size="large" />
        </View>
      ) : !blocked || blocked.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={styles.emptyTitle}>No Blocked Numbers</Text>
          <Text style={styles.emptySubtitle}>
            Numbers you block will appear here. Blocked callers go straight to voicemail.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Text style={styles.rowIconText}>🚫</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowNumber}>{item.number}</Text>
                {item.label ? (
                  <Text style={styles.rowLabel}>{item.label}</Text>
                ) : null}
                <Text style={styles.rowDate}>
                  Blocked {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.unblockBtn, pressed && { opacity: 0.7 }]}
                onPress={() => handleRemove(item.id, item.number)}
              >
                {removeMutation.isPending ? (
                  <ActivityIndicator color={C.danger} size="small" />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </Pressable>
            </View>
          )}
        />
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
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,110,199,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.3)",
  },
  addBtnText: { color: C.pink, fontSize: 13, fontWeight: "700" },
  addForm: {
    margin: 16,
    padding: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  addFormTitle: { color: C.txt, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  input: {
    backgroundColor: C.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.txt,
    fontSize: 15,
  },
  blockBtn: {
    backgroundColor: C.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  blockBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: C.txt, fontSize: 18, fontWeight: "700" },
  emptySubtitle: { color: C.txt2, fontSize: 14, textAlign: "center", lineHeight: 20 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,92,92,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowNumber: { color: C.txt, fontSize: 15, fontWeight: "600" },
  rowLabel: { color: C.txt2, fontSize: 12, marginTop: 2 },
  rowDate: { color: C.txt2, fontSize: 11, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,92,92,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,92,92,0.3)",
  },
  unblockText: { color: C.danger, fontSize: 12, fontWeight: "700" },
});
