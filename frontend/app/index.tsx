import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme/colors";
import { baseStyles } from "../src/theme/sharedStyles";
import { PasswordResetModal } from "../src/components/PasswordResetModal";
import { BASE_URL, ENDPOINTS } from "../src/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LandingScreen() {
  const router = useRouter();
  const [authVisible, setAuthVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resetVisible, setResetVisible] = useState(false);

  // --- FORM STATES ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamInviteCode, setTeamInviteCode] = useState("");
  const [foundTeam, setFoundTeam] = useState<{
    id: number;
    name: string;
    is_closed: boolean;
  } | null>(null);
  const [joinTeamId, setJoinTeamId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const checkAutoLogin = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (token) router.replace("/dashboard");
      } catch (e) {
        console.log("Error checking session", e);
      }
    };
    checkAutoLogin();
  }, []);

  // Resets ALL join-modal state. Call this any time the join modal closes,
  // regardless of how (X button, backdrop, after navigating away, etc.)
  const closeJoinModal = () => {
    setJoinVisible(false);
    setFoundTeam(null);
    setTeamInviteCode("");
    setErrorMessage("");
    setJoinTeamId(null);
  };

  // --- STEP 1: FIND TEAM BY CODE ---
  const handleLookupTeam = async () => {
    const sanitizedCode = teamInviteCode.trim().toUpperCase();
    if (!sanitizedCode) {
      setErrorMessage("Please enter a code");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const cleanBase = BASE_URL.endsWith("/")
        ? BASE_URL.slice(0, -1)
        : BASE_URL;

      const response = await fetch(
        `${cleanBase}/teams/lookup/${sanitizedCode}`,
      );
      const data = await response.json();

      if (response.ok) {
        setFoundTeam(data);
        setErrorMessage("");
      } else {
        setFoundTeam(null);
        setErrorMessage(data.detail || "Invalid Team Code");
      }
    } catch (e) {
      setErrorMessage("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: TRANSITION TO SIGNUP (open team) ---
  const continueToSignup = () => {
    if (foundTeam) {
      setJoinTeamId(foundTeam.id.toString());
    }
    // Don't call closeJoinModal here — we want to keep foundTeam so the
    // "Joining: XYZ" badge shows in the auth modal
    setJoinVisible(false);
    setTeamInviteCode("");
    setErrorMessage("");
    setTimeout(() => {
      setIsLogin(false);
      setAuthVisible(true);
    }, 500);
  };

  // --- STEP 3: LOGIN / SIGNUP ACTION ---
  const handleAuthAction = async () => {
    setErrors({});
    const newErrors: any = {};

    if (!email.trim()) newErrors.email = "Required";
    if (!password.trim()) newErrors.password = "Required";

    if (!isLogin) {
      if (!firstName.trim()) newErrors.firstName = "Required";
      if (!lastName.trim()) newErrors.lastName = "Required";
      if (password.length > 0 && password.length < 6) {
        newErrors.password = "Min 6 characters";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const cleanJoinId = joinTeamId ? parseInt(joinTeamId, 10) : null;

      const signupData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        join_team_id: cleanJoinId,
      };

      const loginData = {
        email: email.trim().toLowerCase(),
        password,
      };

      const endpoint = isLogin ? ENDPOINTS.LOGIN : ENDPOINTS.SIGNUP;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLogin ? loginData : signupData),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.access_token) {
          await AsyncStorage.setItem("userToken", data.access_token);
        }

        if (data.user) {
          await AsyncStorage.multiSet([
            ["userId", String(data.user.id)],
            ["userFirstName", data.user.firstName || ""],
            ["userLastName", data.user.lastName || ""],
            ["userEmail", data.user.email || ""],
          ]);
        }

        setAuthVisible(false);

        setTimeout(() => {
          router.replace("/dashboard");
        }, 150);
      } else {
        Alert.alert("Account Error", data.detail || "Authentication failed");
      }
    } catch (err: any) {
      console.error("AUTH CRASH:", err);
      Alert.alert(
        "Connection Lost",
        "Server is unreachable. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  const closeAuth = () => {
    setAuthVisible(false);
    setErrors({});
    setJoinTeamId(null);
    setFoundTeam(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1526232759583-d6f44a1549bb?q=80&w=2049&auto=format&fit=crop",
        }}
        style={styles.background}
      >
        <View style={styles.navyOverlay}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              {/* Replaced Ionicons with your transparent custom logo */}
              <Image
                source={require("../assets/images/adaptive-icon.png")}
                style={styles.heroLogo}
                resizeMode="contain"
              />

              <Text style={styles.subtitle}>
                Manage your sports team like a pro.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  setIsLogin(false);
                  setAuthVisible(true);
                }}
              >
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setIsLogin(true);
                  setAuthVisible(true);
                }}
              >
                <Text style={styles.secondaryBtnText}>Log In</Text>
              </TouchableOpacity>

              {/* FIX: use closeJoinModal first to fully reset, then open fresh */}
              <TouchableOpacity
                style={styles.joinLink}
                onPress={() => {
                  closeJoinModal(); // wipe any leftover state from last session
                  setJoinVisible(true); // then open clean
                }}
              >
                <Text style={styles.joinLinkText}>
                  Have a team code? Join here
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* --- JOIN TEAM MODAL --- */}
      <Modal visible={joinVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View
            style={[styles.modalContent, { height: "auto", paddingBottom: 40 }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join a Team</Text>
              {/* FIX: X button now calls closeJoinModal instead of just setJoinVisible(false) */}
              <TouchableOpacity onPress={closeJoinModal}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {!foundTeam ? (
              <>
                <Text style={styles.modalSub}>
                  Enter the code provided by your coach.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="EX: XT7-9P2"
                  placeholderTextColor="#666"
                  autoCapitalize="characters"
                  value={teamInviteCode}
                  onChangeText={setTeamInviteCode}
                />
                {errorMessage ? (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleLookupTeam}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Find Team</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.foundTeamContainer}>
                <Ionicons
                  name={
                    foundTeam.is_closed ? "lock-closed" : "checkmark-circle"
                  }
                  size={50}
                  color={foundTeam.is_closed ? colors.coral : colors.teal}
                />
                <Text style={styles.foundText}>
                  {foundTeam.is_closed ? "Group Closed" : "Team Found!"}
                </Text>
                <Text style={styles.teamNameDisplay}>{foundTeam.name}</Text>

                {foundTeam.is_closed ? (
                  <>
                    {/* Message derived directly from foundTeam.is_closed — no state dependency */}
                    <Text style={styles.closedMessage}>
                      This group is closed and not accepting new members. You
                      can still sign up to join or create other teams!
                    </Text>
                    <TouchableOpacity
                      style={styles.submitBtn}
                      onPress={() => {
                        // FIX: closeJoinModal wipes foundTeam so the badge
                        // never appears in the auth modal
                        closeJoinModal();
                        setTimeout(() => {
                          setIsLogin(false);
                          setAuthVisible(true);
                        }, 500);
                      }}
                    >
                      <Text style={styles.submitBtnText}>Create Account</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={continueToSignup}
                  >
                    <Text style={styles.submitBtnText}>Continue to Signup</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- AUTH MODAL --- */}
      <Modal visible={authVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isLogin ? "Welcome Back" : "Create Account"}
              </Text>
              <TouchableOpacity onPress={closeAuth}>
                <Ionicons name="close" size={24} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            >
              {!isLogin && foundTeam?.name && (
                <View style={styles.joinBadge}>
                  <Text style={styles.joinBadgeText}>
                    Joining: {foundTeam.name}
                  </Text>
                </View>
              )}

              {!isLogin && (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>First Name</Text>
                      {errors.firstName && <View style={styles.errorDot} />}
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        errors.firstName && styles.inputErrorBorder,
                      ]}
                      placeholder="John"
                      placeholderTextColor="#666"
                      value={firstName}
                      onChangeText={(t) => {
                        setFirstName(t);
                        setErrors({ ...errors, firstName: "" });
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>Last Name</Text>
                      {errors.lastName && <View style={styles.errorDot} />}
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        errors.lastName && styles.inputErrorBorder,
                      ]}
                      placeholder="Doe"
                      placeholderTextColor="#666"
                      value={lastName}
                      onChangeText={(t) => {
                        setLastName(t);
                        setErrors({ ...errors, lastName: "" });
                      }}
                    />
                  </View>
                </View>
              )}

              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Email Address</Text>
                {errors.email && <View style={styles.errorDot} />}
              </View>
              <TextInput
                style={[styles.input, errors.email && styles.inputErrorBorder]}
                placeholder="email@example.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrors({ ...errors, email: "" });
                }}
              />

              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                {errors.password && <View style={styles.errorDot} />}
              </View>
              <TextInput
                style={[
                  styles.input,
                  errors.password && styles.inputErrorBorder,
                ]}
                placeholder="Min 6 characters"
                placeholderTextColor="#666"
                secureTextEntry
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrors({ ...errors, password: "" });
                }}
              />

              {isLogin && (
                <TouchableOpacity
                  style={{ alignSelf: "flex-end", marginBottom: 15, marginTop: 5 }}
                  onPress={() => {
                    setAuthVisible(false);
                    setTimeout(() => setResetVisible(true), 300); // Wait for modal animation
                  }}
                >
                  <Text style={{ color: colors.teal, fontSize: 13, fontWeight: "600" }}>
                    Forgot your password?
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleAuthAction}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isLogin ? "Login" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  marginTop: 20,
                  marginBottom: 20,
                  alignItems: "center",
                }}
                onPress={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
              >
                <Text style={{ color: colors.textSubtle }}>
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Log in"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PasswordResetModal
        visible={resetVisible}
        onClose={() => setResetVisible(false)}
        initialEmail={email}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ...baseStyles,
  heroLogo: {
    width: 90,
    height: 90,
    marginBottom: 10, // Adds a little breathing room between the logo and the "RosterHQ" text
  },
  background: { flex: 1, width: "100%" },
  navyOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 52, 96, 0.85)",
    justifyContent: "center",
    padding: 30,
  },
  content: { flex: 1, justifyContent: "space-between", paddingVertical: 50 },
  logoContainer: { alignItems: "center", marginTop: 50 },
  title: { color: "#FFF", fontSize: 42, fontWeight: "bold", letterSpacing: -1 },
  subtitle: {
    color: colors.textSubtle,
    fontSize: 18,
    marginTop: 10,
    textAlign: "center",
  },
  buttonContainer: { gap: 15 },
  primaryBtn: {
    backgroundColor: colors.teal,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  secondaryBtn: {
    backgroundColor: "transparent",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryBtnText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  joinLink: { marginTop: 10, alignSelf: "center" },
  joinLinkText: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  modalContent: {
    ...baseStyles.modalContent,
    paddingBottom: 10,
    maxHeight: "90%",
  },
  foundTeamContainer: { alignItems: "center", paddingVertical: 10 },
  foundText: { color: "#FFF", fontSize: 18, fontWeight: "bold", marginTop: 10 },
  teamNameDisplay: {
    color: colors.teal,
    fontSize: 28,
    fontWeight: "bold",
    marginVertical: 10,
    textAlign: "center",
  },
  closedMessage: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  joinBadge: {
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  joinBadgeText: {
    color: colors.teal,
    fontWeight: "bold",
    textAlign: "center",
  },
  row: { flexDirection: "row", marginBottom: 5 },
  submitBtn: {
    ...baseStyles.submitBtn,
    marginTop: 20,
  },
});
