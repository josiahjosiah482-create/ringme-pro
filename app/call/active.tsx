import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { useVoIPCall } from "@/hooks/use-voip-call";

const { width, height } = Dimensions.get("window");

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ActiveCallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { number, name } = useLocalSearchParams<{ number: string; name: string }>();
  const [callState, setCallState] = useState<"connecting" | "active" | "ended">("connecting");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recordingAnim = useRef(new Animated.Value(1)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMaxPlan = user?.subscriptionTier === "max";

  useEffect(() => {
    // Pulse animation for connecting state
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Connect after 2s
    const connectTimer = setTimeout(() => {
      setCallState("active");
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }, 2000);

    return () => {
      clearTimeout(connectTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      pulse.stop();
    };
  }, []);

  // Recording dot blink animation
  useEffect(() => {
    if (!isRecording) {
      recordingAnim.setValue(1);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(recordingAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(recordingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [isRecording]);

  const logCallMutation = trpc.calls.logCall.useMutation();
  const startRecordingMutation = trpc.calls.startRecording.useMutation();
  const stopRecordingMutation = trpc.calls.stopRecording.useMutation();
  const recordingSidRef = useRef<string | null>(null);

  // callSid is passed as a route param when the call is initiated via Twilio
  const { callSid } = useLocalSearchParams<{ number: string; name: string; callSid?: string }>();

  const handleEndCall = () => {
    setCallState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    // Stop recording if active
    if (isRecording && callSid && recordingSidRef.current) {
      stopRecordingMutation.mutate({
        callSid,
        recordingSid: recordingSidRef.current,
      });
    }
    // Log the call to the database
    logCallMutation.mutate({
      contactNumber: number ?? "",
      contactName: name !== number ? name : undefined,
      direction: "outbound",
      status: duration > 0 ? "completed" : "rejected",
      durationSeconds: duration,
      twilioCallSid: callSid ?? undefined,
    });
    setTimeout(() => router.back(), 1500);
  };

  const handleToggleRecording = async () => {
    if (!isMaxPlan) {
      Alert.alert(
        "Max Plan Required",
        "Call recording is available on the RingMe Max plan. Upgrade to unlock this feature.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/settings/upgrade" as never) },
        ]
      );
      return;
    }
    if (!callSid) {
      // No live Twilio call SID available (e.g. demo mode)
      setIsRecording((prev) => !prev);
      return;
    }
    if (!isRecording) {
      // Start recording
      try {
        const result = await startRecordingMutation.mutateAsync({ callSid });
        if (result.recordingSid) {
          recordingSidRef.current = result.recordingSid;
          setIsRecording(true);
        } else {
          Alert.alert("Recording Failed", "Could not start recording. Please try again.");
        }
      } catch (err) {
        Alert.alert("Recording Error", err instanceof Error ? err.message : "Unknown error");
      }
    } else {
      // Stop recording
      try {
        if (recordingSidRef.current) {
          await stopRecordingMutation.mutateAsync({
            callSid,
            recordingSid: recordingSidRef.current,
          });
        }
        recordingSidRef.current = null;
        setIsRecording(false);
      } catch (err) {
        Alert.alert("Recording Error", err instanceof Error ? err.message : "Unknown error");
      }
    }
  };

  const KEYPAD = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <View style={styles.bgGlow} />

      {/* Recording indicator banner */}
      {isRecording && (
        <View style={styles.recordingBanner}>
          <Animated.View style={[styles.recordingDot, { opacity: recordingAnim }]} />
          <Text style={styles.recordingBannerText}>Recording • {formatDuration(duration)}</Text>
        </View>
      )}

      {/* Status bar area */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>RingMe Pro</Text>
        <Text style={styles.topBarNumber}>{number ?? "Unknown"}</Text>
      </View>

      {/* Avatar area */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarOuter, { transform: [{ scale: callState === "connecting" ? pulseAnim : 1 }] }]}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarText}>{getInitials(name ?? "?")}</Text>
          </View>
        </Animated.View>
        <Text style={styles.callerName}>{name ?? "Unknown"}</Text>
        <Text style={styles.callerNumber}>{number ?? ""}</Text>
        <View style={styles.callStatusContainer}>
          {callState === "connecting" && (
            <Text style={styles.callStatusConnecting}>Connecting...</Text>
          )}
          {callState === "active" && (
            <Text style={styles.callStatusActive}>{formatDuration(duration)}</Text>
          )}
          {callState === "ended" && (
            <Text style={styles.callStatusEnded}>Call Ended</Text>
          )}
        </View>
      </View>

      {/* Keypad */}
      {showKeypad && (
        <View style={styles.keypadContainer}>
          <Text style={styles.keypadInput}>{keypadInput || "·"}</Text>
          {KEYPAD.map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((digit) => (
                <Pressable
                  key={digit}
                  style={({ pressed }) => [styles.keypadKey, pressed && { backgroundColor: "rgba(255,255,255,0.08)" }]}
                  onPress={() => setKeypadInput((prev) => prev + digit)}
                >
                  <Text style={styles.keypadDigit}>{digit}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Controls */}
      {!showKeypad && (
        <View style={styles.controls}>
          <View style={styles.controlsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                isMuted && styles.controlBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Text style={styles.controlIcon}>{isMuted ? "🔇" : "🎙️"}</Text>
              <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                isSpeaker && styles.controlBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Text style={styles.controlIcon}>{isSpeaker ? "🔊" : "📢"}</Text>
              <Text style={styles.controlLabel}>Speaker</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowKeypad(true)}
            >
              <Text style={styles.controlIcon}>⌨️</Text>
              <Text style={styles.controlLabel}>Keypad</Text>
            </Pressable>
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                isOnHold && styles.controlBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setIsOnHold(!isOnHold)}
            >
              <Text style={styles.controlIcon}>{isOnHold ? "▶️" : "⏸️"}</Text>
              <Text style={styles.controlLabel}>{isOnHold ? "Resume" : "Hold"}</Text>
            </Pressable>

            {/* Record button — Max plan */}
            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                isRecording && styles.controlBtnRecording,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleToggleRecording}
            >
              <Text style={styles.controlIcon}>{isRecording ? "⏹️" : "⏺️"}</Text>
              <Text style={[styles.controlLabel, isRecording && styles.controlLabelRecording]}>
                {isRecording ? "Stop Rec" : isMaxPlan ? "Record" : "Record 👑"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.controlIcon}>💬</Text>
              <Text style={styles.controlLabel}>Message</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* End call / Back from keypad */}
      <View style={styles.bottomArea}>
        {showKeypad && (
          <Pressable
            style={({ pressed }) => [styles.backFromKeypad, pressed && { opacity: 0.7 }]}
            onPress={() => setShowKeypad(false)}
          >
            <Text style={styles.backFromKeypadText}>← Back</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.endCallBtn, pressed && { opacity: 0.85 }]}
          onPress={handleEndCall}
        >
          <Text style={styles.endCallIcon}>📵</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0520",
    alignItems: "center",
  },
  bgGlow: {
    position: "absolute",
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: "rgba(255,110,199,0.08)",
    top: height * 0.1,
  },
  recordingBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,92,92,0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,92,92,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 52,
    paddingBottom: 8,
    gap: 8,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5C5C",
  },
  recordingBannerText: {
    color: "#FF5C5C",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topBar: {
    width: "100%",
    paddingTop: 56,
    paddingBottom: 12,
    alignItems: "center",
  },
  topBarText: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" },
  topBarNumber: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 },
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  avatarOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,110,199,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.2)",
  },
  avatarInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1A0D35",
    borderWidth: 2,
    borderColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FF6EC7", fontSize: 32, fontWeight: "700" },
  callerName: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 6 },
  callerNumber: { color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 12 },
  callStatusContainer: { height: 24, alignItems: "center", justifyContent: "center" },
  callStatusConnecting: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  callStatusActive: { color: "#FF6EC7", fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  callStatusEnded: { color: "#FF7A5C", fontSize: 16, fontWeight: "700" },
  keypadContainer: {
    width: "100%",
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  keypadInput: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 4,
  },
  keypadRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  keypadKey: {
    width: 72,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#1A0D35",
    alignItems: "center",
    justifyContent: "center",
  },
  keypadDigit: { color: "#FFFFFF", fontSize: 20, fontWeight: "600" },
  controls: {
    width: "100%",
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  controlBtn: {
    width: 80,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#1A0D35",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  controlBtnActive: {
    backgroundColor: "rgba(255,110,199,0.13)",
    borderColor: "#FF6EC7",
  },
  controlBtnRecording: {
    backgroundColor: "rgba(255,92,92,0.13)",
    borderColor: "#FF5C5C",
  },
  controlIcon: { fontSize: 24 },
  controlLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  controlLabelRecording: { color: "#FF5C5C" },
  bottomArea: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 48,
    gap: 16,
  },
  backFromKeypad: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backFromKeypadText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FF7A5C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF7A5C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  endCallIcon: { fontSize: 30 },
});
