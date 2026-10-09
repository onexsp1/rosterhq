import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGlobalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../src/theme/ThemeContext";
import { BASE_URL } from "../../../../src/constants/api";
import { apiClient } from "../../../../src/services/apiClient";
import { useAuth } from "../../../../src/hooks/useAuth";
import { UserAvatar } from "../../../../src/components/UserAvatar";
import { Image } from "expo-image";
import { TeamHeader } from "@/src/components/TeamHeader";
import { TabTransition } from "../../../../src/components/TabTransition";

export default function MembersScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { id } = useGlobalSearchParams();
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { userId: currentUserId } = useAuth();
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [inviteCode, setInviteCode] = useState("Loading...");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- THE FIX: ADD 'id' TO DEPENDENCIES ---
  // This ensures that when Expo Router finally provides the ID, the functions run.
  useEffect(() => {
    if (!id || id === "undefined") return;
    fetchMembers();
    fetchTeamDetails();
  }, [id, currentUserId]);

  // Re-fetch on every tab focus so profile pics update immediately after editing
  useFocusEffect(
    React.useCallback(() => {
      if (!id || id === "undefined") return;
      fetchMembers();
    }, [id]),
  );

  const fetchTeamDetails = async () => {
    try {
      const response = await apiClient.get(`/teams/${id}`);
      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.invite_code || data.code);
      }
    } catch (error) {
      console.error("Error fetching team details", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiClient.get(`/teams/${id}/members`);

      if (response.ok) {
        const data = await response.json();
        setMembers(data);

        // Check if YOU are an admin to show/hide the invite & toggle buttons
        const myRecord = data.find(
          (m: any) => m.id.toString() === currentUserId?.toString(),
        );
        if (myRecord) {
          setCurrentUserIsAdmin(myRecord.isAdmin === true);
        }
      }
    } catch (error) {
      console.error("Fetch members failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMembers(), fetchTeamDetails()]);
    setIsRefreshing(false);
  };

  const handleToggleAdmin = (
    memberId: string,
    currentAdminStatus: boolean,
    memberName: string,
  ) => {
    const actionText = currentAdminStatus ? "revoke" : "make";
    const newStatus = !currentAdminStatus;

    Alert.alert(
      `${currentAdminStatus ? "Revoke" : "Make"} Admin?`,
      `Are you sure you want to ${actionText} ${memberName}'s admin rights?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: currentAdminStatus ? "destructive" : "default",
          onPress: () => updateAdminStatus(memberId, newStatus),
        },
      ],
    );
  };

  const updateAdminStatus = async (memberId: string, newStatus: boolean) => {
    try {
      const response = await apiClient.post(
        `/teams/${id}/members/${memberId}/toggle-admin`,
        {
          is_admin: newStatus,
        },
      );

      if (response.ok) {
        setMembers((current) =>
          current.map((member) =>
            member.id.toString() === memberId.toString()
              ? { ...member, isAdmin: newStatus }
              : member,
          ),
        );
      } else {
        Alert.alert("Error", "Could not update role.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Please check your connection.");
    }
  };

  const handleShowGroupCode = () => {
    Alert.alert(
      "Team Invite Code",
      `Share this code with players and parents:\n\n${inviteCode}`,
      [{ text: "Done", style: "cancel" }],
    );
  };
  const renderMember = ({ item }: { item: any }) => {
    const isMe = item.id.toString() === currentUserId?.toString();

    return (
      <View style={styles.memberCard}>
        <UserAvatar
          uri={item.profile_picture}
          name={`${item.firstName} ${item.lastName}`}
          size={50}
        />

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName}>
              {item.firstName} {item.lastName}
            </Text>
            {isMe && <Text style={styles.meBadge}>(You)</Text>}
          </View>
          <Text style={styles.memberRole}>{item.role}</Text>

          {item.isAdmin === true && (
            <View style={styles.adminBadge}>
              <Ionicons
                name="shield-checkmark"
                size={12}
                color={colors.teal}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        {/* Action buttons only show if YOU are admin and this card isn't YOURS */}
        {currentUserIsAdmin && !isMe && (
          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={item.isAdmin ? styles.removeAdminBtn : styles.makeAdminBtn}
              onPress={() =>
                handleToggleAdmin(item.id, item.isAdmin, item.firstName)
              }
            >
              <Text
                style={
                  item.isAdmin ? styles.removeAdminText : styles.makeAdminText
                }
              >
                {item.isAdmin ? "Revoke" : "Make Admin"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <TabTransition>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <TeamHeader />

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: colors.textSubtle }}>
                No members found in this team.
              </Text>
            </View>
          }
        />
      )}
      </SafeAreaView>
    </TabTransition>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.background,
  },
  backButton: { padding: 4 },
  headerTitle: { color: colors.textMain, fontSize: 18, fontWeight: "bold" },
  inviteBtn: {
    padding: 8,
    backgroundColor: "rgba(25, 118, 210, 0.1)",
    borderRadius: 12,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.02)",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  avatarInitials: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  infoColumn: { flex: 1, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  memberName: { color: colors.textMain, fontSize: 16, fontWeight: "bold" },
  meBadge: { color: colors.textSubtle, fontSize: 13, marginLeft: 6 },
  memberRole: { color: colors.textSubtle, fontSize: 14, marginBottom: 4 },
  adminBadge: { flexDirection: "row", alignItems: "center" },
  adminBadgeText: { color: colors.teal, fontSize: 12, fontWeight: "700" },
  actionColumn: { marginLeft: 12 },
  makeAdminBtn: {
    backgroundColor: "rgba(42, 157, 143, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(42, 157, 143, 0.3)",
  },
  makeAdminText: { color: colors.teal, fontSize: 12, fontWeight: "bold" },
  removeAdminBtn: {
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  removeAdminText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "600",
  },
});
