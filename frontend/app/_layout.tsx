import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "../src/theme/colors";
import { AppThemeProvider, useTheme } from "../src/theme/ThemeContext";

// --- NOTIFICATIONS IMPORTS ---
import * as Notifications from "expo-notifications";
import { useLastNotificationResponse } from "expo-notifications";

// --- GLOBAL NOTIFICATION CONFIG ---
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowBanner: true, // Shows the "Heads-up" banner at the top of the screen
      shouldShowList: true, // Keeps the notification in the notification center/tray
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as any,
});

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
  },
};

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootNavigation />
      </GestureHandlerRootView>
    </AppThemeProvider>
  );
}

function RootNavigation() {
  const router = useRouter();
  const { colors, mode } = useTheme();

  // 1. Hook to catch notifications that opened the app (Cold Start)
  const lastResponse = useLastNotificationResponse();

  // --- HANDLE COLD START ---
  useEffect(() => {
    if (
      lastResponse &&
      lastResponse.notification.request.content.data?.url &&
      lastResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const url = lastResponse.notification.request.content.data.url as string;
      console.log("[Cold Start] Detected URL via hook:", url);

      // On a fresh boot, we give the router 1.5s to build the team routes
      const timer = setTimeout(() => {
        try {
          router.replace(url as any);
        } catch (e) {
          console.error("[Cold Start] Navigation failed:", e);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [lastResponse]);

  // --- GLOBAL UI & WARM START LISTENER ---
  useEffect(() => {
    // Set OS-level window color reactively
    SystemUI.setBackgroundColorAsync(colors.background);

    // Handle clicks while app is in background/foreground (Warm Start)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url as string;

        if (url) {
          console.log("[Warm Start] Notification Tapped:", url);
          // Background taps are faster, 500ms is usually enough
          setTimeout(() => {
            router.push(url as any);
          }, 500);
        }
      },
    );

    return () => subscription.remove();
  }, [colors.background]); // Depend on background color so it updates OS UI

  const navigationTheme = {
    ...DarkTheme,
    dark: mode === "dark",
    colors: {
      ...DarkTheme.colors,
      background: colors.background,
      card: colors.cardBg,
      text: colors.textMain,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      />
    </ThemeProvider>
  );
}
