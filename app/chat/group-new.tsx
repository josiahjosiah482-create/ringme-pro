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
};

const AVATAR_COLORS = ["#FF6EC7", "#C084FC", "#4DFFB4", "#5BC8FF", "#FFE94A", "#FF9F00"];

export default function GroupNewScreen() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<{ number: string; name?: string }[]>([]);

  const { data: contacts } = trpc.contacts.list.useQuery();
  const createMutation = trpc.groups.create.useMutation({
    onSuccess: (conv) => {
      router.replace(`/chat/${conv.id}`);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const addMember = () => {
    const cleaned = memberInput.trim().replace(/\s/g, "");
    if (!cleaned || cleaned.length < 7) {
      Alert.alert("Invalid Number", "Please enter a valid phone number.");
      return;
    }
    if (members.some((m) => m.number === cleaned)) {
      Alert.alert("Duplicate", "This number is already in the group.");
      return;
    }
    if (members.length >= 9) {
      Alert.alert("Limit Reached", "Groups can have up to 10 members (including you).");
      return;
    }
    const contact = contacts?.find((c) => c.number === cleaned);
    setMembers((prev) => [...prev, { number: cleaned, name: contact?.name }]);
    setMemberInput("");
  };

  const addFromContacts = (number: string, name: string) => {
    if (members.some((m) => m.number === number)) return;
    if (members.length >= 9) {
      Alert.alert("Limit Reached", "Groups can have up to 10 members.");
      return;
    }
    setMembers((prev) => [...prev, { number, name }]);
  };

  const removeMember = (number: string) => {
    setMembers((prev) => prev.filter((m) => m.number !== number));
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name Required", "Please enter a name for this group.");
      return;
    }
    if (members.length < 2) {
      Alert.alert("Add Members", "Please add at least 2 members to create a group.");
      return;
    }
    createMutation.mutate({
      groupName: groupName.trim(),
      members: members.map((m) => m.number),
    });
  };

  const filteredContacts = contacts?.filter(
    (c) => !members.some((m) => m.number === c.number)
  ) ?? [];

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
        <Text style={styles.headerTitle}>New Group</Text>
        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            members.length < 2 && styles.createBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleCreate}
          disabled={createMutation.isPending || members.length < 2}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#0D0520" size="small" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={styles.topSection}>
            {/* Group Name */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Group Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Family, Work Team, Friends..."
                placeholderTextColor={C.txt2}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={64}
                autoFocus
              />
            </View>

            {/* Add Member */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Add Members</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={C.txt2}
                  value={memberInput}
                  onChangeText={setMemberInput}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={addMember}
                />
                <Pressable
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
                  onPress={addMember}
                >
                  <Text style={styles.addBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Members List */}
            {members.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Members ({members.length}/10)</Text>
                {members.map((m, idx) => (
                  <View key={m.number} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] + "33" }]}>
                      <Text style={[styles.memberAvatarText, { color: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                        {m.name ? m.name[0].toUpperCase() : m.number[0]}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      {m.name && <Text style={styles.memberName}>{m.name}</Text>}
                      <Text style={styles.memberNumber}>{m.number}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => removeMember(m.number)}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {filteredContacts.length > 0 && (
              <Text style={styles.sectionTitle}>Add from Contacts</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
            onPress={() => addFromContacts(item.number, item.name)}
          >
            <View style={[styles.contactAvatar, { backgroundColor: (item.avatarColor ?? C.pink) + "33" }]}>
              <Text style={[styles.contactAvatarText, { color: item.avatarColor ?? C.pink }]}>
                {item.name[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactNumber}>{item.number}</Text>
            </View>
            <View style={styles.addContactBtn}>
              <Text style={styles.addContactBtnText}>+</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.pink,
    minWidth: 70,
    alignItems: "center",
  },
  createBtnDisabled: { backgroundColor: "rgba(255,110,199,0.3)" },
  createBtnText: { color: "#0D0520", fontSize: 14, fontWeight: "800" },
  topSection: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  fieldLabel: { color: C.txt2, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
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
  addRow: { flexDirection: "row", gap: 10 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#0D0520", fontSize: 22, fontWeight: "700", lineHeight: 26 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { fontSize: 14, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { color: C.txt, fontSize: 14, fontWeight: "600" },
  memberNumber: { color: C.txt2, fontSize: 12 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,92,92,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#FF5C5C", fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: C.txt, fontSize: 14, fontWeight: "700", paddingHorizontal: 16, marginTop: 4 },
  list: { paddingBottom: 40 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: { fontSize: 16, fontWeight: "700" },
  contactInfo: { flex: 1 },
  contactName: { color: C.txt, fontSize: 15, fontWeight: "600" },
  contactNumber: { color: C.txt2, fontSize: 12, marginTop: 1 },
  addContactBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,110,199,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  addContactBtnText: { color: C.pink, fontSize: 18, fontWeight: "700", lineHeight: 22 },
});
