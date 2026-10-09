import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { baseStyles, getSharedStyles } from "../src/theme/sharedStyles";
import { useTheme } from "../src/theme/ThemeContext";
import { apiClient } from "../src/services/apiClient";
import { useAuth } from "../src/hooks/useAuth";
import { LeaveTeamButton } from "@/src/components/LeaveTeamButton";
import { CloseTeamButton } from "@/src/components/CloseTeamButton";
import { ReopenTeamButton } from "@/src/components/ReopenTeamButton";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const styles = getStyles(colors, mode);

  // --- DATA STATE ---
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userId, userName, userEmail } = useAuth();

  // --- NOTIFICATION BANNER STATE ---
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  // --- MODAL & FORM STATE ---
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [showNameError, setShowNameError] = useState(false);

  // --- JOIN TEAM STATE ---
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // --- EXPANDING FAB STATE ---
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
    setFabOpen(!fabOpen);
  };

  // --- NOTIFICATION LOGIC ---
  const showNotification = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setNotification({ message, type });

    Animated.spring(bannerAnim, {
      toValue: Platform.OS === "ios" ? 20 : 10,
      useNativeDriver: true,
      friction: 8,
    }).start();

    setTimeout(() => {
      Animated.timing(bannerAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setNotification(null));
    }, 3000);
  };

  // --- BACKEND: FETCH TEAMS ---
  const fetchTeams = async () => {
    try {
      const response = await apiClient.get("/teams");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Connection Error", "Could not reach the server.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTeams();
    }, []),
  );

  // --- HELPERS ---
  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      if (i === 3) code += "-";
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleOpenCreateModal = () => {
    setNewTeamName("");
    setNewTeamCode(generateRandomCode());
    setShowNameError(false);
    setIsCreateModalVisible(true);
  };

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    showNotification("Team code copied to clipboard!", "success");
  };

  // --- CREATE TEAM ---
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      setShowNameError(true);
      return;
    }

    try {
      const response = await apiClient.post("/teams", {
        name: newTeamName.trim(),
        code: newTeamCode,
      });

      if (response.ok) {
        setIsCreateModalVisible(false);
        setNewTeamName("");
        fetchTeams();
        showNotification("Team created successfully!", "success");
      } else {
        const data = await response.json();
        Alert.alert("Error", data.detail || "Failed to create team");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    }
  };

  // --- JOIN TEAM ---
  const handleJoinTeam = async () => {
    if (!joinCode.trim()) {
      setJoinError("Please enter a valid invite code.");
      return;
    }

    setIsJoining(true);
    setJoinError("");

    try {
      const response = await apiClient.post("/teams/join", {
        code: joinCode.trim(),
      });

      if (response.ok) {
        setIsJoinModalVisible(false);
        setJoinCode("");
        fetchTeams();
        showNotification("Successfully joined the team!", "success");
      } else {
        const data = await response.json();
        setJoinError(data.detail || "Invalid code or team not found.");
      }
    } catch (error) {
      setJoinError("Network error. Please check your connection.");
    } finally {
      setIsJoining(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  // --- RENDER TEAM CARD ---
  const renderTeamCard = ({ item }: { item: any }) => (
    <View style={styles.teamCardContainer}>
      <TouchableOpacity
        style={styles.teamCardMain}
        onPress={() =>
          router.push({
            pathname: "/team/[id]",
            params: {
              id: item.id,
              name: item.name,
              isAdmin: item.isAdmin ? "true" : "false",
              isClosed: item.is_closed ? "true" : "false",
            } as any,
          })
        }
      >
        <View style={styles.teamInfo}>
          <Text style={styles.teamNameText}>{item.name}</Text>
          <View style={styles.badgeRow}>
            {item.isAdmin && (
              <View
                style={[
                  styles.memberBadge,
                  { backgroundColor: "rgba(255, 193, 7, 0.15)" },
                ]}
              >
                <Ionicons name="star" size={12} color="#FFC107" />
                <Text style={[styles.memberBadgeText, { color: "#FFC107" }]}>
                  ADMIN
                </Text>
              </View>
            )}
            {item.is_closed ? (
              <View
                style={[
                  styles.memberBadge,
                  { backgroundColor: "rgba(244, 67, 54, 0.15)" },
                ]}
              >
                <Ionicons name="lock-closed" size={12} color="#F44336" />
                <Text style={[styles.memberBadgeText, { color: "#F44336" }]}>
                  CLOSED
                </Text>
              </View>
            ) : (
              <View style={styles.memberBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={12}
                  color={colors.teal}
                />
                <Text style={styles.memberBadgeText}>ACTIVE MEMBER</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={22}
          color={colors.textSubtle}
        />
      </TouchableOpacity>

      <View style={styles.cardBottomRow}>
        <TouchableOpacity
          style={styles.cardActionArea}
          onPress={() => copyToClipboard(item.code)}
        >
          <Text style={styles.cardCodeLabel}>INVITE CODE: {item.code}</Text>
          <Ionicons name="copy-outline" size={14} color={colors.textSubtle} />
        </TouchableOpacity>

        {item.isAdmin ? (
          item.is_closed ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ReopenTeamButton
                teamId={item.id}
                teamName={item.name}
                onReopenTeam={() => {
                  fetchTeams();
                  showNotification(`${item.name} is open again!`, "success");
                }}
              />
              <LeaveTeamButton
                teamId={item.id}
                teamName={item.name}
                onLeftTeam={() => {
                  fetchTeams();
                  showNotification(`You left ${item.name}`, "info");
                }}
              />
            </View>
          ) : (
            <CloseTeamButton
              teamId={item.id}
              teamName={item.name}
              onCloseTeam={() => {
                fetchTeams();
                showNotification(`${item.name} has been closed.`, "info");
              }}
            />
          )
        ) : (
          <LeaveTeamButton
            teamId={item.id}
            teamName={item.name}
            onLeftTeam={() => {
              fetchTeams();
              showNotification(`You have left ${item.name}`, "info");
            }}
          />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {notification && (
        <Animated.View
          style={[
            styles.notificationBanner,
            { transform: [{ translateY: bannerAnim }] },
            notification.type === "success"
              ? styles.successBanner
              : styles.infoBanner,
          ]}
        >
          <Ionicons
            name={
              notification.type === "success"
                ? "checkmark-circle"
                : "information-circle"
            }
            size={20}
            color="#FFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.notificationText}>{notification.message}</Text>
        </Animated.View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>
            Welcome back, {userName?.split(" ")[0]} 👋
          </Text>
          <Text style={styles.headerTitle}>My Teams</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/settings")}
          >
            <Ionicons
              name="settings-outline"
              size={28}
              color={colors.textMain}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENT */}
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.teal}
          style={{ marginTop: 50 }}
        />
      ) : (
        <View style={styles.content}>
          {teams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="apps-outline"
                size={80}
                color="rgba(255,255,255,0.05)"
              />
              <Text style={styles.emptyTitle}>No Teams Yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the floating + button below to create or join a team.
              </Text>
            </View>
          ) : (
            <FlatList
              data={teams}
              renderItem={renderTeamCard}
              keyExtractor={(item) => item.id.toString()}
              refreshing={refreshing}
              onRefresh={onRefresh}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}


      {/* EXPANDING FLOATING ACTION BUTTON */}
      {!isLoading && (
        <>
          {/* Backdrop to dismiss FAB */}
          {fabOpen && (
            <TouchableWithoutFeedback onPress={toggleFab}>
              <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} />
            </TouchableWithoutFeedback>
          )}

          {/* FAB Stack — column, anchored bottom-right */}
          <View style={styles.fabStack}>
            {/* Join Team mini-button */}
            <Animated.View
              style={[
                styles.miniFabRow,
                {
                  opacity: fabAnim,
                  transform: [
                    { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                    { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.miniFabLabel}>Join Team</Text>
              <TouchableOpacity
                style={[styles.miniFab, { backgroundColor: colors.sky }]}
                onPress={() => { toggleFab(); setJoinCode(""); setIsJoinModalVisible(true); }}
              >
                <Ionicons name="enter-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            {/* Create Team mini-button */}
            <Animated.View
              style={[
                styles.miniFabRow,
                {
                  opacity: fabAnim,
                  transform: [
                    { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                    { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.miniFabLabel}>Create Team</Text>
              <TouchableOpacity
                style={[styles.miniFab, { backgroundColor: colors.teal }]}
                onPress={() => { toggleFab(); handleOpenCreateModal(); }}
              >
                <Ionicons name="add" size={22} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            {/* Main FAB */}
            <TouchableOpacity style={styles.mainFab} onPress={toggleFab} activeOpacity={0.85}>
              <Animated.View
                style={{
                  transform: [
                    { rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
                  ],
                }}
              >
                <Ionicons name="add" size={32} color="#FFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ─── CREATE TEAM MODAL ─────────────────────────────────────────────────
          FIX: KAV is now the outermost child of Modal (not nested inside View).
          The dark backdrop is a separate absoluteFill pressable so it doesn't
          interfere with KAV's layout measurement.
      ──────────────────────────────────────────────────────────────────────── */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Team</Text>
              <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={colors.textSubtle}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>TEAM NAME</Text>
            <TextInput
              style={[
                styles.input,
                showNameError && {
                  borderColor: colors.coral,
                  borderWidth: 1.5,
                },
              ]}
              placeholder="e.g. Providence Prospects"
              placeholderTextColor="#dbd5d5ff"
              value={newTeamName}
              autoFocus
              onChangeText={(t) => {
                setNewTeamName(t);
                if (t.trim()) setShowNameError(false);
              }}
            />
            {showNameError && (
              <Text style={styles.errorText}>Please enter a team name</Text>
            )}

            <Text style={styles.inputLabel}>INVITATION CODE</Text>
            <View style={styles.codeRow}>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{newTeamCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(newTeamCode)}
              >
                <Ionicons name="copy-outline" size={22} color={colors.teal} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateTeam}>
              <Text style={styles.saveBtnText}>Confirm & Create</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── JOIN TEAM MODAL ───────────────────────────────────────────────────
          Same fix: KAV outermost, absoluteFill backdrop as sibling.
      ──────────────────────────────────────────────────────────────────────── */}
      <Modal visible={isJoinModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join a Team</Text>
              <TouchableOpacity onPress={() => setIsJoinModalVisible(false)}>
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={colors.textSubtle}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>TEAM INVITE CODE</Text>
            <TextInput
              style={[
                styles.input,
                {
                  textTransform: "uppercase",
                  fontSize: 22,
                  letterSpacing: 3,
                  textAlign: "center",
                },
                joinError
                  ? { borderColor: colors.coral, borderWidth: 1.5 }
                  : null,
              ]}
              placeholder="e.g. A1B-2C3"
              placeholderTextColor="#dbd5d5ff"
              value={joinCode}
              autoCapitalize="characters"
              autoFocus
              onChangeText={(t) => {
                setJoinCode(t.toUpperCase());
                if (t.trim()) setJoinError("");
              }}
            />
            {joinError ? (
              <Text
                style={[
                  styles.errorText,
                  { textAlign: "center", marginTop: 12 },
                ]}
              >
                {joinError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { marginTop: 25, backgroundColor: colors.teal },
              ]}
              onPress={handleJoinTeam}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Join Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  ...getSharedStyles(colors),
  notificationBanner: {
    position: "absolute",
    left: "10%",
    right: "10%",
    height: 45,
    borderRadius: 22.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 8 },
    }),
  },
  successBanner: { backgroundColor: colors.teal },
  infoBanner: { backgroundColor: colors.primary },
  notificationText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },

  badgeRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  memberBadgeText: { color: colors.teal, fontSize: 10, fontWeight: "900" },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 10,
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.15)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 25,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginRight: 15 },
  greetingText: { color: colors.textSubtle, fontSize: 14, fontWeight: "500" },
  headerTitle: {
    color: colors.textMain,
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: -0.5,
  },
  content: { flex: 1 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  teamCardContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  teamCardMain: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardActionArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    gap: 8,
  },
  cardCodeLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  teamNameText: { color: colors.textMain, fontSize: 20, fontWeight: "bold" },
  teamInfo: { flex: 1 },
  fabStack: {
    position: "absolute",
    bottom: 100,
    right: 20,
    alignItems: "flex-end",
    zIndex: 99,
    gap: 12,
  },
  mainFab: {
    backgroundColor: colors.teal,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  miniFabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  miniFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  miniFabLabel: {
    color: colors.textMain,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "bold",
    marginRight: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modalHeader: {
    ...getSharedStyles(colors).modalHeader,
    marginBottom: 25,
  },
  inputLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 20,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)",
    color: colors.textMain,
    padding: 18,
    borderRadius: 15,
    fontSize: 16,
  },
  errorText: {
    color: colors.coral,
    fontSize: 13,
    marginTop: 8,
    fontWeight: "600",
  },
  codeRow: { flexDirection: "row", alignItems: "center" },
  readOnlyInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  readOnlyText: {
    color: colors.teal,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 4,
  },
  copyBtn: {
    marginLeft: 15,
    padding: 15,
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    borderRadius: 15,
  },
  saveBtn: {
    ...getSharedStyles(colors).submitBtn,
    padding: 20,
    borderRadius: 18,
    marginTop: 40,
  },
  saveBtnText: { ...getSharedStyles(colors).submitBtnText },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyTitle: {
    color: colors.textMain,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 15,
  },
  emptySubtext: {
    color: colors.textSubtle,
    textAlign: "center",
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },
});
