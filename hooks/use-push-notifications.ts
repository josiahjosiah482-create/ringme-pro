import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

// FIX 16: Register quick-reply notification categories
if (Platform.OS !== "web") {
  Notifications.setNotificationCategoryAsync("sms_reply", [
    {
      identifier: "REPLY",
      buttonTitle: "Reply",
      textInput: { submitButtonTitle: "Send", placeholder: "Type a reply..." },
      options: { opensAppToForeground: false },
    },
    {
      identifier: "OPEN",
      buttonTitle: "Open",
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {});
}

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Hook that registers the device for push notifications and handles
 * notification taps to navigate to the correct screen.
 *
 * Must be called from a component that is inside the auth context.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const registerTokenMutation = trpc.notifications.registerToken.useMutation();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        registerTokenMutation.mutate({ token, platform });
      }
    });

    // Set up Android notification channels
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("ringme-alerts", {
        name: "RingMe Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6EC7",
        sound: "default",
      });
      Notifications.setNotificationChannelAsync("ringme-calls", {
        name: "Incoming Calls",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#FF6EC7",
        sound: "default",
      });
    }

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[Push] Notification received in foreground:", notification.request.content.title);
    });

    // Listen for notification taps — navigate to the right screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      if (data?.type === "inbound_sms" && data?.conversationId) {
        router.push({
          pathname: "/chat/[id]" as never,
          params: {
            id: String(data.conversationId),
            name: String(data.from ?? "Unknown"),
          },
        });
      } else if (data?.type === "inbound_call") {
        router.push("/(tabs)/calls" as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("[Push] Push notifications not available on simulator/emulator");
    return null;
  }

  if (Platform.OS === "web") {
    console.log("[Push] Push notifications not supported on web");
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Push notification permission denied");
    return null;
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses the projectId from app.config.ts automatically
    });
    console.log("[Push] Expo push token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("[Push] Failed to get push token:", error);
    return null;
  }
}
