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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setOnboardingComplete } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Demo login — create a mock user
      await signIn({
        id: 1,
        openId: "demo-user",
        name: email.split("@")[0] || "User",
        email: email.trim(),
        avatarColor: "#FF6EC7",
        subscriptionTier: "free",
      });
      await setOnboardingComplete();
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await signIn({
        id: 1,
        openId: "demo-user",
        name: "Demo User",
        email: "demo@ringme.pro",
        avatarColor: "#FF6EC7",
        subscriptionTier: "pro",
      });
      await setOnboardingComplete();
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your RingMe account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Pressable>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginBtnText}>{loading ? "Signing in..." : "Log In →"}</Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Demo card */}
          <Pressable
            style={({ pressed }) => [styles.demoCard, pressed && { opacity: 0.8 }]}
            onPress={handleDemoLogin}
          >
            <Text style={styles.demoCardTitle}>✨ Try Demo Account</Text>
            <Text style={styles.demoCardSub}>demo@ringme.pro — instant access</Text>
          </Pressable>
        </View>

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/signup" as never)}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0520" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { width: 72, height: 72, borderRadius: 20, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)" },
  form: { gap: 16 },
  errorBox: {
    backgroundColor: "#FF7A5C22",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF7A5C44",
  },
  errorText: { color: "#FF7A5C", fontSize: 13 },
  inputGroup: { gap: 8 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  forgotText: { color: "#FF6EC7", fontSize: 13 },
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
  passwordContainer: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: "absolute", right: 14, top: 14 },
  eyeIcon: { fontSize: 20 },
  loginBtn: {
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
  loginBtnText: { color: "#0D0520", fontSize: 16, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  demoCard: {
    backgroundColor: "#1A0D35",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6EC733",
    padding: 16,
    alignItems: "center",
  },
  demoCardTitle: { color: "#FF6EC7", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  demoCardSub: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  footerLink: { color: "#FF6EC7", fontSize: 14, fontWeight: "700" },
});
