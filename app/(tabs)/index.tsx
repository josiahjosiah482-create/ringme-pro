import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

type Conversation = {
  id: string;
  conversationId: number;
  name: string;
  number: string;
  lastMessage: string;
  time: string;
  unread: number;
  isBurner: boolean;
  avatarColor: string;
  isOnline: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#FF6EC7", "#5BC8FF", "#FFE94A", "#FF7A5C", "#C084FC", "#C084FC", "#FF7A5C"];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const FILTERS = ["All", "Unread", "Burners"];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── AI Summary Bottom Sheet ──────────────────────────────────────────────────

function SummarySheet({
  conversation,
  onClose,
  onOpen,
}: {
  conversation: Conversation | null;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const summarizeMutation = trpc.ai.summarizeConversation.useMutation({
    onSuccess: (data) => {
      setSummary(data.summary);
      setHasLoaded(true);
    },
    onError: () => {
      setSummary("Could not generate summary. Please try again.");
      setHasLoaded(true);
    },
  });

  // Trigger summary when conversation changes
  const handleVisible = useCallback(() => {
    if (!conversation) return;
    setSummary(null);
    setHasLoaded(false);
    summarizeMutation.mutate({
      conversationId: conversation.conversationId,
      contactName: conversation.name,
    });
  }, [conversation?.conversationId]);

  if (!conversation) return null;

  return (
    <Modal
      visible={!!conversation}
      transparent
      animationType="slide"
      onShow={handleVisible}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetAvatar, { backgroundColor: conversation.avatarColor + "22", borderColor: conversation.avatarColor }]}>
              <Text style={[styles.sheetAvatarText, { color: conversation.avatarColor }]}>
                {getInitials(conversation.name)}
              </Text>
            </View>
            <View style={styles.sheetHeaderInfo}>
              <Text style={styles.sheetName}>{conversation.name}</Text>
              <Text style={styles.sheetNumber}>{conversation.number}</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>✨ AI Conversation Summary</Text>
            {summarizeMutation.isPending ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color="#FF6EC7" />
                <Text style={styles.summaryLoadingText}>Analyzing conversation...</Text>
              </View>
            ) : (
              <Text style={styles.summaryText}>{summary ?? "No summary available."}</Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.sheetActions}>
            <Pressable
              style={({ pressed }) => [styles.sheetActionBtn, pressed && { opacity: 0.8 }]}
              onPress={onOpen}
            >
              <Text style={styles.sheetActionText}>💬 Open Chat</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetActionBtnSecondary, pressed && { opacity: 0.8 }]}
              onPress={onClose}
            >
              <Text style={styles.sheetActionTextSecondary}>Dismiss</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── FIX 6: Memoized Conversation Row ────────────────────────────────────────

const ConversationRow = React.memo(function ConversationRow({
  item,
  onPress,
  onLongPress,
}: {
  item: Conversation;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const initials = getInitials(item.name);
  return (
    <Pressable
      style={({ pressed }) => [styles.convoItem, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: item.avatarColor + "22", borderColor: item.avatarColor },
        ]}
      >
        <Text style={[styles.avatarText, { color: item.avatarColor }]}>{initials}</Text>
        {item.isOnline && <View style={styles.onlineDot} />}
        {item.isBurner && (
          <View style={styles.burnerBadge}>
            <Text style={styles.burnerBadgeText}>🔥</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.convoContent}>
        <View style={styles.convoTop}>
          <Text
            style={[styles.convoName, item.unread > 0 && styles.convoNameUnread]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.convoTime, item.unread > 0 && styles.convoTimeUnread]}
          >
            {item.time}
          </Text>
        </View>
        <View style={styles.convoBottom}>
          <Text
            style={[
              styles.convoPreview,
              item.unread > 0 && styles.convoPreviewUnread,
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MessagesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [summaryConversation, setSummaryConversation] = useState<Conversation | null>(null);

  // Fetch real conversations from DB, poll every 10s
  const { data: dbConversations, isLoading } = trpc.conversations.list.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );

  // Map DB conversations to local type
  const allConversations: Conversation[] = (dbConversations ?? []).map((c) => ({
    id: c.id.toString(),
    conversationId: c.id,
    name: c.contactName ?? c.contactNumber,
    number: c.contactNumber,
    lastMessage: c.lastMessage ?? "No messages yet",
    time: formatRelativeTime(c.lastMessageAt),
    unread: c.unreadCount,
    isBurner: c.isBurner,
    avatarColor: getAvatarColor(c.contactNumber),
    isOnline: false,
  }));

  const filtered = allConversations.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === "All" ||
      (activeFilter === "Unread" && c.unread > 0) ||
      (activeFilter === "Burners" && c.isBurner);
    return matchSearch && matchFilter;
  });

  const totalUnread = allConversations.reduce((sum, c) => sum + c.unread, 0);

  // Update app badge count when unread count changes
  useEffect(() => {
    if (Platform.OS !== "web") {
      Notifications.setBadgeCountAsync(totalUnread).catch(() => {});
    }
  }, [totalUnread]);

  const handleLongPress = useCallback((item: Conversation) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSummaryConversation(item);
  }, []);

  const handleOpenChat = useCallback(() => {
    if (!summaryConversation) return;
    setSummaryConversation(null);
    router.push({
      pathname: "/chat/[id]" as never,
      params: { id: summaryConversation.id, name: summaryConversation.name, number: summaryConversation.number },
    });
  }, [summaryConversation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages 💬</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSub}>{totalUnread} unread</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={({ pressed }) => [styles.groupBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/chat/group-new" as never)}
          >
            <Text style={styles.groupBtnText}>👥</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/chat/new" as never)}
          >
            <Text style={styles.newBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === f && styles.filterChipActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === f && styles.filterChipTextActive,
              ]}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Long-press hint */}
      {allConversations.length > 0 && (
        <Text style={styles.longPressHint}>Long-press any conversation for AI summary ✨</Text>
      )}

      {/* Conversation list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        removeClippedSubviews={true}
        windowSize={10}
        getItemLayout={(_data, index) => ({ length: 76, offset: 76 * index, index })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to start a conversation</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() =>
              router.push({
                pathname: "/chat/[id]" as never,
                params: { id: item.id, name: item.name, number: item.number },
              })
            }
            onLongPress={() => handleLongPress(item)}
          />
        )}
      />

      {/* AI Summary Bottom Sheet */}
      <SummarySheet
        conversation={summaryConversation}
        onClose={() => setSummaryConversation(null)}
        onOpen={handleOpenChat}
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6EC7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  newBtnText: { color: "#0D0520", fontSize: 24, fontWeight: "800", lineHeight: 28 },
  groupBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(192,132,252,0.15)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  groupBtnText: { fontSize: 18 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  clearIcon: { color: "rgba(255,255,255,0.55)", fontSize: 14, padding: 4 },
  filtersContainer: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1A0D35",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterChipActive: {
    backgroundColor: "rgba(255,110,199,0.13)",
    borderColor: "#FF6EC7",
  },
  filterChipText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#FF6EC7" },
  longPressHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    paddingBottom: 6,
    fontStyle: "italic",
  },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  convoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6EC7",
    borderWidth: 2,
    borderColor: "#0D0520",
  },
  burnerBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#0D0520",
    alignItems: "center",
    justifyContent: "center",
  },
  burnerBadgeText: { fontSize: 10 },
  convoContent: { flex: 1 },
  convoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convoName: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600", flex: 1 },
  convoNameUnread: { color: "#FFFFFF", fontWeight: "800" },
  convoTime: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  convoTimeUnread: { color: "#FF6EC7" },
  convoBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  convoPreview: { color: "rgba(255,255,255,0.4)", fontSize: 13, flex: 1 },
  convoPreviewUnread: { color: "rgba(255,255,255,0.55)" },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: { color: "#0D0520", fontSize: 11, fontWeight: "800" },

  // Summary bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatarText: { fontSize: 18, fontWeight: "700" },
  sheetHeaderInfo: { flex: 1 },
  sheetName: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  sheetNumber: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  summaryBox: {
    backgroundColor: "#0D0520",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 80,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FF6EC7",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryLoading: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryLoadingText: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  summaryText: { color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 21 },
  sheetActions: { gap: 10 },
  sheetActionBtn: {
    backgroundColor: "#FF6EC7",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetActionText: { fontSize: 15, fontWeight: "700", color: "#0D0520" },
  sheetActionBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetActionTextSecondary: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.55)" },
});
