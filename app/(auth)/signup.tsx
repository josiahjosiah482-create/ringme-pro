import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "rgba(255,255,255,0.08)", width: "0%" };
  if (pw.length < 6) return { label: "Weak", color: "#FF7A5C", width: "25%" };
  if (pw.length < 10) return { label: "Fair", color: "#FFE94A", width: "60%" };
  return { label: "Strong", color: "#FF6EC7", width: "100%" };
}

export default function SignupScreen() {
  const router = useRouter();
  const { signIn, setOnboardingComplete } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = getPasswordStrength(password);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn({
        id: 1,
        openId: `user-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        avatarColor: "#FF6EC7",
        subscriptionTier: "free",
      });
      await setOnboardingComplete();
    } catch {
      setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require("../../assets/images/icon.png")} style={styles.logo} resizeMode="cover" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join RingMe Pro for free</Text>
        </View>

        {/* Free plan perks */}
        <View style={styles.perksCard}>
          <Text style={styles.perksTitle}>Free Plan Includes</Text>
          <View style={styles.perksList}>
            {["1 free US phone number", "Unlimited texts", "100 mins/month calling", "AI smart replies"].map(
              (perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Text style={styles.perkCheck}>✓</Text>
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      { width: strength.width as any, backgroundColor: strength.color },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.signupBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.signupBtnText}>
              {loading ? "Creating account..." : "Create Free Account →"}
            </Text>
          </Pressable>
        </View>

        {/* Login link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login" as never)}>
            <Text style={styles.footerLink}>Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 24 },
  logo: { width: 72, height: 72, borderRadius: 20, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
  perksCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,110,199,0.2)",
    padding: 16,
    marginBottom: 20,
  },
  perksTitle: { color: "#FF6EC7", fontSize: 13, fontWeight: "700", marginBottom: 10 },
  perksList: { gap: 6 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkCheck: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },
  perkText: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  form: { gap: 14 },
  errorBox: {
    backgroundColor: "#FF7A5C22",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF7A5C44",
  },
  errorText: { color: "#FF7A5C", fontSize: 13 },
  inputGroup: { gap: 6 },
  label: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  input: {
    height: 52,
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 15,
  },
  strengthContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthFill: { height: "100%", borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "600", width: 44 },
  signupBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FF6EC7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#FF6EC7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  signupBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  footerLink: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },
});
