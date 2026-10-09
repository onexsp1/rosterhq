import React, { useState } from "react";
import { TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../services/apiClient";

interface CloseTeamButtonProps {
  teamId: string | number;
  teamName: string;
  onCloseTeam: () => void;
}

export function CloseTeamButton({
  teamId,
  teamName,
  onCloseTeam,
}: CloseTeamButtonProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    Alert.alert(
      `Close ${teamName}?`,
      "Are you sure? This will freeze the group. Members will no longer be able to post or message.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Close Group", style: "destructive", onPress: performClose },
      ],
    );
  };

  const performClose = async () => {
    setIsClosing(true);
    try {
      const response = await apiClient.put(`/teams/${teamId}/close`);
      if (response.ok) {
        onCloseTeam(); // Trigger the dashboard to refresh
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.detail || "Could not close the team.");
      }
    } catch (e) {
      Alert.alert("Network Error", "Check your connection and try again.");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleClose}
      disabled={isClosing}
      style={{
        padding: 8,
        backgroundColor: "rgba(244, 67, 54, 0.1)", // Red tinted background
        borderRadius: 20,
      }}
    >
      {isClosing ? (
        <ActivityIndicator size="small" color="#F44336" />
      ) : (
        <Ionicons name="lock-closed" size={20} color="#F44336" />
      )}
    </TouchableOpacity>
  );
}
