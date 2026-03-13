import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View, Pressable, Image } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");

const C = {
  bg: "#0D0520",
  card: "#1A0D35",
  pink: "#FF6EC7",
  pink2: "#FF3DAA",
  lav: "#C084FC",
  lemon: "#FFE94A",
  mint: "#4DFFB4",
  sky: "#5BC8FF",
  txt: "#FFFFFF",
  txt2: "rgba(255,255,255,0.55)",
};

export default function SplashScreenPage() {
  const router = useRouter();
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const bubblesOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
    Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.timing(textOpacity, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();
    Animated.timing(bubblesOpacity, { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }).start();
    Animated.timing(btnOpacity, { toValue: 1, duration: 600, delay: 900, useNativeDriver: true }).start();
    const dotAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]));
    dotAnim(dot1, 0).start();
    dotAnim(dot2, 200).start();
    dotAnim(dot3, 400).start();
    const timer = setTimeout(() => { router.replace("/(auth)/onboarding" as never); }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />
      <View style={[styles.blob, styles.blob4]} />

      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoBadge}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </Animated.View>

      <Animated.View style={[styles.wordmarkContainer, { opacity: textOpacity }]}>
        <Text style={styles.wordmark}>Ring<Text style={styles.wordmarkAccent}>Me</Text></Text>
        <Text style={styles.tagline}>YOUR SECOND NUMBER</Text>
      </Animated.View>

      <Animated.View style={[styles.bubblesRow, { opacity: bubblesOpacity }]}>
        <View style={[styles.bubble, styles.bubblePink]}>
          <Text style={styles.bubbleEmoji}>📞</Text>
          <Text style={styles.bubbleLabel}>CALLS</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleSky, styles.bubbleTall]}>
          <Text style={styles.bubbleEmoji}>💬</Text>
          <Text style={styles.bubbleLabel}>TEXTS</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleMint]}>
          <Text style={styles.bubbleEmoji}>🔥</Text>
          <Text style={styles.bubbleLabel}>BURNER</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.privacyBadge, { opacity: bubblesOpacity }]}>
        <Text style={styles.privacyText}>🔒 <Text style={styles.privacyAccent}>100% Private</Text> · No SIM Needed</Text>
      </Animated.View>

      <Animated.View style={[styles.btnContainer, { opacity: btnOpacity }]}>
        <Pressable style={styles.getStartedBtn} onPress={() => router.replace("/(auth)/onboarding" as never)}>
          <Text style={styles.getStartedText}>Let's Get Started! 🌱</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/(auth)/login" as never)}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginAccent}>Log In</Text></Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.dotsContainer, { opacity: textOpacity }]}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  blob: { position: "absolute", borderRadius: 999 },
  blob1: { width: 200, height: 200, backgroundColor: C.pink, opacity: 0.18, top: -60, left: -60 },
  blob2: { width: 150, height: 150, backgroundColor: C.sky, opacity: 0.15, top: 80, right: -40 },
  blob3: { width: 120, height: 120, backgroundColor: C.mint, opacity: 0.15, bottom: 120, left: 10 },
  blob4: { width: 180, height: 180, backgroundColor: C.lav, opacity: 0.12, bottom: -40, right: -40 },
  logoContainer: { marginBottom: 16 },
  logoBadge: { width: 90, height: 90, borderRadius: 26, backgroundColor: C.card, borderWidth: 2, borderColor: C.pink, alignItems: "center", justifyContent: "center", shadowColor: C.pink, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20, elevation: 10, overflow: "hidden" },
  logoImage: { width: 90, height: 90, borderRadius: 26 },
  wordmarkContainer: { alignItems: "center", marginBottom: 8 },
  wordmark: { fontSize: 42, fontWeight: "900", color: C.txt, letterSpacing: 2, lineHeight: 48 },
  wordmarkAccent: { color: C.pink },
  tagline: { fontSize: 10, fontWeight: "800", letterSpacing: 4, color: C.txt2, textTransform: "uppercase", marginTop: 4 },
  bubblesRow: { flexDirection: "row", gap: 8, marginTop: 20, width: "88%" },
  bubble: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 4 },
  bubblePink: { backgroundColor: C.pink2 },
  bubbleSky: { backgroundColor: "#3B9FFF", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  bubbleMint: { backgroundColor: "#00C896" },
  bubbleTall: { transform: [{ scaleY: 1.08 }] },
  bubbleEmoji: { fontSize: 22 },
  bubbleLabel: { fontSize: 8, fontWeight: "900", color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 },
  privacyBadge: { marginTop: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  privacyText: { fontSize: 11, fontWeight: "800", color: C.txt },
  privacyAccent: { color: C.lemon },
  btnContainer: { width: "88%", alignItems: "center", marginTop: 20, gap: 12 },
  getStartedBtn: { width: "100%", backgroundColor: C.pink, borderRadius: 50, paddingVertical: 16, alignItems: "center", shadowColor: C.pink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 20, elevation: 8 },
  getStartedText: { fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  loginText: { fontSize: 12, fontWeight: "800", color: C.txt2 },
  loginAccent: { color: C.pink },
  dotsContainer: { flexDirection: "row", gap: 8, position: "absolute", bottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink },
});
