import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

// This screen is shown when the user is authenticated but hasn't completed onboarding
// It renders the onboarding content directly instead of redirecting
export { default } from "@/app/(auth)/onboarding";
