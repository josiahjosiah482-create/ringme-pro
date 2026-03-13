import { useRef, useState } from "react";
import { Animated, Dimensions, FlatList, Pressable, StyleSheet, Text, View, ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

const { width } = Dimensions.get("window");

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
  border: "rgba(255,255,255,0.08)",
};

const SLIDES = [
  {
    id: "1",
    emoji: "📡",
    title: "Free Calls & Texts 📞",
    subtitle: "Get a real US phone number. Call and text anyone — totally free over WiFi. No SIM card needed!",
    color: C.pink,
    msgThem: "Hey! Free tonight? 🌿",
    msgMe: "Yes!! 7:30? 🎉",
    msgThem2: "Perfect! See you 💚",
    msgMe2: "Can't wait! 🥳",
    badge1: { icon: "🔒", text: "Private Number" },
    badge2: { icon: "📡", text: "WiFi Calls" },
  },
  {
    id: "2",
    emoji: "🔥",
    title: "Disposable Burners 🔥",
    subtitle: "Create temporary numbers for dating, selling, or privacy. Burn them when you're done — no trace left!",
    color: C.lemon,
    msgThem: "Who is this? 🤔",
    msgMe: "Your secret admirer 😏",
    msgThem2: "Haha ok! 😂",
    msgMe2: "Burn after reading 🔥",
    badge1: { icon: "🕵️", text: "Anonymous" },
    badge2: { icon: "⏱️", text: "Auto-Expire" },
  },
  {
    id: "3",
    emoji: "✨",
    title: "AI-Powered ✨",
    subtitle: "Smart replies, voicemail transcription, and conversation summaries — all powered by AI.",
    color: C.mint,
    msgThem: "Can you make it? 🎉",
    msgMe: "Absolutely! 🙌",
    msgThem2: "Awesome!! 🌟",
    msgMe2: "See you there! 💫",
    badge1: { icon: "🤖", text: "Smart Replies" },
    badge2: { icon: "🎙️", text: "AI Transcripts" },
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingComplete } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      setOnboardingComplete();
      router.replace("/(auth)/signup" as never);
    }
  };

  const handleSkip = () => {
    setOnboardingComplete();
    router.replace("/(auth)/signup" as never);
  };

  const handleLogin = () => {
    setOnboardingComplete();
    router.replace("/(auth)/login" as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Phone mock */}
            <View style={styles.phoneMock}>
              <View style={[styles.mockTop, { backgroundColor: item.color }]}>
                <View style={styles.mockDot} /><View style={styles.mockDot} /><View style={styles.mockDot} />
              </View>
              <View style={styles.mockBody}>
                <View style={styles.msgThem}><Text style={styles.msgThemText}>{item.msgThem}</Text></View>
                <View style={styles.msgMe}><Text style={styles.msgMeText}>{item.msgMe}</Text></View>
                <View style={styles.msgThem}><Text style={styles.msgThemText}>{item.msgThem2}</Text></View>
                <View style={styles.msgMe}><Text style={styles.msgMeText}>{item.msgMe2}</Text></View>
              </View>
            </View>
            {/* Float badges */}
            <View style={[styles.floatBadge, styles.floatLeft]}>
              <Text style={styles.floatIcon}>{item.badge1.icon}</Text>
              <Text style={styles.floatText}>{item.badge1.text}</Text>
            </View>
            <View style={[styles.floatBadge, styles.floatRight]}>
              <Text style={styles.floatIcon}>{item.badge2.icon}</Text>
              <Text style={styles.floatText}>{item.badge2.text}</Text>
            </View>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Title & subtitle */}
      <Text style={styles.title}>{SLIDES[activeIndex].title}</Text>
      <Text style={styles.subtitle}>{SLIDES[activeIndex].subtitle}</Text>

      {/* Next button */}
      <Pressable style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextText}>{activeIndex < SLIDES.length - 1 ? "Next →" : "Create Free Account 🌱"}</Text>
      </Pressable>

      <Pressable onPress={handleLogin} style={styles.loginRow}>
        <Text style={styles.loginText}>Already have an account? <Text style={styles.loginAccent}>Log In</Text></Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  header: { width: "100%", alignItems: "flex-end", paddingHorizontal: 20, marginBottom: 10 },
  skipBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  skipText: { fontSize: 12, fontWeight: "800", color: C.txt2 },
  slide: { width, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, position: "relative", height: 260 },
  phoneMock: { width: 100, height: 170, backgroundColor: C.card, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,110,199,0.3)", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 10 },
  mockTop: { height: 28, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
  mockDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  mockBody: { flex: 1, padding: 6, gap: 4 },
  msgThem: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start", maxWidth: "75%" },
  msgThemText: { fontSize: 8, fontWeight: "700", color: C.txt2 },
  msgMe: { backgroundColor: C.pink2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-end", maxWidth: "75%" },
  msgMeText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  floatBadge: { position: "absolute", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  floatLeft: { left: 20, top: 30 },
  floatRight: { right: 20, bottom: 30 },
  floatIcon: { fontSize: 14 },
  floatText: { fontSize: 10, fontWeight: "900", color: "#1A0A2E" },
  dotsRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)" },
  dotActive: { width: 24, borderRadius: 6, backgroundColor: C.pink },
  title: { fontSize: 22, fontWeight: "900", color: C.txt, textAlign: "center", marginBottom: 10, paddingHorizontal: 24 },
  subtitle: { fontSize: 13, fontWeight: "700", color: C.txt2, textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 32 },
  nextBtn: { width: "88%", backgroundColor: C.pink, borderRadius: 50, paddingVertical: 16, alignItems: "center", shadowColor: C.pink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6 },
  nextText: { fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  loginRow: { marginTop: 14 },
  loginText: { fontSize: 12, fontWeight: "800", color: C.txt2 },
  loginAccent: { color: C.pink },
});
