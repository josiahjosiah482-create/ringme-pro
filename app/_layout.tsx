import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, View, Text, Pressable, StyleSheet } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

SplashScreen.preventAutoHideAsync().catch(() => {});

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000";

function ServiceErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={bannerStyles.overlay}>
      <Text style={bannerStyles.icon}>⚠️</Text>
      <Text style={bannerStyles.title}>Service Temporarily Unavailable</Text>
      <Text style={bannerStyles.sub}>Please check your connection and try again.</Text>
      <Pressable style={bannerStyles.btn} onPress={onRetry}>
        <Text style={bannerStyles.btnTxt}>Retry</Text>
      </Pressable>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0D0520", alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  sub: { color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 24 },
  btn: { backgroundColor: "#FF6EC7", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
  btnTxt: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

function RootNavigator() {
  const { isLoading, isAuthenticated, hasCompletedOnboarding, hasSelectedNumber } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Register for push notifications when authenticated
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;
    const seg0 = segments[0] as string | undefined;
    const inAuthGroup = seg0 === "(auth)";
    const inOnboarding = seg0 === "onboarding";
    const inNumberSelect = seg0 === "number-select";

    if (!isAuthenticated && !inAuthGroup) {
      requestAnimationFrame(() => router.replace("/(auth)/splash" as never));
    } else if (isAuthenticated && !hasCompletedOnboarding && !inOnboarding) {
      requestAnimationFrame(() => router.replace("/onboarding" as never));
    } else if (
      isAuthenticated &&
      hasCompletedOnboarding &&
      !hasSelectedNumber &&
      !inNumberSelect
    ) {
      requestAnimationFrame(() => router.replace("/number-select/country" as never));
    } else if (
      isAuthenticated &&
      hasCompletedOnboarding &&
      hasSelectedNumber &&
      (inAuthGroup || inOnboarding || inNumberSelect)
    ) {
      requestAnimationFrame(() => router.replace("/(tabs)"));
    }
  }, [isLoading, isAuthenticated, hasCompletedOnboarding, hasSelectedNumber, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0D0520" } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="number-select" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chat/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chat/new"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="call/active"
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
      <Stack.Screen
        name="settings/webhook-setup"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/blocked-numbers"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/dnd-schedule"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/port-number"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/upgrade"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/voicemail-greeting"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chat/group-new"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="number-select/buy"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen name="oauth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [serviceError, setServiceError] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      // Only show service error if DB is down AND we have DB credentials configured
      // This prevents blocking app startup when DB is not yet configured
      const hasDbConfig = !!process.env.EXPO_PUBLIC_API_URL;
      setServiceError(hasDbConfig && data.db === false);
    } catch {
      // Server unreachable — don't block app startup, just log
      console.warn("[Health] Server unreachable");
    }
  }, []);

  useEffect(() => {
    initManusRuntime();
    checkHealth();
  }, [checkHealth]);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {serviceError ? (
        <ServiceErrorBanner onRetry={checkHealth} />
      ) : (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootNavigator />
              <StatusBar style="light" backgroundColor="#0D0520" />
            </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      )}
    </GestureHandlerRootView>
  );

  if (Platform.OS === "web") {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
