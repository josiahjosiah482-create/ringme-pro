import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, StyleSheet, Text, View } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

function TabIcon({ name, color, label }: { name: string; color: string; label: string }) {
  return (
    <View style={styles.tabIconContainer}>
      <IconSymbol size={24} name={name as never} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#FF6EC7",
        tabBarInactiveTintColor: "rgba(255,255,255,0.25)",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0D0520",
          borderTopColor: "rgba(255,255,255,0.08)",
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <TabIcon name="message.fill" color={color} label="Messages" />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ color }) => (
            <TabIcon name="phone.fill" color={color} label="Calls" />
          ),
        }}
      />
      <Tabs.Screen
        name="burners"
        options={{
          title: "Burners",
          tabBarIcon: ({ color }) => (
            <TabIcon name="flame.fill" color={color} label="Burners" />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color }) => (
            <TabIcon name="person.2.fill" color={color} label="Contacts" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <TabIcon name="gear" color={color} label="More" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
});
