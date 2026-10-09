import React, { useState, useEffect, useRef } from "react";
import { Tabs, useRouter, useGlobalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  DeviceEventEmitter,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../../../src/theme/ThemeContext";
import { BASE_URL } from "../../../../src/constants/api";
import { useSocket } from "../../../../src/hooks/useSocket";
import { useAuth } from "../../../../src/hooks/useAuth";

export default function TeamTabLayout() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const { colors, mode } = useTheme();
  const styles = getStyles(colors);
  const [hasUnread, setHasUnread] = useState(false);

  // Grab auth state and loading status from your hook
  const { userId: myId, isLoading: authLoading } = useAuth();

  // Use our global socket
  const { addListener, isConnected } = useSocket(myId);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const wasDisconnected = useRef(false);

  // --- 1. THE SECURITY GUARD ---
  // Redirect to landing page if no session is found after loading finishes
  useEffect(() => {
    if (!authLoading && !myId) {
      console.log("[Guard] No active session found, redirecting to login...");
      router.replace("/");
    }
  }, [myId, authLoading]);

  // --- NEW: SESSION EXPIRY LISTENER ---
  useEffect(() => {
    // This listens for the 'force_logout' event emitted by apiClient.ts
    const logoutSub = DeviceEventEmitter.addListener("force_logout", () => {
      console.log("[Auth] Session expired or invalid. Redirecting...");
      router.replace("/");
    });

    return () => logoutSub.remove();
  }, []);

  // --- 2. CONNECTIVITY BANNER ANIMATION ---
  useEffect(() => {
    let timer: any;

    if (myId && !isConnected) {
      timer = setTimeout(() => {
        wasDisconnected.current = true;
        Animated.timing(bannerAnim, {
          toValue: Platform.OS === "ios" ? 50 : 20,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 1500);
    } else {
      if (wasDisconnected.current) {
        timer = setTimeout(() => {
          Animated.timing(bannerAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            wasDisconnected.current = false;
          });
        }, 2000);
      } else {
        Animated.timing(bannerAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }).start();
        wasDisconnected.current = false;
      }
    }
    return () => clearTimeout(timer);
  }, [isConnected, myId]);

  // --- 3. UNREAD MESSAGES LOGIC ---
  const checkUnreadMessages = async () => {
    if (!id || id === "undefined" || !myId) return;
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${BASE_URL}/teams/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const members = await response.json();
        const anyUnread = members.some(
          (m: any) => String(m.id) !== String(myId) && m.unread_count > 0,
        );
        setHasUnread(anyUnread);
      }
    } catch (e) {
      /* silent fail */
    }
  };

  useEffect(() => {
    if (myId && id) {
      checkUnreadMessages();

      const remove = addListener((msg) => {
        if (msg.type === "new_message" || msg.type === "messages_read") {
          setTimeout(checkUnreadMessages, 300);
        }
      });

      const subClear = DeviceEventEmitter.addListener("clear_chat_badge", () =>
        setHasUnread(false),
      );
      const subSet = DeviceEventEmitter.addListener("set_chat_badge", () =>
        setHasUnread(true),
      );

      return () => {
        if (remove) remove();
        subClear.remove();
        subSet.remove();
      };
    }
  }, [id, myId, addListener]);

  // --- 4. EARLY RETURN WHILE AUTH LOADING ---
  // Prevents UI "flicker" before redirecting
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  // If no ID after loading, the useEffect will trigger redirect,
  // but we return null here to be safe.
  if (!myId) return null;

  return (
    <View style={{ flex: 1 }}>
      {/* CONNECTIVITY BANNER */}
      <Animated.View
        style={[
          styles.connectivityBanner,
          { transform: [{ translateY: bannerAnim }] },
          isConnected ? styles.onlineBanner : styles.offlineBanner,
        ]}
      >
        <Ionicons
          name={isConnected ? "checkmark-circle" : "cloud-offline"}
          size={18}
          color="#FFF"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.bannerText}>
          {isConnected ? "Back online" : "Connecting..."}
        </Text>
      </Animated.View>

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.teal,
          tabBarInactiveTintColor: colors.textSubtle,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.cardBg,
            borderTopColor: mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)',
            borderTopWidth: 1,
            elevation: 0,

            marginBottom: Platform.OS === "android" ? 8 : 0, // Lift the bar off the bottom
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginBottom: Platform.OS === "ios" ? 0 : 5,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Feed",
            tabBarIcon: ({ color }) => (
              <Ionicons name="megaphone-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: "Schedule",
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Chat",
            tabBarIcon: ({ color }) => (
              <View style={styles.iconContainer}>
                <Ionicons name="chatbubbles-outline" size={24} color={color} />
                {hasUnread && (
                  <View style={styles.tabBadge} pointerEvents="none" />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="media"
          options={{
            title: "Media",
            tabBarIcon: ({ color }) => (
              <Ionicons name="images-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Members",
            tabBarIcon: ({ color }) => (
              <Ionicons name="people-outline" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadge: {
    position: "absolute",
    right: -2,
    top: -2,
    backgroundColor: colors.coral,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.cardBg,
    zIndex: 10,
  },
  connectivityBanner: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 5 },
    }),
  },
  offlineBanner: { backgroundColor: colors.coral },
  onlineBanner: { backgroundColor: colors.teal },
  bannerText: { color: "#FFF", fontSize: 13, fontWeight: "bold" },
});
