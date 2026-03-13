import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { trpc } from "@/lib/trpc";

const C = {
  bg: "#0D0520",
  card: "#1A0D35",
  card2: "#22103F",
  pink: "#FF6EC7",
  pink2: "#FF3DAA",
  lav: "#C084FC",
  lemon: "#FFE94A",
  mint: "#4DFFB4",
  sky: "#5BC8FF",
  txt: "#FFFFFF",
  txt2: "rgba(255,255,255,0.55)",
  txt3: "rgba(255,255,255,0.25)",
  border: "rgba(255,255,255,0.08)",
};

const WEBHOOK_STEPS = [
  {
    num: "01",
    title: "Get Your API Base URL",
    desc: "Your app's public URL is needed for Twilio to send webhook callbacks. It should look like: https://your-app.manus.space",
    icon: "🌐",
    color: C.pink,
  },
  {
    num: "02",
    title: "Log into Twilio Console",
    desc: 'Go to console.twilio.com → Phone Numbers → Manage → Active Numbers → click your number.',
    icon: "📱",
    color: C.lav,
  },
  {
    num: "03",
    title: "Set SMS Webhook",
    desc: 'Under "Messaging", set the webhook URL to:\n{BASE_URL}/api/webhooks/sms\nMethod: HTTP POST',
    icon: "💬",
    color: C.sky,
  },
  {
    num: "04",
    title: "Set Voice Webhook",
    desc: 'Under "Voice & Fax", set the webhook URL to:\n{BASE_URL}/api/webhooks/voice\nMethod: HTTP POST',
    icon: "📞",
    color: C.mint,
  },
  {
    num: "05",
    title: "Set Status Callback",
    desc: 'Under "Voice & Fax" → "Call Status Changes", set:\n{BASE_URL}/api/webhooks/call-status\nMethod: HTTP POST',
    icon: "🔔",
    color: C.lemon,
  },
  {
    num: "06",
    title: "Save & Test",
    desc: "Click Save in Twilio. Then send a test SMS to your RingMe number — you should receive it in the app!",
    icon: "✅",
    color: C.mint,
  },
];

const ENV_VARS = [
  { key: "TWILIO_ACCOUNT_SID", desc: "Your Twilio Account SID (starts with AC...)", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  { key: "TWILIO_AUTH_TOKEN", desc: "Your Twilio Auth Token (found in Console Dashboard)", placeholder: "your_auth_token_here" },
  { key: "TWILIO_PHONE_NUMBER", desc: "Your Twilio phone number in E.164 format", placeholder: "+12125551234" },
  { key: "API_BASE_URL", desc: "Your app's public base URL (no trailing slash)", placeholder: "https://your-app.manus.space" },
];

export default function WebhookSetupScreen() {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  // FIX 19: Test webhook by calling system health endpoint
  const handleTestWebhook = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setTestStatus("ok");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setTestStatus("idle"), 3000);
      } else {
        setTestStatus("fail");
        setTimeout(() => setTestStatus("idle"), 3000);
      }
    } catch (err) {
      setTestStatus("fail");
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Webhook Setup</Text>
          <Text style={styles.headerSub}>Connect Twilio to RingMe</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>🔗</Text>
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>Twilio Integration</Text>
            <Text style={styles.infoBannerDesc}>
              Follow these steps to enable real SMS and voice calls through your Twilio account.
            </Text>
          </View>
        </View>

        {/* Environment Variables */}
        <Text style={styles.sectionLabel}>Required Environment Variables</Text>
        <View style={styles.envCard}>
          {ENV_VARS.map((v) => (
            <View key={v.key} style={styles.envRow}>
              <View style={styles.envInfo}>
                <Text style={styles.envKey}>{v.key}</Text>
                <Text style={styles.envDesc}>{v.desc}</Text>
                <Text style={styles.envPlaceholder}>{v.placeholder}</Text>
              </View>
              <Pressable
                style={styles.copyBtn}
                onPress={() => copyToClipboard(v.key, v.key)}
              >
                <Text style={styles.copyBtnText}>{copiedKey === v.key ? "✓" : "Copy"}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Steps */}
        <Text style={styles.sectionLabel}>Setup Steps</Text>
        {WEBHOOK_STEPS.map((step) => (
          <View key={step.num} style={styles.stepCard}>
            <View style={[styles.stepNumBadge, { backgroundColor: step.color + "22", borderColor: step.color + "44" }]}>
              <Text style={[styles.stepNum, { color: step.color }]}>{step.num}</Text>
            </View>
            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* Quick reference */}
        <Text style={styles.sectionLabel}>Webhook URL Reference</Text>
        <View style={styles.urlCard}>
          {[
            { label: "SMS Inbound", path: "/api/webhooks/sms", icon: "💬" },
            { label: "Voice Inbound", path: "/api/webhooks/voice", icon: "📞" },
            { label: "Call Status", path: "/api/webhooks/call-status", icon: "📊" },
            { label: "Recording", path: "/api/webhooks/recording", icon: "🎙️" },
          ].map((url) => (
            <Pressable
              key={url.path}
              style={styles.urlRow}
              onPress={() => copyToClipboard(url.path, url.path)}
            >
              <Text style={styles.urlIcon}>{url.icon}</Text>
              <View style={styles.urlInfo}>
                <Text style={styles.urlLabel}>{url.label}</Text>
                <Text style={styles.urlPath}>{url.path}</Text>
              </View>
              <Text style={styles.urlCopy}>{copiedKey === url.path ? "✓ Copied" : "Copy"}</Text>
            </Pressable>
          ))}
        </View>

        {/* FIX 19: Test Connection button */}
        <Text style={styles.sectionLabel}>Test Connection</Text>
        <View style={styles.testCard}>
          <Text style={styles.testDesc}>Verify your server is reachable before configuring Twilio webhooks.</Text>
          <Pressable
            style={({ pressed }) => [
              styles.testBtn,
              testStatus === "ok" && styles.testBtnOk,
              testStatus === "fail" && styles.testBtnFail,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleTestWebhook}
            disabled={testStatus === "testing"}
          >
            {testStatus === "testing" ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.testBtnText}>
                {testStatus === "ok" ? "✓ Server Reachable" : testStatus === "fail" ? "✗ Connection Failed" : "🔌 Test Connection"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Help link */}
        <View style={styles.helpCard}>
          <Text style={styles.helpIcon}>📖</Text>
          <View style={styles.helpText}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpDesc}>Visit console.twilio.com for full documentation on webhooks and phone number configuration.</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 20, color: C.pink },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: C.txt },
  headerSub: { fontSize: 12, color: C.txt2, marginTop: 2 },
  scroll: { flex: 1 },
  infoBanner: { margin: 16, backgroundColor: "rgba(255,110,199,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,110,199,0.2)", padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoBannerIcon: { fontSize: 28 },
  infoBannerText: { flex: 1 },
  infoBannerTitle: { fontSize: 15, fontWeight: "800", color: C.txt, marginBottom: 4 },
  infoBannerDesc: { fontSize: 13, color: C.txt2, lineHeight: 19 },
  sectionLabel: { fontSize: 12, fontWeight: "800", color: C.txt2, textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  envCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  envRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  envInfo: { flex: 1 },
  envKey: { fontSize: 13, fontWeight: "800", color: C.pink, fontFamily: "monospace", marginBottom: 2 },
  envDesc: { fontSize: 11, color: C.txt2, marginBottom: 2 },
  envPlaceholder: { fontSize: 10, color: C.txt3, fontFamily: "monospace" },
  copyBtn: { backgroundColor: "rgba(255,110,199,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,110,199,0.2)" },
  copyBtnText: { fontSize: 12, fontWeight: "700", color: C.pink },
  stepCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },
  stepNum: { fontSize: 12, fontWeight: "900" },
  stepContent: { flex: 1 },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  stepIcon: { fontSize: 16 },
  stepTitle: { fontSize: 14, fontWeight: "800", color: C.txt },
  stepDesc: { fontSize: 12, color: C.txt2, lineHeight: 18 },
  urlCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  urlRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  urlIcon: { fontSize: 18 },
  urlInfo: { flex: 1 },
  urlLabel: { fontSize: 13, fontWeight: "700", color: C.txt, marginBottom: 2 },
  urlPath: { fontSize: 11, color: C.pink, fontFamily: "monospace" },
  urlCopy: { fontSize: 12, fontWeight: "700", color: C.txt2 },
  helpCard: { margin: 16, backgroundColor: C.card2, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  helpIcon: { fontSize: 24 },
  helpText: { flex: 1 },
  helpTitle: { fontSize: 14, fontWeight: "800", color: C.txt, marginBottom: 4 },
  helpDesc: { fontSize: 12, color: C.txt2, lineHeight: 18 },
  testCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  testDesc: { fontSize: 13, color: C.txt2, lineHeight: 18 },
  testBtn: { backgroundColor: "rgba(255,110,199,0.15)", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,110,199,0.3)" },
  testBtnOk: { backgroundColor: "rgba(77,255,180,0.15)", borderColor: "rgba(77,255,180,0.4)" },
  testBtnFail: { backgroundColor: "rgba(255,122,92,0.15)", borderColor: "rgba(255,122,92,0.4)" },
  testBtnText: { fontSize: 14, fontWeight: "800", color: C.pink },
});
