import React, { useState } from "react";
import { TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../services/apiClient";

interface LeaveTeamButtonProps {
  teamId: string;
  teamName: string; // Added to make the alert more personal
  onLeftTeam: () => void; // A function to refresh the dashboard list!
}

export function LeaveTeamButton({
  teamId,
  teamName,
  onLeftTeam,
}: LeaveTeamButtonProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeave = () => {
    Alert.alert(
      `Leave ${teamName}?`,
      "Are you sure you want to leave this team? You will need a new invite code to rejoin.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: performLeave },
      ],
    );
  };

  const performLeave = async () => {
    setIsLeaving(true);
    try {
      const response = await apiClient.delete(`/teams/${teamId}/leave`);
      if (response.ok) {
        // Trigger the dashboard to remove this team from the screen
        onLeftTeam();
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.detail || "Could not leave the team.");
      }
    } catch (e) {
      Alert.alert("Network Error", "Check your connection and try again.");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleLeave}
      disabled={isLeaving}
      style={{
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 20,
      }}
    >
      {isLeaving ? (
        <ActivityIndicator size="small" color="#D32F2F" />
      ) : (
        <Ionicons name="exit-outline" size={20} color="#D32F2F" />
      )}
    </TouchableOpacity>
  );
}
