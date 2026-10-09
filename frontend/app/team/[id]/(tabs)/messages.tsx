import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  DeviceEventEmitter,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useGlobalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../../../src/theme/ThemeContext";
import { useSocket } from "../../../../src/hooks/useSocket";
import { useAuth } from "../../../../src/hooks/useAuth";
import { apiClient } from "../../../../src/services/apiClient";
import { UserAvatar } from "../../../../src/components/UserAvatar";
import { TabTransition } from "../../../../src/components/TabTransition";
import { TeamHeader } from "@/src/components/TeamHeader";

// --- 1. DATE FORMATTERS ---
const formatMessageDate = (timestamp: any) => {
  if (!timestamp) return "";

  if (
    typeof timestamp === "string" &&
    /\d{1,2}:\d{2}\s?(AM|PM)/i.test(timestamp) &&
    timestamp.length < 12
  ) {
    return timestamp;
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${time} • ${day}`;
};

const formatStickyDate = (timestamp: any) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// --- 2. MEMOIZED COMPONENTS ---
const MessageItem = memo(
  ({ item, myId, colors, styles }: { item: any; myId: string | null; colors: any; styles: any }) => {
    const isMine = String(item.sender_id) === String(myId);

    return (
      <View
        style={[
          styles.messageWrapper,
          isMine ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
        ]}
      >
        <View
          style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}
        >
          <Text style={{ color: isMine ? "#FFF" : colors.textMain }}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {formatMessageDate(item.timestamp)}
        </Text>
      </View>
    );
  },
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id,
);

const MemberItem = memo(
  ({
    item,
    isSelected,
    onPress,
    colors,
    styles,
  }: {
    item: any;
    isSelected: boolean;
    onPress: (item: any) => void;
    colors: any;
    styles: any;
  }) => {
    const unreadCount = Number(item.unread_count) || 0;

    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        style={[styles.memberIconBtn, isSelected && styles.activeMemberBtn]}
      >
        <View style={styles.avatarSmall}>
          <UserAvatar
            uri={item.profile_picture}
            name={item.firstName}
            size={44}
          />
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.memberNameSmall} numberOfLines={1}>
          {item.firstName}
        </Text>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.unread_count === nextProps.item.unread_count &&
      prevProps.isSelected === nextProps.isSelected
    );
  },
);

const ChatInputBox = memo(
  ({
    onSend,
    isSending,
    bottomInset,
    colors,
    styles,
  }: {
    onSend: (text: string) => void;
    isSending: boolean;
    bottomInset: number;
    colors: any;
    styles: any;
  }) => {
    const [text, setText] = useState("");

    const handlePress = () => {
      if (!text.trim() || isSending) return;
      onSend(text.trim());
      setText("");
    };

    return (
      <View
        style={[
          styles.inputArea,
          {
            paddingBottom:
              Platform.OS === "ios" ? Math.max(bottomInset, 15) : 15,
          },
        ]}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Message..."
          placeholderTextColor={colors.textSubtle}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          onPress={handlePress}
          style={styles.sendBtn}
          disabled={!text.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    );
  },
);

// --- 3. MAIN SCREEN COMPONENT ---
export default function MessagesScreen() {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors, mode);
  const { id, isClosed } = useGlobalSearchParams();
  const teamIsClosed = isClosed === "true";

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId: myId } = useAuth();
  const { addListener } = useSocket(myId);

  const [members, setMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList<any>>(null);

  // --- INSTANT LOCK REF TO PREVENT DOUBLE FETCHING ---
  const isLoadingMoreRef = useRef(false);

  // --- FLOATING DATE STATE & LOGIC ---
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeOutTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const topItem = viewableItems[viewableItems.length - 1].item;
      const stickyString = formatStickyDate(topItem.timestamp);

      if (stickyString) {
        setVisibleDate(stickyString);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();

        if (fadeOutTimeout.current) clearTimeout(fadeOutTimeout.current);
        fadeOutTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, 2000);
      }
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // --- SYNC RED DOT WITH TAB BAR ---
  useEffect(() => {
    const totalUnread = members.reduce(
      (sum, member) => sum + (Number(member.unread_count) || 0),
      0,
    );
    if (totalUnread === 0) DeviceEventEmitter.emit("clear_chat_badge");
    else DeviceEventEmitter.emit("set_chat_badge");
  }, [members]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedMember(null);
      };
    }, []),
  );

  const markAsRead = useCallback(
    async (memberUserId: number) => {
      if (!id || id === "undefined") return;
      try {
        await apiClient.post(`/teams/${id}/messages/${memberUserId}/read`);
        setMembers((prev) =>
          prev.map((m) =>
            String(m.id) === String(memberUserId)
              ? { ...m, unread_count: 0 }
              : m,
          ),
        );
      } catch (e) {
        console.error("Mark read error:", e);
      }
    },
    [id],
  );

  const fetchMembers = useCallback(async () => {
    if (!id || id === "undefined" || !myId) return;
    setIsLoadingMembers(true);
    try {
      const response = await apiClient.get(`/teams/${id}/members`);
      if (response.ok) {
        const data = await response.json();
        const filteredTeammates = data.filter(
          (m: any) => String(m.id) !== String(myId),
        );
        setMembers(filteredTeammates);
      }
    } catch (e) {
      console.error("Member Fetch Error:", e);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [id, myId]);

  const fetchChat = useCallback(async () => {
    if (!selectedMember?.id || !id || id === "undefined") return;
    setIsLoadingChat(true);
    try {
      const response = await apiClient.get(
        `/teams/${id}/messages/${selectedMember.id}?skip=0&limit=20`,
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setHasMore(data.length === 20);
      }
    } catch (e) {
      console.error("Error fetching chat:", e);
    } finally {
      setIsLoadingChat(false);
    }
  }, [id, selectedMember?.id]);

  // --- BULLETPROOF PAGINATION ---
  const loadMoreMessages = useCallback(async () => {
    if (!selectedMember?.id || !id || isLoadingMoreRef.current || !hasMore)
      return;

    isLoadingMoreRef.current = true; // INSTANT LOCK
    setIsLoadingMore(true);

    try {
      const response = await apiClient.get(
        `/teams/${id}/messages/${selectedMember.id}?skip=${messages.length}&limit=20`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length < 20) setHasMore(false);

        // DEDUPLICATION FIX: Merge unique messages only
        setMessages((prev) => {
          const combined = [...prev, ...data];
          return Array.from(new Map(combined.map((m) => [m.id, m])).values());
        });
      }
    } catch (e) {
      console.error("Load More Error:", e);
    } finally {
      isLoadingMoreRef.current = false; // UNLOCK
      setIsLoadingMore(false);
    }
  }, [id, selectedMember?.id, hasMore, messages.length]);

  useEffect(() => {
    if (id && myId) fetchMembers();
  }, [id, myId, fetchMembers]);

  // --- CLEAN SWITCHING LOGIC ---
  useEffect(() => {
    if (selectedMember?.id) {
      setMessages([]); // Immediately clear old chat so we don't accidentally paginate it
      setHasMore(true);
      fetchChat();
    } else {
      setMessages([]);
    }
  }, [selectedMember?.id]); // Only depend on ID to prevent loops

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("network_restored", () => {
      fetchMembers();
      if (selectedMember?.id) {
        setIsLoadingChat(true);
        fetchChat();
      }
    });
    return () => sub.remove();
  }, [fetchMembers, fetchChat, selectedMember?.id]);

  useEffect(() => {
    if (myId && addListener) {
      return addListener((msg: any) => {
        if (msg.type === "new_message") {
          const senderIdStr = String(msg.sender_id);
          const selectedIdStr = String(selectedMember?.id);

          if (senderIdStr === selectedIdStr) {
            setMessages((prev) => {
              // DEDUPLICATION: Don't add if already exists
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [msg, ...prev];
            });
            markAsRead(msg.sender_id);
          } else {
            setMembers((prev) =>
              prev.map((m) =>
                String(m.id) === senderIdStr
                  ? { ...m, unread_count: (m.unread_count || 0) + 1 }
                  : m,
              ),
            );
          }
        }
      });
    }
  }, [myId, selectedMember?.id, addListener, markAsRead]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedMember || isSending || !id) return;
      setIsSending(true);

      try {
        const response = await apiClient.post(
          `/teams/${id}/messages/${selectedMember.id}`,
          { content },
        );
        if (response.ok) {
          const newMsg = await response.json();
          setMessages((prev) => {
            // DEDUPLICATION: Don't add if already exists
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        }
      } catch (e) {
        console.error("Failed to send message:", e);
      } finally {
        setIsSending(false);
      }
    },
    [id, selectedMember, isSending],
  );

  // Handle Mark as Read outside of useEffect to stop re-fetches
  const handleSelectMember = useCallback(
    (item: any) => {
      setSelectedMember(item);
      if (item.unread_count > 0) markAsRead(item.id);
    },
    [markAsRead],
  );

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      return <MessageItem item={item} myId={myId} colors={colors} styles={styles} />;
    },
    [myId, colors, styles],
  );

  const renderMember = useCallback(
    ({ item }: { item: any }) => {
      return (
        <MemberItem
          item={item}
          isSelected={selectedMember?.id === item.id}
          onPress={handleSelectMember}
          colors={colors}
          styles={styles}
        />
      );
    },
    [selectedMember?.id, handleSelectMember, colors, styles],
  );

  if (!id || id === "undefined") {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#FFF" }}>No Team ID found.</Text>
      </View>
    );
  }

  return (
    <TabTransition>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <TeamHeader />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 100}
        >
          <View style={styles.mainContent}>
            <View style={styles.leftColumn}>
              {isLoadingMembers ? (
                <ActivityIndicator
                  color={colors.teal}
                  style={{ marginTop: 20 }}
                />
              ) : (
                <FlatList
                  data={members}
                  keyExtractor={(item) => `mem-${item.id}`}
                  renderItem={renderMember}
                  ListEmptyComponent={
                    <Text style={styles.miniEmptyText}>No members.</Text>
                  }
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={8}
                  windowSize={5}
                />
              )}
            </View>

            <View style={styles.rightColumn}>
              {visibleDate && (
                <Animated.View
                  style={[styles.floatingDateContainer, { opacity: fadeAnim }]}
                >
                  <Text style={styles.floatingDateText}>{visibleDate}</Text>
                </Animated.View>
              )}

              {!selectedMember ? (
                <View style={styles.placeholderContainer}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={40}
                      color={colors.textSubtle}
                    />
                  </View>
                  <Text style={styles.placeholderTitle}>Your Messages</Text>
                  <Text style={styles.placeholderSub}>
                    Select a teammate from the left to start a conversation.
                  </Text>
                </View>
              ) : (
                <>
                  {isLoadingChat ? (
                    <View style={styles.center}>
                      <ActivityIndicator color={colors.teal} />
                    </View>
                  ) : (
                    <FlatList
                      ref={flatListRef}
                      data={messages}
                      inverted
                      keyExtractor={(item) => `msg-${item.id}`}
                      renderItem={renderMessage}
                      onViewableItemsChanged={onViewableItemsChanged}
                      viewabilityConfig={viewabilityConfig}
                      onEndReached={loadMoreMessages}
                      onEndReachedThreshold={0.5}
                      ListFooterComponent={
                        isLoadingMore ? (
                          <ActivityIndicator
                            color={colors.teal}
                            style={{ margin: 20 }}
                          />
                        ) : null
                      }
                      contentContainerStyle={
                        messages.length === 0
                          ? {
                              flex: 1,
                              justifyContent: "center",
                              alignItems: "center",
                            }
                          : { paddingVertical: 10 }
                      }
                      keyboardShouldPersistTaps="handled"
                      ListEmptyComponent={
                        <View
                          style={{
                            transform: [{ rotate: "180deg" }],
                            alignItems: "center",
                          }}
                        >
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={50}
                            color="rgba(255,255,255,0.2)"
                            style={{ marginBottom: 10 }}
                          />
                          <Text style={styles.emptyText}>
                            No history found.
                          </Text>
                        </View>
                      }
                      initialNumToRender={15}
                      maxToRenderPerBatch={10}
                      windowSize={10}
                    />
                  )}

                  {!teamIsClosed ? (
                    <ChatInputBox
                      onSend={handleSendMessage}
                      isSending={isSending}
                      bottomInset={insets.bottom}
                      colors={colors}
                      styles={styles}
                    />
                  ) : (
                    <View
                      style={[
                        styles.inputArea,
                        {
                          paddingBottom: Math.max(insets.bottom, 20),
                          justifyContent: "center",
                          backgroundColor: "rgba(211, 47, 47, 0.05)",
                        },
                      ]}
                    >
                      <Ionicons
                        name="lock-closed"
                        size={14}
                        color={colors.textSubtle}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{
                          color: colors.textSubtle,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        Chat is disabled for archived groups.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TabTransition>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: { color: colors.textMain, fontSize: 16, fontWeight: "bold" },
  mainContent: { flex: 1, flexDirection: "row" },

  leftColumn: {
    width: 85,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  memberIconBtn: { alignItems: "center", paddingVertical: 15 },
  activeMemberBtn: {
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
    position: "relative",
  },
  memberNameSmall: {
    color: colors.textSubtle,
    fontSize: 10,
    marginTop: 4,
    width: "90%",
    textAlign: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: colors.background,
    zIndex: 10,
  },
  miniEmptyText: {
    color: colors.textSubtle,
    fontSize: 9,
    textAlign: "center",
    marginTop: 10,
  },

  rightColumn: { flex: 1 },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  placeholderTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  placeholderSub: {
    color: colors.textSubtle,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  messageWrapper: { marginBottom: 12, width: "100%", paddingHorizontal: 10 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 18, marginBottom: 4 },
  myBubble: { backgroundColor: colors.teal, borderBottomRightRadius: 2 },
  theirBubble: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: mode === 'light' ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)",
  },
  messageTime: {
    fontSize: 10,
    color: colors.textSubtle,
    marginHorizontal: 4,
  },
  emptyText: {
    color: colors.textSubtle,
    textAlign: "center",
    marginTop: 40,
    fontStyle: "italic",
  },

  inputArea: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: mode === 'light' ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)",
  },
  textInput: {
    flex: 1,
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    color: colors.textMain,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.teal,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  floatingDateContainer: {
    position: "absolute",
    top: 15,
    alignSelf: "center",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
    borderWidth: 1,
    borderColor: mode === 'light' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingDateText: {
    color: colors.textMain,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
