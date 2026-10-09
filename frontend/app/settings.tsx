import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { baseStyles, getSharedStyles } from "../src/theme/sharedStyles";
import { ChangePasswordModal } from "../src/components/ChangePasswordModal";
import { BASE_URL } from "../src/constants/api";
import { apiClient } from "../src/services/apiClient";
import { UserAvatar } from "../src/components/UserAvatar";
import { Image } from "expo-image";
import { useTheme } from "../src/theme/ThemeContext";
import { Switch } from "react-native";

export default function SettingsScreen() {
  const { mode, colors, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    profile_picture: null as string | null,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [changeVisible, setChangeVisible] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiClient.get("/users/me");
      if (response.ok) {
        const data = await response.json();
        setUserData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email,
          profile_picture: data.profile_picture,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- SAVE CHANGES ---
  const handleUpdate = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("firstName", userData.firstName);
      formData.append("lastName", userData.lastName);

      if (selectedImage) {
        const uri = selectedImage;
        const fileName = uri.split("/").pop() || "upload.jpg";
        const match = /\.(\w+)$/.exec(fileName);
        const type = match ? `image/${match[1].toLowerCase()}` : `image/jpeg`;

        // @ts-ignore
        formData.append("image", { uri, name: fileName, type });
      }

      const response = await apiClient.post("/users/me", formData);

      if (response.ok) {
        const result = await response.json();
        // Update phone memory too so the rest of the app knows the new name
        await AsyncStorage.setItem("userFirstName", userData.firstName);
        await AsyncStorage.setItem("userLastName", userData.lastName);
        if (result.profile_picture) {
          setUserData((prev) => ({
            ...prev,
            profile_picture: result.profile_picture,
          }));
        }
        setSelectedImage(null);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Error", "Failed to update profile.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setSaving(false);
      router.back();
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open image picker");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/"); // Send back to Login screen
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>ACCOUNT PROFILE</Text>
          {/* AVATAR SECTION */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              <UserAvatar
                uri={
                  selectedImage ||
                  (userData.profile_picture
                    ? `${BASE_URL}/${userData.profile_picture}`
                    : null)
                }
                name={`${userData.firstName} ${userData.lastName}`}
                size={120}
              />
              <TouchableOpacity
                style={styles.editAvatarBtn}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userNameText}>
              {userData.firstName} {userData.lastName}
            </Text>
            <Text style={styles.userEmailText}>{userData.email}</Text>
          </View>

          {/* INPUT FIELDS CARD */}
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={userData.firstName}
                onChangeText={(t) => setUserData({ ...userData, firstName: t })}
                placeholderTextColor={colors.textSubtle}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={userData.lastName}
                onChangeText={(t) => setUserData({ ...userData, lastName: t })}
                placeholderTextColor={colors.textSubtle}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={userData.email}
                editable={false} // Usually keep email locked or handle OTP for change
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleUpdate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile Changes</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.sectionHeader}>PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.preferenceRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Ionicons
                  name={mode === "dark" ? "moon" : "sunny"}
                  size={22}
                  color={colors.textMain}
                />
                <Text style={styles.preferenceText}>Dark Mode</Text>
              </View>
              <Switch
                value={mode === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: "#767577", true: colors.teal }}
                thumbColor={"#f4f3f4"}
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>SECURITY</Text>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.teal,
                marginBottom: 30,
              },
            ]}
            onPress={() => setChangeVisible(true)}
          >
            <Text style={[styles.saveBtnText, { color: colors.teal }]}>
              Change Password
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.coral} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <ChangePasswordModal
        visible={changeVisible}
        onClose={() => setChangeVisible(false)}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    ...getSharedStyles(colors),
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: { color: colors.textMain, fontSize: 18, fontWeight: "bold" },
    backBtn: { padding: 4 },

    scrollContent: { padding: 20, paddingBottom: 40 },

    avatarContainer: { alignItems: "center", marginBottom: 30 },
    avatarWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.teal,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      position: "relative",
    },
    avatarTextLarge: { color: "#FFF", fontSize: 32, fontWeight: "bold" },
    editAvatarBtn: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: colors.cardBg,
      padding: 8,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.background,
    },
    userNameText: { color: colors.textMain, fontSize: 22, fontWeight: "bold" },
    userEmailText: { color: colors.textSubtle, fontSize: 14, marginTop: 4 },

    card: {
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
      marginBottom: 24,
    },
    inputGroup: { paddingVertical: 16 },
    label: {
      color: colors.textSubtle,
      fontSize: 12,
      marginBottom: 8,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    input: { color: colors.textMain, fontSize: 16, padding: 0 },
    divider: { height: 1, backgroundColor: "rgba(150, 150, 150, 0.2)" },

    sectionHeader: {
      color: colors.textSubtle,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 10,
      marginLeft: 4,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    preferenceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    preferenceText: {
      fontSize: 16,
      color: colors.textMain,
      fontWeight: "500",
    },

    saveBtn: {
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 0,
      borderRadius: 12,
      marginBottom: 16,
    },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 8,
    },
    logoutBtnText: { color: colors.coral, fontSize: 16, fontWeight: "600" },
  });
