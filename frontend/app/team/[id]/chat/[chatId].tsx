// app/team/[id]/chat/[chatId].tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../src/theme/ThemeContext";

// Mock Chat History
const INITIAL_MESSAGES = [
  {
    id: "1",
    text: "Hey Coach, what time do we need to be at the field on Sunday?",
    sender: "me",
    time: "10:00 AM",
  },
  {
    id: "2",
    text: "Try to get there 45 minutes early so we can run hitting drills.",
    sender: "them",
    time: "10:15 AM",
  },
];

export default function DirectMessageScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { id, chatId } = useLocalSearchParams();
  const router = useRouter();

  // 1. Grab the phone's physical safe area boundaries
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: "me",
      time: "Just now",
    };
    setMessages([...messages, newMessage]);
    setInputText("");
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === "me";
    return (
      <View
        style={[
          styles.messageBubbleWrapper,
          isMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
        </View>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User {chatId}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* 2. ADDED EXPLICIT KEYBOARD MATH HERE */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
      >
        {/* Chat History */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          // Forces the list to start from the bottom, like a real chat app!
          inverted={false}
        />

        {/* 3. DYNAMIC BOTTOM PADDING FOR NAVIGATION BUTTONS */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSubtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  },
  backButton: { padding: 4 },
  headerTitle: { color: colors.textMain, fontSize: 18, fontWeight: "bold" },

  chatContent: { padding: 16, paddingBottom: 20 },
  messageBubbleWrapper: { marginBottom: 16, maxWidth: "80%" },
  messageBubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageBubbleLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  messageBubble: { padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirBubble: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: "#FFF" },
  theirMessageText: { color: colors.textMain },
  timeText: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
  },

  // Removed hardcoded paddingBottom, it is now handled dynamically in the inline style!
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: colors.textMain,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendBtn: {
    padding: 10,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
