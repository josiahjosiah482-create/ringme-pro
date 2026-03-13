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
import { trpc } from "@/lib/trpc";

const AVATAR_COLORS = ["#FF6EC7", "#5BC8FF", "#FFE94A", "#FF7A5C", "#C084FC", "#C084FC"];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function NewChatScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Fetch existing conversations to show recent contacts
  const { data: dbConversations } = trpc.conversations.list.useQuery();
  const getOrCreateMutation = trpc.conversations.getOrCreate.useMutation();

  const recentContacts = (dbConversations ?? []).slice(0, 10).map((c) => ({
    id: c.id.toString(),
    name: c.contactName ?? c.contactNumber,
    number: c.contactNumber,
    avatarColor: getAvatarColor(c.contactNumber),
  }));

  const filtered = recentContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.number.includes(search)
  );

  const handleSelect = async (contact: { id: string; name: string; number: string }) => {
    router.replace({
      pathname: "/chat/[id]" as never,
      params: { id: contact.id, name: contact.name, number: contact.number },
    });
  };

  const handleNewNumber = async () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    // Check if it looks like a phone number
    const isNumber = /^[\d\s\+\-\(\)]+$/.test(trimmed);
    if (isNumber) {
      try {
        const convo = await getOrCreateMutation.mutateAsync({
          contactNumber: trimmed,
        });
        router.replace({
          pathname: "/chat/[id]" as never,
          params: { id: convo.id.toString(), name: trimmed, number: trimmed },
        });
      } catch {
        router.replace({
          pathname: "/chat/[id]" as never,
          params: { id: "new", name: trimmed, number: trimmed },
        });
      }
    } else {
      // Search by name — just navigate with the name as a search
      router.replace({
        pathname: "/chat/[id]" as never,
        params: { id: "new", name: trimmed, number: trimmed },
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Message</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* To field */}
      <View style={styles.toField}>
        <Text style={styles.toLabel}>To:</Text>
        <TextInput
          style={styles.toInput}
          placeholder="Name or number"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
          autoFocus
          keyboardType="default"
          returnKeyType="done"
          onSubmitEditing={handleNewNumber}
        />
        {search.trim() && (
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
            onPress={handleNewNumber}
          >
            <Text style={styles.newBtnText}>→</Text>
          </Pressable>
        )}
      </View>

      {/* Contacts */}
      <Text style={styles.sectionLabel}>Recent Contacts</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
            onPress={() => handleSelect(item)}
          >
            <View style={[styles.avatar, { backgroundColor: item.avatarColor + "22", borderColor: item.avatarColor }]}>
              <Text style={[styles.avatarText, { color: item.avatarColor }]}>{getInitials(item.name)}</Text>
            </View>
            <View>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactNumber}>{item.number}</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  cancelBtn: { width: 60 },
  cancelBtnText: { color: "#FF6EC7", fontSize: 16 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  toField: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  toLabel: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" },
  toInput: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { color: "#0D0520", fontSize: 18, fontWeight: "800" },
  sectionLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 1,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700" },
  contactName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  contactNumber: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 74 },
});
