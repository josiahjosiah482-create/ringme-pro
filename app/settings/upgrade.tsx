import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { trpc } from "@/lib/trpc";

// RevenueCat product identifiers — must match App Store / Play Store
const RC_PRODUCT_IDS: Record<string, string> = {
  pro: Platform.OS === "ios" ? "ringme_pro_monthly" : "ringme_pro_monthly",
  max: Platform.OS === "ios" ? "ringme_max_monthly" : "ringme_max_monthly",
};

/**
 * Attempt to purchase via RevenueCat SDK.
 * Falls back gracefully if the SDK is not installed.
 */
async function purchaseWithRevenueCat(productId: string): Promise<boolean> {
  try {
    // Dynamic import so the app doesn't crash if react-native-purchases is not installed
    const Purchases = (await import("react-native-purchases")).default;
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.product.identifier === productId
    );
    if (!pkg) {
      console.warn("[RevenueCat] Package not found:", productId);
      return false;
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const tier = productId.includes("max") ? "max" : "pro";
    const hasEntitlement =
      customerInfo.entitlements.active[tier] !== undefined;
    return hasEntitlement;
  } catch (err: unknown) {
    // USER_CANCELLED is not a real error
    const code = (err as { code?: string })?.code;
    if (code === "1" || code === "USER_CANCELLED") return false;
    console.error("[RevenueCat] Purchase error:", err);
    throw err;
  }
}

const C = {
  bg: "#0D0520",
  card: "#1A0D35",
  card2: "#22103F",
  pink: "#FF6EC7",
  lav: "#C084FC",
  mint: "#4DFFB4",
  sky: "#5BC8FF",
  lemon: "#FFE94A",
  txt: "#FFFFFF",
  txt2: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    tagline: "Get started",
    color: C.txt2,
    gradient: ["#1A0D35", "#22103F"] as [string, string],
    features: [
      { icon: "📞", text: "1 phone number" },
      { icon: "💬", text: "100 SMS/month" },
      { icon: "🔥", text: "1 burner number" },
      { icon: "🤖", text: "5 AI replies/day" },
      { icon: "❌", text: "No call recording" },
      { icon: "❌", text: "No group messaging" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4.99",
    period: "/month",
    tagline: "Most popular ✨",
    color: C.pink,
    gradient: ["#FF6EC7", "#C084FC"] as [string, string],
    features: [
      { icon: "📞", text: "3 phone numbers" },
      { icon: "💬", text: "Unlimited SMS" },
      { icon: "🔥", text: "5 burner numbers" },
      { icon: "🤖", text: "Unlimited AI replies" },
      { icon: "📷", text: "MMS photo messages" },
      { icon: "👥", text: "Group messaging (up to 5)" },
    ],
  },
  {
    id: "max",
    name: "Max",
    price: "$9.99",
    period: "/month",
    tagline: "Power user 🚀",
    color: C.lemon,
    gradient: ["#FFE94A", "#FF9F00"] as [string, string],
    features: [
      { icon: "📞", text: "Unlimited phone numbers" },
      { icon: "💬", text: "Unlimited SMS + MMS" },
      { icon: "🔥", text: "Unlimited burners" },
      { icon: "🎙️", text: "Call recording" },
      { icon: "👥", text: "Group messaging (up to 20)" },
      { icon: "🌍", text: "International numbers" },
    ],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [purchasing, setPurchasing] = useState(false);

  const { data: user, refetch: refetchUser } = trpc.auth.me.useQuery();
  const currentTier = user?.subscriptionTier ?? "free";
  const updateTierMutation = trpc.userSettings.updateTier.useMutation();

  const handlePurchase = async () => {
    if (selectedPlan === currentTier) {
      Alert.alert("Already Subscribed", `You're already on the ${selectedPlan.toUpperCase()} plan.`);
      return;
    }
    if (selectedPlan === "free") {
      Alert.alert(
        "Downgrade",
        "To cancel your subscription, please manage it through the App Store or Google Play settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("https://apps.apple.com/account/subscriptions");
              } else {
                Linking.openURL("https://play.google.com/store/account/subscriptions");
              }
            },
          },
        ]
      );
      return;
    }

    setPurchasing(true);
    try {
      const productId = RC_PRODUCT_IDS[selectedPlan];
      if (!productId) throw new Error("Unknown plan");

      // Attempt RevenueCat purchase
      const purchased = await purchaseWithRevenueCat(productId);

      if (purchased) {
        // Update tier on the server
        await updateTierMutation.mutateAsync({
          tier: selectedPlan as "pro" | "max",
        });
        await refetchUser();
        Alert.alert(
          "Purchase Successful! 🎉",
          `Welcome to RingMe ${selectedPlan.toUpperCase()}! Your new features are now active.`,
          [{ text: "Let's Go!", onPress: () => router.back() }]
        );
      } else {
        // RevenueCat SDK not installed or package not found — show info
        Alert.alert(
          "RevenueCat Not Configured",
          "To enable real purchases, install react-native-purchases and configure your RevenueCat API key. See SETUP.md for instructions.",
          [{ text: "OK" }]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Purchase failed";
      Alert.alert("Purchase Failed", message);
    } finally {
      setPurchasing(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[1];

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
        <Text style={styles.headerTitle}>Upgrade Plan</Text>
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>{currentTier.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={["rgba(255,110,199,0.15)", "rgba(192,132,252,0.08)"]}
          style={styles.hero}
        >
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={styles.heroTitle}>Unlock More Power</Text>
          <Text style={styles.heroSubtitle}>
            Get unlimited numbers, AI features, call recording, and more.
          </Text>
        </LinearGradient>

        {/* Plan Selector */}
        <View style={styles.planSelector}>
          {PLANS.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [
                styles.planTab,
                selectedPlan === p.id && styles.planTabActive,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedPlan(p.id)}
            >
              <Text style={[styles.planTabText, selectedPlan === p.id && { color: C.pink }]}>
                {p.name}
              </Text>
              {p.id === "pro" && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>★</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Plan Card */}
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <View>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planTagline}>{plan.tagline}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
              <Text style={styles.planPeriod}>{plan.period}</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            {plan.features.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[
                  styles.featureText,
                  f.icon === "❌" && styles.featureTextDisabled,
                ]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Compare all plans */}
        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>Compare All Plans</Text>
          <View style={styles.compareTable}>
            <View style={styles.compareHeader}>
              <Text style={[styles.compareCell, styles.compareHeaderText, { flex: 2 }]}>Feature</Text>
              {PLANS.map((p) => (
                <Text key={p.id} style={[styles.compareCell, styles.compareHeaderText, { color: p.color }]}>
                  {p.name}
                </Text>
              ))}
            </View>
            {[
              { feature: "Numbers", values: ["1", "3", "∞"] },
              { feature: "SMS/mo", values: ["100", "∞", "∞"] },
              { feature: "Burners", values: ["1", "5", "∞"] },
              { feature: "AI Replies", values: ["5/day", "∞", "∞"] },
              { feature: "MMS", values: ["✗", "✓", "✓"] },
              { feature: "Recording", values: ["✗", "✗", "✓"] },
              { feature: "Groups", values: ["✗", "5", "20"] },
            ].map((row) => (
              <View key={row.feature} style={styles.compareRow}>
                <Text style={[styles.compareCell, styles.compareFeature, { flex: 2 }]}>{row.feature}</Text>
                {row.values.map((v, i) => (
                  <Text key={i} style={[
                    styles.compareCell,
                    styles.compareValue,
                    v === "✗" && styles.compareNo,
                    v === "✓" && styles.compareYes,
                  ]}>
                    {v}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        {selectedPlan !== "free" && selectedPlan !== currentTier && (
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            <LinearGradient
              colors={plan.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {purchasing ? (
                <ActivityIndicator color="#0D0520" size="small" />
              ) : (
                <Text style={styles.ctaBtnText}>
                  Upgrade to {plan.name} — {plan.price}/mo
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {selectedPlan === currentTier && (
          <View style={styles.currentPlanNote}>
            <Text style={styles.currentPlanNoteText}>
              ✓ You're currently on the {currentTier.toUpperCase()} plan
            </Text>
          </View>
        )}

        <Text style={styles.legalText}>
          Subscriptions auto-renew monthly. Cancel anytime in your account settings.
          Managed via RevenueCat / App Store / Google Play.
        </Text>
      </ScrollView>
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
  currentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,110,199,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.3)",
  },
  currentBadgeText: { color: C.pink, fontSize: 11, fontWeight: "800" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.15)",
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { color: C.txt, fontSize: 22, fontWeight: "800" },
  heroSubtitle: { color: C.txt2, fontSize: 14, textAlign: "center", lineHeight: 20 },
  planSelector: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  planTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  planTabActive: { backgroundColor: "rgba(255,110,199,0.12)" },
  planTabText: { color: C.txt2, fontSize: 14, fontWeight: "700" },
  popularBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  popularBadgeText: { color: "#0D0520", fontSize: 8, fontWeight: "800" },
  planCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  planCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { color: C.txt, fontSize: 22, fontWeight: "800" },
  planTagline: { color: C.txt2, fontSize: 13, marginTop: 2 },
  priceContainer: { alignItems: "flex-end" },
  planPrice: { fontSize: 28, fontWeight: "800" },
  planPeriod: { color: C.txt2, fontSize: 12 },
  featureList: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { fontSize: 16, width: 24 },
  featureText: { color: C.txt, fontSize: 14 },
  featureTextDisabled: { color: C.txt2, textDecorationLine: "line-through" },
  compareCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  compareTitle: { color: C.txt, fontSize: 15, fontWeight: "700" },
  compareTable: { gap: 2 },
  compareHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  compareHeaderText: { color: C.txt2, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  compareRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  compareCell: { flex: 1, textAlign: "center" },
  compareFeature: { color: C.txt2, fontSize: 12, textAlign: "left" },
  compareValue: { color: C.txt, fontSize: 12, fontWeight: "600" },
  compareNo: { color: "rgba(255,255,255,0.2)" },
  compareYes: { color: C.mint },
  ctaBtn: { borderRadius: 16, overflow: "hidden" },
  ctaGradient: { paddingVertical: 16, alignItems: "center" },
  ctaBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "800" },
  currentPlanNote: {
    backgroundColor: "rgba(77,255,180,0.08)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(77,255,180,0.2)",
  },
  currentPlanNoteText: { color: C.mint, fontSize: 14, fontWeight: "700" },
  legalText: { color: C.txt2, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
