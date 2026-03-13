import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { trpc } from "@/lib/trpc";

const C = {
  bg: "#0D0520",
  card: "#1A0D35",
  card2: "#22103F",
  pink: "#FF6EC7",
  lav: "#C084FC",
  mint: "#4DFFB4",
  txt: "#FFFFFF",
  txt2: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

const DEFAULT_GREETINGS = [
  {
    id: "default",
    label: "Default",
    desc: "Hi, you've reached RingMe. Please leave a message.",
    emoji: "📱",
  },
  {
    id: "professional",
    label: "Professional",
    desc: "Thank you for calling. I'm unavailable right now. Please leave your name, number, and a brief message.",
    emoji: "💼",
  },
  {
    id: "casual",
    label: "Casual",
    desc: "Hey! Can't pick up right now. Leave me a message and I'll get back to you!",
    emoji: "😊",
  },
  {
    id: "away",
    label: "Out of Office",
    desc: "I'm currently out of office and will return on Monday. For urgent matters, please contact my assistant.",
    emoji: "✈️",
  },
];

export default function VoicemailGreetingScreen() {
  const router = useRouter();
  const [selectedGreeting, setSelectedGreeting] = useState("default");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [customRecordingUri, setCustomRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saved, setSaved] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: settings, isLoading } = trpc.userSettings.get.useQuery();
  const updateMutation = trpc.userSettings.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
    };
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission Required", "Microphone access is needed to record a greeting.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= 30) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setCustomRecordingUri(uri ?? null);
      recordingRef.current = null;
      setSelectedGreeting("custom");
    } catch (err) {
      Alert.alert("Error", "Could not save recording.");
    }
  };

  const playRecording = async () => {
    if (!customRecordingUri) return;
    if (isPlaying) {
      await soundRef.current?.stopAsync();
      setIsPlaying(false);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: customRecordingUri });
      soundRef.current = sound;
      setIsPlaying(true);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: import("expo-av").AVPlaybackStatus) => {
        if ('isLoaded' in status && status.isLoaded && status.didJustFinish) setIsPlaying(false);
      });
    } catch (err) {
      Alert.alert("Error", "Could not play recording.");
    }
  };

  const handleSave = () => {
    // In production, upload the recording to S3 and save the URL
    // For demo, we just save the selected preset
    updateMutation.mutate({
      voicemailGreetingUrl: selectedGreeting === "custom" && customRecordingUri
        ? customRecordingUri
        : `preset:${selectedGreeting}`,
    });
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
        <Text style={styles.headerTitle}>Voicemail Greeting</Text>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#0D0520" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{saved ? "✓ Saved" : "Save"}</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.pink} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Record Custom */}
          <View style={styles.recordCard}>
            <Text style={styles.recordTitle}>🎙️ Record Custom Greeting</Text>
            <Text style={styles.recordSubtitle}>
              Record your own personal voicemail greeting (max 30 seconds)
            </Text>
            <View style={styles.recordControls}>
              {!isRecording && !customRecordingUri && (
                <Pressable
                  style={({ pressed }) => [styles.recordBtn, pressed && { opacity: 0.8 }]}
                  onPress={startRecording}
                >
                  <Text style={styles.recordBtnIcon}>🎙️</Text>
                  <Text style={styles.recordBtnText}>Start Recording</Text>
                </Pressable>
              )}
              {isRecording && (
                <View style={styles.recordingActive}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTimer}>
                    Recording... {recordingDuration}s / 30s
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.8 }]}
                    onPress={stopRecording}
                  >
                    <Text style={styles.stopBtnText}>⏹ Stop</Text>
                  </Pressable>
                </View>
              )}
              {customRecordingUri && !isRecording && (
                <View style={styles.recordingDone}>
                  <View style={styles.recordingDoneInfo}>
                    <Text style={styles.recordingDoneText}>✓ Custom greeting recorded</Text>
                    <Text style={styles.recordingDoneTime}>{recordingDuration}s</Text>
                  </View>
                  <View style={styles.recordingDoneActions}>
                    <Pressable
                      style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.7 }]}
                      onPress={playRecording}
                    >
                      <Text style={styles.playBtnText}>{isPlaying ? "⏸" : "▶"}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.reRecordBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => { setCustomRecordingUri(null); setRecordingDuration(0); }}
                    >
                      <Text style={styles.reRecordBtnText}>Re-record</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Preset Greetings */}
          <Text style={styles.sectionTitle}>Preset Greetings</Text>
          {DEFAULT_GREETINGS.map((g) => (
            <Pressable
              key={g.id}
              style={({ pressed }) => [
                styles.greetingCard,
                selectedGreeting === g.id && styles.greetingCardActive,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedGreeting(g.id)}
            >
              <View style={styles.greetingLeft}>
                <Text style={styles.greetingEmoji}>{g.emoji}</Text>
                <View style={styles.greetingInfo}>
                  <Text style={styles.greetingLabel}>{g.label}</Text>
                  <Text style={styles.greetingDesc}>{g.desc}</Text>
                </View>
              </View>
              <View style={[
                styles.radioBtn,
                selectedGreeting === g.id && styles.radioBtnActive,
              ]}>
                {selectedGreeting === g.id && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}

          {customRecordingUri && (
            <Pressable
              style={({ pressed }) => [
                styles.greetingCard,
                selectedGreeting === "custom" && styles.greetingCardActive,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedGreeting("custom")}
            >
              <View style={styles.greetingLeft}>
                <Text style={styles.greetingEmoji}>🎙️</Text>
                <View style={styles.greetingInfo}>
                  <Text style={styles.greetingLabel}>My Custom Greeting</Text>
                  <Text style={styles.greetingDesc}>Your personal recorded greeting ({recordingDuration}s)</Text>
                </View>
              </View>
              <View style={[
                styles.radioBtn,
                selectedGreeting === "custom" && styles.radioBtnActive,
              ]}>
                {selectedGreeting === "custom" && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          )}
        </ScrollView>
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
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.pink,
    minWidth: 64,
    alignItems: "center",
  },
  saveBtnText: { color: "#0D0520", fontSize: 14, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  recordCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  recordTitle: { color: C.txt, fontSize: 16, fontWeight: "700" },
  recordSubtitle: { color: C.txt2, fontSize: 13, lineHeight: 18 },
  recordControls: { gap: 10 },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,110,199,0.12)",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.3)",
  },
  recordBtnIcon: { fontSize: 18 },
  recordBtnText: { color: C.pink, fontSize: 15, fontWeight: "700" },
  recordingActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,92,92,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,92,92,0.2)",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF5C5C",
  },
  recordingTimer: { flex: 1, color: C.txt, fontSize: 14, fontWeight: "600" },
  stopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#FF5C5C",
  },
  stopBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  recordingDone: {
    backgroundColor: "rgba(77,255,180,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(77,255,180,0.2)",
    gap: 10,
  },
  recordingDoneInfo: { flexDirection: "row", justifyContent: "space-between" },
  recordingDoneText: { color: C.mint, fontSize: 14, fontWeight: "600" },
  recordingDoneTime: { color: C.txt2, fontSize: 13 },
  recordingDoneActions: { flexDirection: "row", gap: 10 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(77,255,180,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(77,255,180,0.3)",
  },
  playBtnText: { color: C.mint, fontSize: 16 },
  reRecordBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
  },
  reRecordBtnText: { color: C.txt2, fontSize: 13 },
  sectionTitle: { color: C.txt, fontSize: 15, fontWeight: "700", marginTop: 4 },
  greetingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  greetingCardActive: {
    backgroundColor: "rgba(255,110,199,0.06)",
    borderColor: "rgba(255,110,199,0.3)",
  },
  greetingLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greetingEmoji: { fontSize: 22, marginTop: 2 },
  greetingInfo: { flex: 1 },
  greetingLabel: { color: C.txt, fontSize: 14, fontWeight: "700" },
  greetingDesc: { color: C.txt2, fontSize: 12, marginTop: 3, lineHeight: 17 },
  radioBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.txt2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioBtnActive: { borderColor: C.pink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.pink },
});
