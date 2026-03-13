import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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

const CARRIERS = [
  "AT&T", "Verizon", "T-Mobile", "Sprint", "Boost Mobile",
  "Cricket Wireless", "Metro by T-Mobile", "US Cellular",
  "Google Fi", "Mint Mobile", "Visible", "Other",
];

const STEPS = [
  { icon: "📱", title: "Enter your number", desc: "The number you want to bring to RingMe" },
  { icon: "🏢", title: "Current carrier info", desc: "Your current carrier and account PIN" },
  { icon: "📋", title: "Billing address", desc: "Must match your carrier's records" },
  { icon: "✅", title: "Submit request", desc: "We'll handle the rest (1–3 business days)" },
];

export default function PortNumberScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [number, setNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [accountPin, setAccountPin] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [showCarrierPicker, setShowCarrierPicker] = useState(false);

  const { data: existingRequests } = trpc.porting.list.useQuery();
  const submitMutation = trpc.porting.submit.useMutation({
    onSuccess: () => {
      Alert.alert(
        "Request Submitted! 🎉",
        "Your porting request has been submitted. We'll notify you when your number is ready (typically 1–3 business days).",
        [{ text: "Done", onPress: () => router.back() }]
      );
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const handleNext = () => {
    if (step === 0) {
      if (!number.trim() || number.trim().length < 7) {
        Alert.alert("Invalid Number", "Please enter a valid phone number to port.");
        return;
      }
    } else if (step === 1) {
      if (!carrier) {
        Alert.alert("Carrier Required", "Please select your current carrier.");
        return;
      }
    } else if (step === 2) {
      if (!billingAddress.trim()) {
        Alert.alert("Address Required", "Please enter your billing address.");
        return;
      }
    } else if (step === 3) {
      submitMutation.mutate({
        number: number.trim(),
        carrier,
        accountPin: accountPin.trim() || undefined,
        billingAddress: billingAddress.trim(),
      });
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Port Your Number</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{step + 1}/4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.progressStep}>
              <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
                <Text style={styles.progressDotText}>{i < step ? "✓" : (i + 1).toString()}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, i < step && styles.progressLineActive]} />
              )}
            </View>
          ))}
        </View>

        {/* Step Content */}
        <View style={styles.card}>
          <Text style={styles.stepIcon}>{STEPS[step].icon}</Text>
          <Text style={styles.stepTitle}>{STEPS[step].title}</Text>
          <Text style={styles.stepDesc}>{STEPS[step].desc}</Text>
        </View>

        {step === 0 && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Phone Number to Port</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={C.txt2}
              value={number}
              onChangeText={setNumber}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Make sure your number is unlocked and your account is in good standing before porting.
              </Text>
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Current Carrier</Text>
            <Pressable
              style={[styles.input, styles.pickerBtn]}
              onPress={() => setShowCarrierPicker((v) => !v)}
            >
              <Text style={carrier ? styles.pickerValue : styles.pickerPlaceholder}>
                {carrier || "Select carrier..."}
              </Text>
              <Text style={styles.pickerArrow}>{showCarrierPicker ? "▲" : "▼"}</Text>
            </Pressable>
            {showCarrierPicker && (
              <View style={styles.carrierList}>
                {CARRIERS.map((c) => (
                  <Pressable
                    key={c}
                    style={({ pressed }) => [
                      styles.carrierItem,
                      carrier === c && styles.carrierItemActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => { setCarrier(c); setShowCarrierPicker(false); }}
                  >
                    <Text style={[styles.carrierItemText, carrier === c && { color: C.pink }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Account PIN (if applicable)</Text>
            <TextInput
              style={styles.input}
              placeholder="4-digit PIN (optional)"
              placeholderTextColor={C.txt2}
              value={accountPin}
              onChangeText={setAccountPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={10}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Billing Address on File</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder={"123 Main St\nAnytown, CA 90210"}
              placeholderTextColor={C.txt2}
              value={billingAddress}
              onChangeText={setBillingAddress}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ⚠️ This must exactly match the billing address on your current carrier's account.
              </Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.formCard}>
            <Text style={styles.reviewTitle}>Review Your Request</Text>
            {[
              { label: "Number to Port", value: number },
              { label: "Current Carrier", value: carrier },
              { label: "Account PIN", value: accountPin ? "••••" : "Not provided" },
              { label: "Billing Address", value: billingAddress },
            ].map((item) => (
              <View key={item.label} style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{item.label}</Text>
                <Text style={styles.reviewValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📋 By submitting, you authorize RingMe to initiate the porting process. Your current carrier will be notified. This process typically takes 1–3 business days.
              </Text>
            </View>
          </View>
        )}

        {/* Existing requests */}
        {existingRequests && existingRequests.length > 0 && (
          <View style={styles.existingCard}>
            <Text style={styles.existingTitle}>Previous Requests</Text>
            {existingRequests.map((req) => (
              <View key={req.id} style={styles.existingRow}>
                <Text style={styles.existingNumber}>{req.number}</Text>
                <View style={[styles.statusBadge, { backgroundColor: req.status === "completed" ? "rgba(77,255,180,0.15)" : "rgba(255,110,199,0.15)" }]}>
                  <Text style={[styles.statusText, { color: req.status === "completed" ? C.mint : C.pink }]}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Next Button */}
        <Pressable
          style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}
          onPress={handleNext}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#0D0520" size="small" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 3 ? "Submit Porting Request 🚀" : "Continue →"}
            </Text>
          )}
        </Pressable>
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
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,110,199,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.3)",
  },
  stepBadgeText: { color: C.pink, fontSize: 12, fontWeight: "700" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  progressStep: { flexDirection: "row", alignItems: "center" },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: { backgroundColor: "rgba(255,110,199,0.2)", borderColor: C.pink },
  progressDotText: { color: C.txt2, fontSize: 11, fontWeight: "700" },
  progressLine: { width: 32, height: 2, backgroundColor: C.border },
  progressLineActive: { backgroundColor: "rgba(255,110,199,0.4)" },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    gap: 8,
  },
  stepIcon: { fontSize: 36 },
  stepTitle: { color: C.txt, fontSize: 18, fontWeight: "700" },
  stepDesc: { color: C.txt2, fontSize: 14, textAlign: "center" },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  fieldLabel: { color: C.txt2, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: C.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.txt,
    fontSize: 15,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerValue: { color: C.txt, fontSize: 15 },
  pickerPlaceholder: { color: C.txt2, fontSize: 15 },
  pickerArrow: { color: C.txt2, fontSize: 12 },
  carrierList: {
    backgroundColor: C.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  carrierItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  carrierItemActive: { backgroundColor: "rgba(255,110,199,0.08)" },
  carrierItemText: { color: C.txt, fontSize: 14 },
  infoBox: {
    backgroundColor: "rgba(192,132,252,0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.2)",
  },
  infoText: { color: C.lav, fontSize: 13, lineHeight: 18 },
  reviewTitle: { color: C.txt, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  reviewLabel: { color: C.txt2, fontSize: 13 },
  reviewValue: { color: C.txt, fontSize: 13, fontWeight: "600", maxWidth: "55%", textAlign: "right" },
  existingCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  existingTitle: { color: C.txt2, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  existingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  existingNumber: { color: C.txt, fontSize: 14, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "700" },
  nextBtn: {
    backgroundColor: C.pink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "800" },
});
