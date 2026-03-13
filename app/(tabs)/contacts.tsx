import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import { trpc } from "@/lib/trpc";

const AVATAR_COLORS = ["#FF6EC7", "#5BC8FF", "#4DFFB4", "#FFE94A", "#C084FC", "#FF7A5C", "#F0ABFF"];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function randomAvatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

type ContactItem = { id: number; userId: number; name: string; number: string; avatarColor: string | null; isFavorite: boolean; isDeviceContact: boolean; createdAt: Date; updatedAt: Date };

function groupByLetter(contacts: ContactItem[]) {
  const groups: Record<string, ContactItem[]> = {};
  contacts.forEach((c) => {
    const letter = c.name[0]?.toUpperCase() ?? "#";
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

export default function ContactsTab() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "favorites">("all");
  const [importing, setImporting] = useState(false);

  // FIX 17: Alphabetical index bar ref
  const sectionListRef = useRef<SectionList>(null);

  const { data: contactList = [], refetch } = trpc.contacts.list.useQuery();
  const createMutation = trpc.contacts.create.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.contacts.delete.useMutation({ onSuccess: () => refetch() });
  const toggleFavMutation = trpc.contacts.toggleFavorite.useMutation({ onSuccess: () => refetch() });
  const bulkImportMutation = trpc.contacts.bulkImport.useMutation({ onSuccess: () => refetch() });

  const filtered = contactList.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.number.includes(search);
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "favorites" && c.isFavorite);
    return matchSearch && matchFilter;
  });

  const favorites = contactList.filter((c) => c.isFavorite);
  const sections = groupByLetter(filtered);

  const handleAdd = () => {
    if (!newName.trim() || !newNumber.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      number: newNumber.trim(),
      avatarColor: randomAvatarColor(newName.trim()),
    });
    setShowAddModal(false);
    setNewName("");
    setNewNumber("");
  };

  const handleImportDeviceContacts = async () => {
    if ((Platform.OS as string) === "web") {
      Alert.alert("Not available", "Device contacts import is not available on web.");
      return;
    }
    setImporting(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Contacts Access Required",
          "RingMe needs access to your contacts to import them. Please allow contacts access in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        setImporting(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const toImport: { name: string; number: string; avatarColor: string }[] = [];
      for (const c of data) {
        const name = c.name ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        if (!name) continue;
        const phones = c.phoneNumbers ?? [];
        for (const phone of phones) {
          const number = phone.number?.replace(/[\s\-\(\)]/g, "") ?? "";
          if (number.length >= 7) {
            toImport.push({
              name,
              number,
              avatarColor: randomAvatarColor(name),
            });
            break; // Only take first phone number per contact
          }
        }
      }

      if (toImport.length === 0) {
        Alert.alert("No contacts found", "No contacts with phone numbers were found on your device.");
        setImporting(false);
        return;
      }

      const added = await bulkImportMutation.mutateAsync({ contacts: toImport.slice(0, 500) });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Import complete", `${added} new contacts imported from your device.`);
    } catch (err) {
      console.error("[Contacts] Import failed:", err);
      Alert.alert("Import failed", "Could not import contacts. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const renderContact = useCallback(({ item }: { item: typeof contactList[0] }) => {
    const color = item.avatarColor ?? "#FF6EC7";
    return (
      <Pressable
        style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.75 }]}
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id.toString(), number: item.number, name: item.name } } as never)}
        onLongPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(item.name, item.number, [
            {
              text: item.isFavorite ? "Remove Favorite" : "Add Favorite",
              onPress: () => toggleFavMutation.mutate({ id: item.id, isFavorite: !item.isFavorite }),
            },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => deleteMutation.mutate({ id: item.id }),
            },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
      >
        <View style={[styles.avatar, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={[styles.avatarText, { color }]}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactNumber}>{item.number}</Text>
        </View>
        {item.isFavorite && <Text style={styles.favStar}>★</Text>}
        <View style={styles.contactActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id.toString(), number: item.number, name: item.name } } as never)}
          >
            <Text style={styles.actionIcon}>💬</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.push({ pathname: "/call/active", params: { number: item.number, name: item.name } } as never)}
          >
            <Text style={styles.actionIcon}>📞</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }, [contactList]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.8 }]}
            onPress={handleImportDeviceContacts}
            disabled={importing}
          >
            <Text style={styles.importBtnText}>{importing ? "Importing..." : "⬇ Import"}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Text style={styles.clearSearch}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(["all", "favorites"] as const).map((f) => (
          <Pressable
            key={f}
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === f && styles.filterChipActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
              {f === "all" ? "All" : "★ Favorites"}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.countBadge}>{filtered.length}</Text>
      </View>

      {/* Favorites row */}
      {favorites.length > 0 && activeFilter === "all" && !search && (
        <View style={styles.favoritesSection}>
          <Text style={styles.favoritesTitle}>Favorites</Text>
          <FlatList
            horizontal
            data={favorites}
            keyExtractor={(item) => `fav-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesRow}
            renderItem={({ item }) => {
              const color = item.avatarColor ?? "#FF6EC7";
              return (
                <Pressable
                  style={({ pressed }) => [styles.favItem, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id.toString(), number: item.number, name: item.name } } as never)}
                >
                  <View style={[styles.favAvatar, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                    <Text style={[styles.favAvatarText, { color }]}>{getInitials(item.name)}</Text>
                  </View>
                  <Text style={styles.favName} numberOfLines={1}>{item.name.split(" ")[0]}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* Contact list */}
      {contactList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySub}>Add contacts manually or import from your device</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyImportBtn, pressed && { opacity: 0.85 }]}
            onPress={handleImportDeviceContacts}
          >
            <Text style={styles.emptyImportText}>⬇ Import Device Contacts</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <SectionList
            ref={sectionListRef}
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderContact}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            stickySectionHeadersEnabled
          />
          {/* FIX 17: Alphabetical index bar */}
          <View style={styles.indexBar}>
            {sections.map((sec, idx) => (
              <Pressable
                key={sec.title}
                style={({ pressed }) => [styles.indexBarItem, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  sectionListRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true });
                }}
              >
                <Text style={styles.indexBarText}>{sec.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Contact</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone number"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newNumber}
              onChangeText={setNewNumber}
              keyboardType="phone-pad"
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => { setShowAddModal(false); setNewName(""); setNewNumber(""); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  (!newName.trim() || !newNumber.trim()) && styles.modalSaveBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleAdd}
                disabled={!newName.trim() || !newNumber.trim()}
              >
                <Text style={styles.modalSaveText}>Save</Text>
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
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  importBtn: {
    backgroundColor: "#1a3a1f",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  importBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#0D0520", fontSize: 22, fontWeight: "700", lineHeight: 28 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0D35",
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#1a3a1f",
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15, paddingVertical: 10 },
  clearSearch: { color: "rgba(255,255,255,0.55)", fontSize: 16, padding: 4 },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  filterChip: {
    backgroundColor: "#1A0D35",
    borderWidth: 1,
    borderColor: "#1a3a1f",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: "rgba(255,110,199,0.13)", borderColor: "#FF6EC7" },
  filterChipText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#FF6EC7" },
  countBadge: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginLeft: "auto" },

  favoritesSection: { paddingLeft: 16, marginBottom: 8 },
  favoritesTitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  favoritesRow: { paddingRight: 16, gap: 12 },
  favItem: { alignItems: "center", gap: 4, width: 56 },
  favAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  favAvatarText: { fontSize: 18, fontWeight: "700" },
  favName: { color: "rgba(255,255,255,0.55)", fontSize: 11, textAlign: "center" },

  sectionHeader: {
    backgroundColor: "#0D0520",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  sectionHeaderText: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A0D35",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700" },
  contactInfo: { flex: 1 },
  contactName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  contactNumber: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 1 },
  favStar: { color: "#FFE94A", fontSize: 14, marginRight: 4 },
  contactActions: { flexDirection: "row", gap: 4 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1A0D35",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: { fontSize: 16 },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  emptySub: { color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "center" },
  emptyImportBtn: {
    backgroundColor: "rgba(255,110,199,0.13)",
    borderWidth: 1,
    borderColor: "#FF6EC7",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyImportText: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderTopWidth: 1,
    borderColor: "#1a3a1f",
  },
  modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  modalInput: {
    backgroundColor: "#0D0520",
    borderWidth: 1,
    borderColor: "#1a3a1f",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#1a3a1f",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  modalCancelText: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: "#FF6EC7",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  modalSaveBtnDisabled: { backgroundColor: "#1a3a1f" },
  modalSaveText: { color: "#0D0520", fontSize: 15, fontWeight: "800" },
  // FIX 17: Index bar styles
  indexBar: {
    width: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
    gap: 0,
  },
  indexBarItem: { paddingVertical: 1, paddingHorizontal: 4 },
  indexBarText: { color: "rgba(255,110,199,0.8)", fontSize: 10, fontWeight: "700" },
});
