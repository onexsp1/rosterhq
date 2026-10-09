import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../theme/ThemeContext";
import { apiClient } from "../services/apiClient";

interface TeamHeaderProps {
  // We use this to inject the "Add Event" or "Leave" buttons later!
  rightComponent?: React.ReactNode;
}

export function TeamHeader({ rightComponent }: TeamHeaderProps) {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [teamData, setTeamData] = useState<{
    name: string;
    invite_code: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // The header fetches its own data! No need to do this in every tab.
  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!id) return;
      try {
        const response = await apiClient.get(`/teams/${id}`);
        if (response.ok) {
          const data = await response.json();
          setTeamData({
            name: data.name,
            invite_code: data.code || data.invite_code,
          });
        }
      } catch (e) {
        console.log("Header fetch error", e);
      }
    };
    fetchTeamDetails();
  }, [id]);

  const copyToClipboard = async () => {
    if (teamData?.invite_code) {
      await Clipboard.setStringAsync(teamData.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <View style={styles.header}>
      {/* Left Side: Back to Dashboard */}
      <TouchableOpacity onPress={() => router.back()} style={styles.sideCol}>
        <Ionicons name="chevron-back" size={28} color={colors.textMain} />
      </TouchableOpacity>

      {/* Center: Team Name & Badge */}
      <View style={styles.centerCol}>
        <Text style={styles.headerTeamName} numberOfLines={1}>
          {teamData?.name || "Loading..."}
        </Text>
        <TouchableOpacity style={styles.codeBadge} onPress={copyToClipboard}>
          <Text style={styles.codeLabel}>
            {copied
              ? "COPIED!"
              : `JOIN CODE: ${teamData?.invite_code || "---"}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right Side: Reserved for custom buttons (Leave, Add Event, etc) */}
      <View style={[styles.sideCol, { alignItems: "flex-end" }]}>
        {rightComponent}
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
  sideCol: {
    width: 60, // Fixed width keeps the center column perfectly centered
    justifyContent: "center",
  },
  centerCol: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  headerTeamName: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  codeBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeLabel: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
