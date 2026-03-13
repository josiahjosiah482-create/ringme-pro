import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type SearchResult = {
  messageId: number;
  conversationId: number;
  text: string;
  isMe: boolean;
  createdAt: string | Date;
  contactName: string;
  contactNumber: string;
};

const AVATAR_COLORS = ["#FF6EC7", "#5BC8FF", "#FFE94A", "#FF7A5C", "#C084FC"];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function highlightMatch(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return [text];

  const parts: React.ReactNode[] = [];
  if (idx > 0) parts.push(text.slice(0, idx));
  parts.push(
    <Text key="match" style={{ color: "#FF6EC7", fontWeight: "700" }}>
      {text.slice(idx, idx + query.length)}
    </Text>
  );
  if (idx + query.length < text.length) parts.push(text.slice(idx + query.length));
  return parts;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const { data: results, isLoading, isFetching } = trpc.messages.search.useQuery(
    { query: debouncedQuery, limit: 50 },
    { enabled: debouncedQuery.length >= 1 }
  );

  const handleResultPress = useCallback((item: SearchResult) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/chat/[id]" as never,
      params: {
        id: item.conversationId.toString(),
        name: item.contactName,
        number: item.contactNumber,
      },
    });
  }, [router]);

  const renderResult = useCallback(({ item }: { item: SearchResult }) => {
    const color = getAvatarColor(item.contactNumber);
    const initials = getInitials(item.contactName);
    return (
      <Pressable
        style={({ pressed }) => [styles.resultItem, pressed && { opacity: 0.7 }]}
        onPress={() => handleResultPress(item)}
      >
        <View style={[styles.avatar, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.avatarText, { color }]}>{initials}</Text>
        </View>
        <View style={styles.resultContent}>
          <View style={styles.resultTop}>
            <Text style={styles.resultName} numberOfLines={1}>{item.contactName}</Text>
            <Text style={styles.resultTime}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.resultText} numberOfLines={2}>
            {item.isMe && <Text style={styles.youLabel}>You: </Text>}
            {highlightMatch(item.text, debouncedQuery)}
          </Text>
        </View>
      </Pressable>
    );
  }, [debouncedQuery, handleResultPress]);

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
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search all messages..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setDebouncedQuery(""); }}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Loading */}
      {(isLoading || isFetching) && debouncedQuery.length > 0 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#FF6EC7" size="small" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      {debouncedQuery.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Search Messages</Text>
          <Text style={styles.emptySubtitle}>
            Find messages across all your conversations by keyword or phone number
          </Text>
        </View>
      ) : results && results.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>😔</Text>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(item) => `${item.conversationId}-${item.messageId}`}
          renderItem={renderResult}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={
            results && results.length > 0 ? (
              <Text style={styles.resultsCount}>
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#FF6EC7", fontSize: 22, fontWeight: "600" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.2)",
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  clearIcon: { color: "rgba(255,255,255,0.55)", fontSize: 14, padding: 4 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "center", lineHeight: 20 },
  resultsList: { paddingBottom: 40 },
  resultsCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "700" },
  resultContent: { flex: 1 },
  resultTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  resultName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", flex: 1 },
  resultTime: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  resultText: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  youLabel: { color: "#FF6EC7", fontWeight: "600" },
});
