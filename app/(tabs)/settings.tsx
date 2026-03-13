import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";

type SettingRow = {
  icon: string;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
  badge?: string;
};

function SettingsSection({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [
              styles.settingRow,
              i < rows.length - 1 && styles.settingRowBorder,
              pressed && !row.toggle && { opacity: 0.7 },
            ]}
            onPress={row.onPress}
            disabled={row.toggle}
          >
            <Text style={styles.settingIcon}>{row.icon}</Text>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, row.danger && styles.settingLabelDanger]}>
                {row.label}
              </Text>
              {row.value && <Text style={styles.settingValue}>{row.value}</Text>}
            </View>
            {row.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{row.badge}</Text>
              </View>
            )}
            {row.toggle ? (
              <Switch
                value={row.toggleValue}
                onValueChange={row.onToggle}
                trackColor={{ false: "rgba(255,255,255,0.08)", true: "#FF6EC744" }}
                thumbColor={row.toggleValue ? "#FF6EC7" : "rgba(255,255,255,0.4)"}
              />
            ) : (
              !row.danger && <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [callScreening, setCallScreening] = useState(true);
  const [aiReplies, setAiReplies] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  // FIX 10: DB health indicator
  const { data: healthData } = trpc.system.health.useQuery(
    { timestamp: Date.now() },
    { refetchInterval: 30000, retry: false }
  );
  const dbHealthy = healthData?.ok ?? null;

  const tierColors: Record<string, string> = {
    free: "rgba(255,255,255,0.55)",
    pro: "#FF6EC7",
    max: "#FFE94A",
  };
  const tierEmoji: Record<string, string> = {
    free: "🌱",
    pro: "⚡",
    max: "👑",
  };
  const tier = user?.subscriptionTier ?? "free";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings ⚙️</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.profileAvatar, { backgroundColor: (user?.avatarColor ?? "#FF6EC7") + "22", borderColor: user?.avatarColor ?? "#FF6EC7" }]}>
            <Text style={[styles.profileAvatarText, { color: user?.avatarColor ?? "#FF6EC7" }]}>
              {(user?.name ?? "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? "User"}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ""}</Text>
            <View style={styles.profileNumberRow}>
              <Text style={styles.profileNumber}>{user?.phoneNumber ?? "No number selected"}</Text>
            </View>
          </View>
          <View style={[styles.tierBadge, { backgroundColor: tierColors[tier] + "22", borderColor: tierColors[tier] + "44" }]}>
            <Text style={styles.tierEmoji}>{tierEmoji[tier]}</Text>
            <Text style={[styles.tierLabel, { color: tierColors[tier] }]}>{tier.toUpperCase()}</Text>
          </View>
        </View>

        {/* Subscription */}
        <Pressable
          style={({ pressed }) => [styles.upgradeCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/settings/upgrade" as never)}
        >
          <View style={styles.upgradeLeft}>
            <Text style={styles.upgradeTitle}>
              {tier === "free" ? "⚡ Upgrade to Pro" : tier === "pro" ? "👑 Upgrade to Max" : "👑 RingMe Max"}
            </Text>
            <Text style={styles.upgradeSub}>
              {tier === "free"
                ? "Unlimited calls, 3 burners, AI replies"
                : tier === "pro"
                ? "Unlimited burners, priority support"
                : "You're on the best plan!"}
            </Text>
          </View>
          <Text style={styles.upgradeArrow}>›</Text>
        </Pressable>

        {/* Sections */}
        <SettingsSection
          title="My Number"
          rows={[
            { icon: "📱", label: "Primary Number", value: user?.phoneNumber ?? "Not set" },
            { icon: "🔥", label: "Active Burners", value: "3 active", badge: "3" },
            { icon: "🌍", label: "Add International Number", onPress: () => {} },
          ]}
        />

        <SettingsSection
          title="Notifications"
          rows={[
            {
              icon: "🔔",
              label: "Push Notifications",
              toggle: true,
              toggleValue: notifications,
              onToggle: setNotifications,
            },
            {
              icon: "🛡️",
              label: "Call Screening",
              toggle: true,
              toggleValue: callScreening,
              onToggle: setCallScreening,
            },
            { icon: "🌙", label: "Do Not Disturb", value: "Schedule", onPress: () => router.push("/settings/dnd-schedule" as never) },
          ]}
        />

        <SettingsSection
          title="AI Features"
          rows={[
            {
              icon: "✨",
              label: "AI Smart Replies",
              toggle: true,
              toggleValue: aiReplies,
              onToggle: setAiReplies,
              badge: tier === "free" ? "PRO" : undefined,
            },
            { icon: "🎙️", label: "Voicemail Transcription", value: "Enabled", onPress: () => {} },
            { icon: "🎙", label: "Voicemail Greeting", value: "Customize", onPress: () => router.push("/settings/voicemail-greeting" as never) },
            { icon: "📊", label: "Conversation Summaries", value: "Enabled", onPress: () => {} },
          ]}
        />

        <SettingsSection
          title="Privacy & Security"
          rows={[
            {
              icon: "👁️",
              label: "Read Receipts",
              toggle: true,
              toggleValue: readReceipts,
              onToggle: setReadReceipts,
            },
            { icon: "🔒", label: "App Lock", value: "Off", onPress: () => {} },
            { icon: "🚫", label: "Blocked Numbers", value: "Manage", onPress: () => router.push("/settings/blocked-numbers" as never) },
            { icon: "📋", label: "Privacy Policy", onPress: () => {} },
          ]}
        />

        <SettingsSection
          title="Twilio Integration"
          rows={[
            {
              icon: "📡",
              label: "Webhook Setup Guide",
              value: "Configure SMS & Calls",
              onPress: () => router.push("/settings/webhook-setup" as never),
            },
            { icon: "📞", label: "Twilio Number", value: process.env.EXPO_PUBLIC_TWILIO_NUMBER ?? "Not configured" },
            { icon: "🔀", label: "Port My Number", value: "Transfer", onPress: () => router.push("/settings/port-number" as never) },
          ]}
        />

        {/* FIX 10: DB Health Indicator */}
        <View style={styles.healthRow}>
          <View style={[styles.healthDot, { backgroundColor: dbHealthy === null ? "#FFE94A" : dbHealthy ? "#4DFFB4" : "#FF7A5C" }]} />
          <Text style={styles.healthLabel}>
            Server: {dbHealthy === null ? "Checking..." : dbHealthy ? "Connected" : "Offline"}
          </Text>
        </View>
        {/* FIX 18: Export Data */}
        <SettingsSection
          title="Data & Privacy"
          rows={[
            { icon: "📤", label: "Export My Data", value: "Download", onPress: () => router.push("/settings/export-data" as never) },
            { icon: "🗑️", label: "Delete Account", danger: true, onPress: () => Alert.alert("Delete Account", "Contact support at support@ringme.pro to delete your account.") },
          ]}
        />
        <SettingsSection
          title="Support"
          rows={[
            { icon: "❓", label: "Help Center", onPress: () => {} },
            { icon: "⭐", label: "Rate RingMe Pro", onPress: () => {} },
            { icon: "📣", label: "Send Feedback", onPress: () => {} },
            { icon: "ℹ️", label: "App Version", value: "1.0.0" },
          ]}
        />

        <SettingsSection
          title="Account"
          rows={[
            {
              icon: "🚪",
              label: "Sign Out",
              danger: true,
              onPress: () => setShowSignOutModal(true),
            },
          ]}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sign out modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🚪</Text>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalSub}>You'll need to sign in again to access your numbers.</Text>
            <Pressable
              style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.85 }]}
              onPress={async () => {
                setShowSignOutModal(false);
                await signOut();
              }}
            >
              <Text style={styles.dangerBtnText}>Sign Out</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowSignOutModal(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Plan modal */}
      <Modal visible={showPlanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.planModal}>
            <Text style={styles.planTitle}>Choose Your Plan</Text>
            {[
              {
                tier: "free",
                name: "Free",
                price: "$0/mo",
                emoji: "🌱",
                features: ["1 phone number", "Unlimited texts", "100 mins/mo calling", "Basic voicemail"],
                color: "rgba(255,255,255,0.55)",
              },
              {
                tier: "pro",
                name: "Pro",
                price: "$4.99/mo",
                emoji: "⚡",
                features: ["1 phone number", "Unlimited calls", "3 burner numbers", "AI smart replies", "Voicemail transcription"],
                color: "#FF6EC7",
              },
              {
                tier: "max",
                name: "Max",
                price: "$9.99/mo",
                emoji: "👑",
                features: ["2 phone numbers", "Unlimited calls", "Unlimited burners", "Priority AI features", "24/7 support"],
                color: "#FFE94A",
              },
            ].map((plan) => (
              <View
                key={plan.tier}
                style={[
                  styles.planCard,
                  tier === plan.tier && { borderColor: plan.color, backgroundColor: plan.color + "11" },
                ]}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planEmoji}>{plan.emoji}</Text>
                  <View>
                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                  </View>
                  {tier === plan.tier && (
                    <View style={[styles.currentBadge, { backgroundColor: plan.color + "22" }]}>
                      <Text style={[styles.currentBadgeText, { color: plan.color }]}>Current</Text>
                    </View>
                  )}
                </View>
                <View style={styles.planFeatures}>
                  {plan.features.map((f) => (
                    <Text key={f} style={styles.planFeature}>✓ {f}</Text>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowPlanModal(false)}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#1A0D35",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 20, fontWeight: "700" },
  profileInfo: { flex: 1 },
  profileName: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  profileEmail: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  profileNumberRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  profileNumber: { color: "#FF6EC7", fontSize: 12, fontWeight: "600" },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  tierEmoji: { fontSize: 16, marginBottom: 2 },
  tierLabel: { fontSize: 10, fontWeight: "800" },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,110,199,0.07)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.2)",
  },
  upgradeLeft: { flex: 1 },
  upgradeTitle: { color: "#FF6EC7", fontSize: 15, fontWeight: "700" },
  upgradeSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  upgradeArrow: { color: "#FF6EC7", fontSize: 22 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  sectionCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  settingIcon: { fontSize: 18, width: 24, textAlign: "center" },
  settingContent: { flex: 1 },
  settingLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  settingLabelDanger: { color: "#FF7A5C" },
  settingValue: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,110,199,0.13)",
    marginRight: 4,
  },
  badgeText: { color: "#FF6EC7", fontSize: 10, fontWeight: "800" },
  chevron: { color: "rgba(255,255,255,0.4)", fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalEmoji: { fontSize: 48, marginBottom: 12 },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center", marginBottom: 24 },
  dangerBtn: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FF7A5C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dangerBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: { width: "100%", height: 48, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  planModal: {
    backgroundColor: "#1A0D35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: "90%",
  },
  planTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 16, textAlign: "center" },
  planCard: {
    backgroundColor: "#0D0520",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 10,
  },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  planEmoji: { fontSize: 24 },
  planName: { fontSize: 16, fontWeight: "800" },
  planPrice: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  currentBadge: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: "700" },
  planFeatures: { gap: 4 },
  planFeature: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
});
