import { useState, useCallback, useRef, useEffect } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

/// ─── Types ──────────────────────────────────────────────────────────────────

type CallLog = {
  id: string;
  name: string;
  number: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "rejected";
  duration: string;
  time: string;
  avatarColor: string;
  spamScore?: number;
};

type VoicemailItem = {
  id: number;
  callerNumber: string;
  callerName: string | null;
  recordingUrl: string | null;
  durationSeconds: number;
  transcript: string | null;
  isListened: boolean;
  createdAt: Date | string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DIALPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const DIALPAD_LABELS: Record<string, string> = {
  "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO",
  "7": "PQRS", "8": "TUV", "9": "WXYZ",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

const AVATAR_COLORS = ["#FF6EC7", "#5BC8FF", "#FFE94A", "#FF7A5C", "#C084FC", "#C084FC"];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── VoicemailCard with audio player ─────────────────────────────────────────

function VoicemailCard({
  item,
  isExpanded,
  onToggle,
  onCallBack,
  onMarkListened,
  onDelete,
}: {
  item: VoicemailItem;
  isExpanded: boolean;
  onToggle: () => void;
  onCallBack: () => void;
  onMarkListened: () => void;
  onDelete: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0); // 0-100
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const totalDuration = item.durationSeconds > 0 ? item.durationSeconds : 30;

  // Only create player if there's a real URL
  const player = useAudioPlayer(item.recordingUrl ? { uri: item.recordingUrl } : null);

  // Enable silent mode playback on iOS
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      try { player.pause(); } catch {}
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!item.recordingUrl) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      if (progressRef.current) clearInterval(progressRef.current);
    } else {
      player.play();
      setIsPlaying(true);
      startTimeRef.current = Date.now() - (playProgress / 100) * totalDuration * 1000;
      progressRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const pct = Math.min(100, (elapsed / totalDuration) * 100);
        setPlayProgress(pct);
        if (pct >= 100) {
          setIsPlaying(false);
          setPlayProgress(0);
          if (progressRef.current) clearInterval(progressRef.current);
          onMarkListened();
        }
      }, 200);
    }
  }, [isPlaying, item.recordingUrl, playProgress, totalDuration]);

  const avatarColor = getAvatarColor(item.callerNumber);
  const displayName = item.callerName ?? item.callerNumber;

  return (
    <Pressable
      style={({ pressed }) => [styles.voicemailCard, pressed && { opacity: 0.9 }]}
      onPress={onToggle}
    >
      {/* Top row */}
      <View style={styles.voicemailTop}>
        <View style={[styles.vmAvatar, { backgroundColor: avatarColor + "22", borderColor: avatarColor }]}>
          <Text style={[styles.vmAvatarText, { color: avatarColor }]}>
            {getInitials(displayName)}
          </Text>
        </View>
        <View style={styles.vmInfo}>
          <View style={styles.vmRow}>
            <Text style={[styles.vmName, !item.isListened && styles.vmNameUnread]} numberOfLines={1}>
              {displayName}
            </Text>
            {!item.isListened && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.vmMeta}>
            {item.callerNumber} · {formatDuration(item.durationSeconds)} · {formatRelativeTime(item.createdAt)}
          </Text>
        </View>

        {/* Play/Pause button */}
        <Pressable
          style={({ pressed }) => [styles.playBtn, isPlaying && styles.playBtnActive, pressed && { opacity: 0.7 }]}
          onPress={(e) => { e.stopPropagation?.(); handlePlayPause(); }}
        >
          {isPlaying ? (
            <Text style={styles.playBtnIcon}>⏸</Text>
          ) : (
            <Text style={styles.playBtnIcon}>{item.recordingUrl ? "▶" : "🎙"}</Text>
          )}
        </Pressable>
      </View>

      {/* Progress bar */}
      {(isPlaying || playProgress > 0) && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${playProgress}%` as `${number}%` }]} />
        </View>
      )}

      {/* Expanded: transcript + actions */}
      {isExpanded && (
        <View style={styles.vmTranscript}>
          {item.transcript ? (
            <>
              <Text style={styles.vmTranscriptLabel}>✨ AI Transcript</Text>
              <Text style={styles.vmTranscriptText}>{item.transcript}</Text>
            </>
          ) : (
            <Text style={styles.vmTranscriptText}>No transcript available yet.</Text>
          )}
          <View style={styles.vmActions}>
            <Pressable
              style={({ pressed }) => [styles.vmActionBtn, pressed && { opacity: 0.7 }]}
              onPress={onCallBack}
            >
              <Text style={styles.vmActionText}>📞 Call Back</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.vmDeleteBtn, pressed && { opacity: 0.7 }]}
              onPress={onMarkListened}
            >
              <Text style={styles.vmDeleteText}>✓ Mark Heard</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.vmDeleteBtn, { borderColor: "#FF7A5C" }, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Alert.alert("Delete Voicemail", "This will permanently delete this voicemail.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: onDelete },
                ]);
              }}
            >
              <Text style={[styles.vmDeleteText, { color: "#FF7A5C" }]}>🗑 Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CallsTab() {
  const router = useRouter();
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"recent" | "missed" | "voicemail">("recent");
  const [expandedVoicemail, setExpandedVoicemail] = useState<number | null>(null);

  // Fetch real call logs from DB, poll every 15s
  const { data: dbCallLogs } = trpc.calls.list.useQuery(
    { limit: 50 },
    { refetchInterval: 15000 }
  );

  // Fetch real voicemails from DB, poll every 20s
  const { data: dbVoicemails, refetch: refetchVoicemails } = trpc.voicemails.list.useQuery(
    { limit: 30 },
    { refetchInterval: 20000 }
  );

  const markListenedMutation = trpc.voicemails.markListened.useMutation({
    onSuccess: () => refetchVoicemails(),
  });

  // FIX 12: Delete voicemail mutation
  const deleteVoicemailMutation = trpc.voicemails.delete.useMutation({
    onSuccess: () => refetchVoicemails(),
  });

  const reportSpamMutation = trpc.spam.report.useMutation({
    onSuccess: () => Alert.alert("Reported", "This number has been reported as spam. Thank you!"),
  });

  const blockNumberMutation = trpc.blockedNumbers.add.useMutation({
    onSuccess: () => Alert.alert("Blocked", "This number has been blocked."),
  });

  const handleCallLongPress = (item: CallLog) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const options = [
      "Report as Spam",
      "Block Number",
      "Cancel",
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (idx) => {
          if (idx === 0) reportSpamMutation.mutate({ number: item.number });
          if (idx === 1) blockNumberMutation.mutate({ number: item.number, label: item.name });
        }
      );
    } else {
      Alert.alert(
        item.name,
        item.number,
        [
          { text: "Report as Spam", onPress: () => reportSpamMutation.mutate({ number: item.number }) },
          { text: "Block Number", style: "destructive", onPress: () => blockNumberMutation.mutate({ number: item.number, label: item.name }) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  const allCalls = (dbCallLogs ?? []).map((c) => ({
    id: c.id.toString(),
    name: c.contactName ?? c.contactNumber,
    number: c.contactNumber,
    direction: c.direction as "inbound" | "outbound",
    status: c.status as "completed" | "missed" | "rejected",
    duration: formatDuration(c.durationSeconds),
    time: formatRelativeTime(c.createdAt),
    avatarColor: getAvatarColor(c.contactNumber),
    spamScore: (c as { spamScore?: number }).spamScore ?? 0,
  }));

  const filteredCalls =
    activeTab === "missed"
      ? allCalls.filter((c) => c.status === "missed")
      : allCalls;

  const voicemails: VoicemailItem[] = (dbVoicemails ?? []).map((v) => ({
    id: v.id,
    callerNumber: v.callerNumber,
    callerName: v.callerName ?? null,
    recordingUrl: v.recordingUrl ?? null,
    durationSeconds: v.durationSeconds,
    transcript: v.transcript ?? null,
    isListened: v.isListened,
    createdAt: v.createdAt,
  }));

  const unlistenedCount = voicemails.filter((v) => !v.isListened).length;

  const handleDial = (digit: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDialNumber((prev) => prev + digit);
  };

  const handleCall = () => {
    if (dialNumber) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/call/active" as never,
        params: { number: dialNumber, name: dialNumber },
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Calls 📞</Text>
          {unlistenedCount > 0 && (
            <Text style={styles.headerSub}>{unlistenedCount} new voicemail{unlistenedCount !== 1 ? "s" : ""}</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.dialpadToggle, pressed && { opacity: 0.7 }, showDialpad && styles.dialpadToggleActive]}
          onPress={() => setShowDialpad(!showDialpad)}
        >
          <Text style={styles.dialpadToggleText}>{showDialpad ? "✕" : "⌨️"}</Text>
        </Pressable>
      </View>

      {/* Dialpad */}
      {showDialpad && (
        <View style={styles.dialpadContainer}>
          <View style={styles.dialDisplay}>
            <Text style={styles.dialNumber}>{dialNumber || "Enter number"}</Text>
            {dialNumber.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.backspaceBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setDialNumber((prev) => prev.slice(0, -1))}
              >
                <Text style={styles.backspaceIcon}>⌫</Text>
              </Pressable>
            )}
          </View>
          {DIALPAD.map((row, ri) => (
            <View key={ri} style={styles.dialRow}>
              {row.map((digit) => (
                <Pressable
                  key={digit}
                  style={({ pressed }) => [styles.dialKey, pressed && { backgroundColor: "rgba(255,255,255,0.08)" }]}
                  onPress={() => handleDial(digit)}
                >
                  <Text style={styles.dialKeyDigit}>{digit}</Text>
                  {DIALPAD_LABELS[digit] && (
                    <Text style={styles.dialKeyLabel}>{DIALPAD_LABELS[digit]}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.85 }, !dialNumber && styles.callBtnDisabled]}
            onPress={handleCall}
            disabled={!dialNumber}
          >
            <Text style={styles.callBtnIcon}>📞</Text>
          </Pressable>
        </View>
      )}

      {/* Tab toggle */}
      <View style={styles.tabToggle}>
        {(["recent", "missed", "voicemail"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [
              styles.tabBtn,
              activeTab === tab && styles.tabBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <View style={styles.tabBtnInner}>
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === "recent" ? "Recent" : tab === "missed" ? "Missed" : "Voicemail"}
              </Text>
              {tab === "voicemail" && unlistenedCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{unlistenedCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === "voicemail" ? (
        <FlatList
          data={voicemails}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎙️</Text>
              <Text style={styles.emptyTitle}>No voicemails</Text>
              <Text style={styles.emptySubtitle}>Voicemails from your RingMe number appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <VoicemailCard
              item={item}
              isExpanded={expandedVoicemail === item.id}
              onToggle={() => setExpandedVoicemail(expandedVoicemail === item.id ? null : item.id)}
              onCallBack={() => router.push({
                pathname: "/call/active" as never,
                params: { number: item.callerNumber, name: item.callerName ?? item.callerNumber },
              })}
              onMarkListened={() => markListenedMutation.mutate({ id: item.id })}
              onDelete={() => deleteVoicemailMutation.mutate({ id: item.id })}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📞</Text>
              <Text style={styles.emptyTitle}>No calls yet</Text>
              <Text style={styles.emptySubtitle}>Your call history will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMissed = item.status === "missed";
            const isSpam = (item.spamScore ?? 0) >= 3;
            const dirIcon = item.direction === "inbound" ? "↙" : "↗";
            return (
              <Pressable
                style={({ pressed }) => [styles.callRow, pressed && { opacity: 0.85 }]}
                onLongPress={() => handleCallLongPress(item)}
                delayLongPress={400}
              >
                <View style={[styles.callAvatar, { backgroundColor: item.avatarColor + "22", borderColor: item.avatarColor }]}>
                  <Text style={[styles.callAvatarText, { color: item.avatarColor }]}>
                    {getInitials(item.name)}
                  </Text>
                </View>
                <View style={styles.callInfo}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.callName, isMissed && styles.callNameMissed]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isSpam && (
                      <View style={styles.spamBadge}>
                        <Text style={styles.spamBadgeText}>SPAM</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.callMeta}>
                    <Text style={[styles.dirIcon, isMissed && { color: "#FF7A5C" }]}>{dirIcon} </Text>
                    {item.number} · {item.time}
                  </Text>
                </View>
                <View style={styles.callRight}>
                  {item.duration !== "0:00" && (
                    <Text style={styles.callDuration}>{item.duration}</Text>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.callbackBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push({
                      pathname: "/call/active" as never,
                      params: { number: item.number, name: item.name },
                    })}
                  >
                    <Text style={styles.callbackIcon}>📞</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  headerSub: { fontSize: 12, color: "#FF6EC7", marginTop: 2 },
  dialpadToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A0D35",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialpadToggleActive: { borderColor: "#FF6EC7", backgroundColor: "rgba(255,110,199,0.07)" },
  dialpadToggleText: { fontSize: 18 },
  dialpadContainer: {
    backgroundColor: "#1A0D35",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dialDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 40,
  },
  dialNumber: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", letterSpacing: 2 },
  backspaceBtn: { marginLeft: 12 },
  backspaceIcon: { color: "rgba(255,255,255,0.55)", fontSize: 22 },
  dialRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  dialKey: {
    width: 72,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0D0520",
    alignItems: "center",
    justifyContent: "center",
  },
  dialKeyDigit: { color: "#FFFFFF", fontSize: 22, fontWeight: "600" },
  dialKeyLabel: { color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: 1 },
  callBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
    shadowColor: "#FF6EC7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  callBtnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  callBtnIcon: { fontSize: 26 },
  tabToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabBtnActive: { backgroundColor: "rgba(255,110,199,0.13)" },
  tabBtnInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  tabBtnTextActive: { color: "#FF6EC7" },
  tabBadge: {
    backgroundColor: "#FF6EC7",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tabBadgeText: { color: "#0D0520", fontSize: 10, fontWeight: "800" },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyContainer: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: "rgba(255,255,255,0.55)", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptySubtitle: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  callAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  callAvatarText: { fontSize: 16, fontWeight: "700" },
  callInfo: { flex: 1 },
  callName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  callNameMissed: { color: "#FF7A5C" },
  callMeta: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  dirIcon: { color: "rgba(255,255,255,0.55)" },
  callRight: { alignItems: "flex-end", gap: 4 },
  callDuration: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  callbackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,110,199,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  callbackIcon: { fontSize: 18 },
  spamBadge: {
    backgroundColor: "rgba(255,92,92,0.18)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,92,92,0.4)",
  },
  spamBadgeText: {
    color: "#FF5C5C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },

  // Voicemail card
  voicemailCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  voicemailTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  vmAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vmAvatarText: { fontSize: 15, fontWeight: "700" },
  vmInfo: { flex: 1 },
  vmRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  vmName: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  vmNameUnread: { color: "#FFFFFF", fontWeight: "800" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF6EC7" },
  vmMeta: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,110,199,0.13)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF6EC744",
  },
  playBtnActive: { backgroundColor: "#FF6EC744", borderColor: "#FF6EC7" },
  playBtnIcon: { color: "#FF6EC7", fontSize: 16 },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: "#FF6EC7", borderRadius: 2 },
  vmTranscript: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  vmTranscriptLabel: { color: "#FF6EC7", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  vmTranscriptText: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  vmActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  vmActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,110,199,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  vmActionText: { color: "#FF6EC7", fontSize: 13, fontWeight: "600" },
  vmDeleteBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)22",
    alignItems: "center",
    justifyContent: "center",
  },
  vmDeleteText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
});
