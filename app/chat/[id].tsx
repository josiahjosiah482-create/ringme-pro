import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import { useSSEMessages } from "@/hooks/use-sse-messages";
import { useAuth } from "@/hooks/use-auth";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type LocalMessage = {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
  status: "sent" | "delivered" | "read";
  mediaUrl?: string;
};

// FIX 13: Swipe-to-reply component
function SwipeableMessage({ item, onReply, children }: { item: LocalMessage; onReply: () => void; children: React.ReactNode }) {
  const translateX = useSharedValue(0);
  const triggerReply = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReply();
  };
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      // Allow rightward swipe for received messages, leftward for sent
      if (item.isMe && e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -60);
      } else if (!item.isMe && e.translationX > 0) {
        translateX.value = Math.min(e.translationX, 60);
      }
    })
    .onEnd((e) => {
      const threshold = item.isMe ? -40 : 40;
      if ((item.isMe && e.translationX < threshold) || (!item.isMe && e.translationX > threshold)) {
        runOnJS(triggerReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
    });
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={animStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatThread() {
  const router = useRouter();
  const { id, name, number, groupName, members } = useLocalSearchParams<{
    id: string;
    name: string;
    number: string;
    groupName?: string;
    members?: string;
  }>();

  const conversationId = id ? parseInt(id, 10) : null;
  const isGroup = !!groupName;
  const contactName = groupName ?? name ?? "Unknown";
  const contactNumber = number ?? "";
  // For group threads, members is a comma-separated list of numbers
  const groupMembers = members ? members.split(",").filter(Boolean) : [];

  const [inputText, setInputText] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    "Sounds good!",
    "Got it!",
    "Thanks!",
    "I'll check.",
  ]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();

  // Fetch messages from DB
  const {
    data: dbMessages,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.messages.list.useQuery(
    { conversationId: conversationId ?? 0, limit: 50 },
    { enabled: !!conversationId, refetchInterval: sseConnected ? false : 8000 }
  );

  // SSE real-time updates
  useSSEMessages({
    conversationId: conversationId ?? 0,
    userId: user?.id ?? 0,
    enabled: !!conversationId && !!user,
    onConnected: () => setSseConnected(true),
    onDisconnected: () => setSseConnected(false),
    onNewMessage: (msg) => {
      const newMsg: LocalMessage = {
        id: `sse-${Date.now()}`,
        text: msg.text,
        isMe: msg.isMe,
        time: formatTime(msg.createdAt),
        status: "delivered",
      };
      setLocalMessages((prev) => {
        if (prev.some((m) => m.text === msg.text && Math.abs(new Date(msg.createdAt).getTime() - Date.now()) < 10000)) {
          return prev;
        }
        return [...prev, newMsg];
      });
      refetchMessages();
    },
  });

  const markReadMutation = trpc.conversations.markRead.useMutation();

  const sendMutation = trpc.messages.send.useMutation({
    onSuccess: () => { refetchMessages(); },
    onError: (error: any) => {
      const msg = error?.message ?? "";
      if (msg.includes("USAGE_LIMIT_REACHED")) {
        Alert.alert(
          "Monthly Limit Reached",
          "You've used all 100 free SMS this month. Upgrade to Pro for unlimited messaging.",
          [
            { text: "Later", style: "cancel" },
            { text: "Upgrade Now", onPress: () => router.push("/settings/upgrade" as never) },
          ]
        );
      } else {
        console.error("[Chat] Send failed:", error);
      }
    },
  });

  const sendGroupMutation = trpc.groups.sendGroupMessage.useMutation({
    onSuccess: () => { refetchMessages(); },
    onError: (error) => { console.error("[Chat] Group send failed:", error); },
  });

  const uploadMediaMutation = trpc.storage.uploadMedia.useMutation({
    onError: (err) => {
      Alert.alert("Upload Failed", err.message);
      setUploadingMedia(false);
    },
  });

  const smartRepliesMutation = trpc.ai.smartReplies.useMutation({
    onSuccess: (data) => {
      if (data.suggestions.length > 0) setAiSuggestions(data.suggestions);
    },
  });

  useEffect(() => {
    if (dbMessages && dbMessages.length > 0) {
      const converted: LocalMessage[] = dbMessages.map((m) => ({
        id: m.id.toString(),
        text: m.text,
        isMe: m.isMe,
        time: formatTime(m.createdAt),
        status: m.status as "sent" | "delivered" | "read",
        mediaUrl: (m as any).mediaUrl ?? undefined,
      }));
      setLocalMessages(converted);
      if (conversationId) markReadMutation.mutate({ conversationId });
      const history = dbMessages.slice(-10).map((m) => ({ text: m.text, isMe: m.isMe }));
      smartRepliesMutation.mutate({ conversationHistory: history, contactName });
    }
  }, [dbMessages]);

  useEffect(() => {
    if (localMessages.length > 0) {
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    }
  }, [localMessages.length]);

  const sendMessage = useCallback(
    async (text: string, mediaUrl?: string) => {
      if (!text.trim() && !mediaUrl) return;
      const trimmed = text.trim();
      setInputText("");
      setShowSuggestions(false);
      const optimisticMsg: LocalMessage = {
        id: `optimistic-${Date.now()}`,
        text: trimmed,
        isMe: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        mediaUrl,
      };
      setLocalMessages((prev) => [...prev, optimisticMsg]);
      if (conversationId) {
        try {
          if (isGroup && groupMembers.length > 0) {
            await sendGroupMutation.mutateAsync({
              conversationId,
              members: groupMembers,
              text: trimmed || (mediaUrl ? "📷 Photo" : ""),
            });
          } else if (contactNumber) {
            await sendMutation.mutateAsync({ conversationId, contactNumber, text: trimmed, mediaUrl });
          }
          setShowSuggestions(true);
        } catch (error) {
          console.error("[Chat] Failed to send:", error);
        }
      }
    },
    [conversationId, contactNumber, isGroup, groupMembers, sendMutation, sendGroupMutation]
  );

  const handleAttach = useCallback(() => {
    const options = ["📷 Camera", "🖼️ Photo Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: "Send Media" },
        (idx) => { if (idx === 0) pickMedia("camera"); else if (idx === 1) pickMedia("library"); }
      );
    } else {
      Alert.alert("Send Media", "Choose a source", [
        { text: "📷 Camera", onPress: () => pickMedia("camera") },
        { text: "🖼️ Photo Library", onPress: () => pickMedia("library") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, []);

  const pickMedia = useCallback(async (source: "camera" | "library") => {
    const permResult = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert("Permission Required", "Please allow access to continue.");
      return;
    }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert("Error", "Could not read image data."); return; }
    setUploadingMedia(true);
    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const uploadResult = await uploadMediaMutation.mutateAsync({
        base64: asset.base64,
        mimeType: `image/${ext}`,
        fileName: `mms-${Date.now()}.${ext}`,
      });
      await sendMessage("", uploadResult.url);
    } catch (err) {
      console.error("[Chat] Media upload failed:", err);
    } finally {
      setUploadingMedia(false);
    }
  }, [uploadMediaMutation, sendMessage]);

  const messages = localMessages;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getInitials(contactName)}</Text>
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.headerName}>{contactName}</Text>
              {isGroup && (
                <View style={{ backgroundColor: "rgba(255,110,199,0.15)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#FF6EC7", fontSize: 10, fontWeight: "800" }}>GROUP</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerStatus}>
              {isGroup ? `${groupMembers.length} members` : (contactNumber || "RingMe Number")}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: "/call/active" as never, params: { number: contactNumber, name: contactName } })}
          >
            <Text style={styles.headerActionIcon}>📞</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.headerActionIcon}>⋯</Text>
          </Pressable>
        </View>
      </View>

      {messagesLoading && localMessages.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FF6EC7" size="large" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      )}

      {!messagesLoading && messages.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Start the conversation</Text>
          <Text style={styles.emptySubtitle}>Send a message to {contactName}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item, index }) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showAvatar = !item.isMe && (!prevMsg || prevMsg.isMe);
          return (
            <SwipeableMessage
              item={item}
              onReply={() => setReplyTo({ id: item.id, text: item.text })}
            >
            <View style={[styles.messageRow, item.isMe && styles.messageRowMe]}>
              {!item.isMe && (
                <View style={[styles.msgAvatar, !showAvatar && styles.msgAvatarHidden]}>
                  {showAvatar && <Text style={styles.msgAvatarText}>{getInitials(contactName)}</Text>}
                </View>
              )}
              {item.isMe ? (
                <LinearGradient
                  colors={["#FF6EC7", "#C084FC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.bubbleMe]}
                >
                  {item.mediaUrl && (
                    <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
                  )}
                  {item.text ? <Text style={[styles.bubbleText, styles.bubbleTextMe]}>{item.text}</Text> : null}
                  <View style={styles.bubbleMeta}>
                    <Text style={[styles.bubbleTime, styles.bubbleTimeMe]}>{item.time}</Text>
                    <Text style={[
                      styles.statusIcon,
                      item.status === "read" && { color: "#FF6EC7" },
                    ]}>
                      {item.status === "read" ? "✓✓" : item.status === "delivered" ? "✓✓" : "✓"}
                    </Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.bubbleThem]}>
                  {item.mediaUrl && (
                    <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
                  )}
                  {item.text ? <Text style={styles.bubbleText}>{item.text}</Text> : null}
                  <View style={styles.bubbleMeta}>
                    <Text style={styles.bubbleTime}>{item.time}</Text>
                  </View>
                </View>
              )}
             </View>
            </SwipeableMessage>
          );
        }}
      />
      {/* AI Suggestions */}
      {showSuggestions && messages.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsLabel}>✨ AI Suggestions</Text>
            {smartRepliesMutation.isPending && <ActivityIndicator color="#FF6EC7" size="small" />}
          </View>
          <View style={styles.suggestionsList}>
            {aiSuggestions.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* FIX 13: Reply banner */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBannerBar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBannerLabel}>Replying to</Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>{replyTo.text}</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.replyBannerClose, pressed && { opacity: 0.6 }]} onPress={() => setReplyTo(null)}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      )}
      {/* Input */}
      <View style={styles.inputContainer}>
        <Pressable
          style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.7 }]}
          onPress={handleAttach}
        >
          {uploadingMedia ? (
            <ActivityIndicator color="#FF6EC7" size="small" />
          ) : (
            <Text style={styles.attachIcon}>📎</Text>
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        {sendMutation.isPending ? (
          <View style={styles.sendBtn}>
            <ActivityIndicator color="#0D0520" size="small" />
          </View>
        ) : inputText.trim() ? (
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}
            onPress={() => sendMessage(inputText)}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.micIcon}>🎙️</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#FF6EC7", fontSize: 22, fontWeight: "600" },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,110,199,0.13)",
    borderWidth: 1.5, borderColor: "#FF6EC7",
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarText: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },
  headerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  headerStatus: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A0D35",
    alignItems: "center", justifyContent: "center",
  },
  headerActionIcon: { fontSize: 16 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  emptySubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "center" },
  messagesList: { padding: 16, paddingBottom: 8 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4, gap: 8 },
  messageRowMe: { flexDirection: "row-reverse" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,110,199,0.13)",
    borderWidth: 1, borderColor: "#FF6EC7",
    alignItems: "center", justifyContent: "center",
  },
  msgAvatarHidden: { opacity: 0 },
  msgAvatarText: { color: "#FF6EC7", fontSize: 10, fontWeight: "700" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: {
    backgroundColor: "#1A0D35",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: "#FFFFFF" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  bubbleTime: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
  bubbleTimeMe: { color: "rgba(255,255,255,0.7)" },
  statusIcon: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  mediaImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
  suggestionsContainer: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  suggestionsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  suggestionsLabel: { color: "#FF6EC7", fontSize: 10, fontWeight: "700" },
  suggestionsList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestionChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: "#1A0D35",
    borderWidth: 1, borderColor: "rgba(255,110,199,0.2)",
  },
  suggestionText: { color: "#FF6EC7", fontSize: 13 },
  inputContainer: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
    gap: 8, backgroundColor: "#0D0520",
  },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A0D35",
    alignItems: "center", justifyContent: "center",
  },
  attachIcon: { fontSize: 16 },
  input: {
    flex: 1, minHeight: 36, maxHeight: 100,
    backgroundColor: "#1A0D35",
    borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14, paddingVertical: 8,
    color: "#FFFFFF", fontSize: 15,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FF6EC7",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#FF6EC7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  sendIcon: { color: "#0D0520", fontSize: 18, fontWeight: "800" },
  micBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1A0D35",
    alignItems: "center", justifyContent: "center",
  },
  micIcon: { fontSize: 16 },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(255,110,199,0.1)", borderTopWidth: 1, borderTopColor: "rgba(255,110,199,0.2)" },
  replyBannerBar: { width: 3, height: 32, backgroundColor: "#FF6EC7", borderRadius: 2 },
  replyBannerLabel: { color: "#FF6EC7", fontSize: 11, fontWeight: "700", marginBottom: 1 },
  replyBannerText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  replyBannerClose: { padding: 4 },
});
