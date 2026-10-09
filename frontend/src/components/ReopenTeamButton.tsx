import React, { useState } from "react";
import { TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../services/apiClient";
import { colors } from "../theme/colors"; // Make sure this path is correct!

interface ReopenTeamButtonProps {
  teamId: string | number;
  teamName: string;
  onReopenTeam: () => void;
}

export function ReopenTeamButton({
  teamId,
  teamName,
  onReopenTeam,
}: ReopenTeamButtonProps) {
  const [isReopening, setIsReopening] = useState(false);

  const handleReopen = () => {
    Alert.alert(
      `Reopen ${teamName}?`,
      "This will unlock the group. Members will be able to post and message again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reopen Group", onPress: performReopen },
      ],
    );
  };

  const performReopen = async () => {
    setIsReopening(true);
    try {
      const response = await apiClient.put(`/teams/${teamId}/reopen`);
      if (response.ok) {
        onReopenTeam(); // Trigger the dashboard to refresh
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.detail || "Could not reopen the team.");
      }
    } catch (e) {
      Alert.alert("Network Error", "Check your connection and try again.");
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleReopen}
      disabled={isReopening}
      style={{
        padding: 8,
        backgroundColor: "rgba(20, 184, 166, 0.15)", // Teal tinted background
        borderRadius: 20,
      }}
    >
      {isReopening ? (
        <ActivityIndicator size="small" color={colors.teal} />
      ) : (
        <Ionicons name="lock-open" size={20} color={colors.teal} />
      )}
    </TouchableOpacity>
  );
}
