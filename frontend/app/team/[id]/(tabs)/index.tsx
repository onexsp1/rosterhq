import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../../src/theme/ThemeContext";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useAuth } from "../../../../src/hooks/useAuth";
import { apiClient } from "../../../../src/services/apiClient";
import { PostItem } from "../../../../src/components/PostItem";
import { LeaveTeamButton } from "../../../../src/components/LeaveTeamButton";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { TabTransition } from "../../../../src/components/TabTransition";
import { TeamHeader } from "@/src/components/TeamHeader";

// --- 1. NEW DATE FORMATTERS ---
const getSafeDate = (item: any) => {
  return item?.created_at || item?.timestamp || item?.date || "";
};

const formatPostDate = (timestamp: any) => {
  if (!timestamp) return "";

  // If the backend is still sending "12:30 PM", just return it to prevent crash
  if (
    typeof timestamp === "string" &&
    /\d{1,2}:\d{2}\s?(AM|PM)/i.test(timestamp) &&
    timestamp.length < 12
  ) {
    return timestamp;
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp; // Fallback

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

  // Outputs: 12:30 PM • Apr 14, 2026
  return `${time} • ${day}`;
};

const formatStickyDate = (timestamp: any) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  // Outputs: April 14, 2026
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// --- MAIN SCREEN ---
export default function TeamHomeScreen() {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors, mode);
  const { id, isClosed } = useLocalSearchParams();
  const router = useRouter();
  const teamIsClosed = isClosed === "true";

  const [teamData, setTeamData] = useState<{
    name: string;
    invite_code: string;
    is_closed?: boolean;
  } | null>(null);

  const [replyingTo, setReplyingTo] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [closestEvent, setClosestEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const { userId, userName, refreshAuth } = useAuth();
  const currentUserId = userId;
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const [copied, setCopied] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // --- 2. FLOATING DATE STATE & LOGIC ---
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // -> FIX: Using ReturnType to satisfy TypeScript in React Native environments
  const fadeOutTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const topItem = viewableItems[0].item;
      const rawDate = getSafeDate(topItem);
      const stickyString = formatStickyDate(rawDate);

      if (stickyString) {
        setVisibleDate(stickyString);

        // Fade in the bubble
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();

        // Clear existing timeout and set a new one to fade it out after 2 seconds of no scrolling
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

  // ... (Keep existing useEffects for push tokens and FocusEffect)
  useEffect(() => {
    async function registerForPush() {
      if (Platform.OS === "android" && Constants.appOwnership === "expo") {
        return;
      }
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
        if (!projectId) return;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token = tokenData.data;
        try {
          await apiClient.post("/users/push-token", { token });
        } catch (apiError) {
          console.log("Failed to save token");
        }
      } catch (e) {
        console.log("Notification logic suppressed");
      }
    }
    if (userId) registerForPush();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!id || id === "undefined" || id === "null") {
        router.replace("/dashboard");
        return;
      }
      fetchTeamDetails();
      fetchPosts();
      fetchClosestEvent();
      refreshAuth();
    }, [id]),
  );

  const fetchTeamDetails = async () => {
    if (!id || id === "undefined" || id === "null") return;
    try {
      const response = await apiClient.get(`/teams/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTeamData({
          name: data.name,
          invite_code: data.code || data.invite_code,
          is_closed: data.is_closed,
        });
      }
    } catch (e) {
      console.error("Error fetching team data:", e);
    }
  };

  const fetchClosestEvent = async () => {
    if (!id || id === "undefined" || id === "null") return;
    try {
      const response = await apiClient.get(
        `/teams/${id}/events?skip=0&limit=50`,
      );
      if (response.ok) {
        const data = await response.json();
        const now = Date.now();
        const upcoming = data
          .filter((e: any) => new Date(e.date).getTime() >= now)
          .sort(
            (a: any, b: any) =>
              new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
        if (upcoming.length > 0) setClosestEvent(upcoming[0]);
        else setClosestEvent(null);
      }
    } catch (e) {
      console.log("Error fetching data:", e);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchClosestEvent();
    await fetchPosts();
  };

  const fetchPosts = async (isLoadMore = false) => {
    if (!id || id === "undefined" || id === "null") return;
    if (isLoadMore && (!hasMore || isLoadingMore)) return;
    try {
      if (isLoadMore) setIsLoadingMore(true);
      else if (!isRefreshing) setIsLoading(true);

      const currentSkip = isLoadMore ? posts.length : 0;
      const response = await apiClient.get(
        `/teams/${id}/posts?skip=${currentSkip}&limit=10`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.length < 10) setHasMore(false);
        else setHasMore(true);
        if (isLoadMore) setPosts((prev) => [...prev, ...data]);
        else setPosts(data);
      }
    } catch (e) {
      console.log("Error fetching posts:", e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  const showNotification = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setNotification({ message, type });
    Animated.spring(bannerAnim, {
      toValue: 0,
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

  const handleReplyPress = useCallback((postId: number, authorName: string) => {
    setReplyingTo({ id: postId, name: authorName });
    inputRef.current?.focus();
  }, []);

  const postKeyExtractor = useCallback((item: any) => item.id.toString(), []);

  const handleDeletePost = (postId: number) => {
    Alert.alert("Delete Post?", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => performDelete(postId),
      },
    ]);
  };

  const handleEditPress = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content || "");
    setEditModalVisible(true);
  };

  const renderPostItem = useCallback(
    ({ item }: { item: any }) => (
      <PostItem
        post={item}
        onReply={handleReplyPress}
        currentUserId={currentUserId}
        onImagePress={setFullScreenImage}
        onDelete={handleDeletePost}
        onEdit={handleEditPress}
        formatDate={formatPostDate} // Pass formatter to child
      />
    ),
    [handleReplyPress, currentUserId, handleDeletePost, handleEditPress],
  );

  const performDelete = async (postId: number) => {
    try {
      const response = await apiClient.delete(`/posts/${postId}`);
      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        showNotification("Post deleted successfully", "info");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while deleting post.");
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost || isUpdatingPost) return;
    setIsUpdatingPost(true);
    try {
      const response = await apiClient.put(`/posts/${editingPost.id}`, {
        content: editContent,
      });
      if (response.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === editingPost.id ? { ...p, content: editContent } : p,
          ),
        );
        setEditModalVisible(false);
        setEditingPost(null);
        showNotification("Post updated successfully", "success");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while updating post.");
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const handlePost = async () => {
    if (!inputText.trim() && !selectedMedia) return;
    if (isPosting) return;
    setIsPosting(true);

    try {
      const url = replyingTo ? `/posts/${replyingTo.id}/replies` : `/posts`;
      const formData = new FormData();
      formData.append("content", inputText || "");

      if (!replyingTo) formData.append("team_id", id.toString());

      if (selectedMedia && !replyingTo) {
        const uri = selectedMedia;
        const fileName =
          uri.split("/").pop() ||
          (mediaType === "video" ? "upload.mp4" : "upload.jpg");
        const match = /\.(\w+)$/.exec(fileName);
        let type = mediaType === "video" ? "video/mp4" : "image/jpeg";
        if (match) {
          const ext = match[1].toLowerCase();
          type = ["mp4", "mov", "avi", "m4v"].includes(ext)
            ? "video/mp4"
            : `image/${ext === "jpg" ? "jpeg" : ext}`;
        }
        // @ts-ignore
        formData.append("image", { uri: uri, name: fileName, type: type });
      }

      const response = await apiClient.post(url, formData);

      if (response.ok) {
        setInputText("");
        setSelectedMedia(null);
        setMediaType(null);
        setReplyingTo(null);
        fetchPosts();
        Keyboard?.dismiss?.();
        showNotification(
          replyingTo ? "Reply sent!" : "Update shared!",
          "success",
        );
      }
    } catch (error: any) {
      console.error("Post Error:", error);
    } finally {
      setIsPosting(false);
    }
  };

  const pickMedia = async () => {
    try {
      setIsImageProcessing(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        videoMaxDuration: 60,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setSelectedMedia(asset.uri);
        setMediaType(asset.type as "image" | "video");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to process media.");
    } finally {
      setIsImageProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    if (teamData?.invite_code) {
      await Clipboard.setStringAsync(teamData.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const renderUpcomingEventBanner = () => {
    if (teamIsClosed) {
      return (
        <View
          style={[
            styles.upcomingBanner,
            {
              borderColor: colors.coral,
              backgroundColor: "rgba(211, 47, 47, 0.05)",
              alignItems: "center",
              paddingVertical: 20,
            },
          ]}
        >
          <Ionicons
            name="lock-closed"
            size={32}
            color={colors.coral}
            style={{ marginBottom: 10 }}
          />
          <Text
            style={{
              color: "#FFF",
              fontSize: 16,
              fontWeight: "bold",
              marginBottom: 5,
            }}
          >
            This group has been closed.
          </Text>
          <Text
            style={{
              color: colors.textSubtle,
              fontSize: 13,
              textAlign: "center",
              marginBottom: 15,
              paddingHorizontal: 20,
            }}
          >
            The season has ended. You can still view past updates, but no new
            posts can be made.
          </Text>
          <LeaveTeamButton
            teamId={id as string}
            teamName={teamData?.name || "this team"}
            onLeftTeam={() => router.replace("/dashboard")}
          />
        </View>
      );
    }

    if (!closestEvent) return null;
    const eventDate = new Date(closestEvent.date);
    const formattedDate = eventDate.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <View style={styles.upcomingBanner}>
        <View style={styles.upcomingHeaderRow}>
          <View style={styles.upcomingBadge}>
            <Ionicons name="flash" size={12} color="#FFF" />
            <Text style={styles.upcomingBadgeText}>UP NEXT</Text>
          </View>
          <Text style={styles.upcomingTimeText}>{formattedDate}</Text>
        </View>
        <Text style={styles.upcomingTitle} numberOfLines={1}>
          {closestEvent.title}
        </Text>
        <Text style={styles.upcomingLocation} numberOfLines={1}>
          <Ionicons name="location" size={14} color={colors.textSubtle} />{" "}
          {closestEvent.address}
        </Text>
        <TouchableOpacity
          style={styles.upcomingBtn}
          onPress={() => router.push(`/team/${id}/schedule`)}
        >
          <Text style={styles.upcomingBtnText}>Check Schedule for Updates</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.teal} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TabTransition>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <TeamHeader />

        <Animated.View
          style={[
            styles.actionBanner,
            notification?.type === "info"
              ? styles.infoBanner
              : styles.successBanner,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <Ionicons
            name={
              notification?.type === "info"
                ? "trash-outline"
                : "checkmark-circle-outline"
            }
            size={18}
            color="#FFF"
          />
          <Text style={styles.bannerText}>{notification?.message}</Text>
        </Animated.View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
        >
          {/* --- 3. FLOATING DATE BANNER UI --- */}
          {visibleDate && (
            <Animated.View
              style={[styles.floatingDateContainer, { opacity: fadeAnim }]}
            >
              <Text style={styles.floatingDateText}>{visibleDate}</Text>
            </Animated.View>
          )}

          {isLoading ? (
            <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={postKeyExtractor}
              renderItem={renderPostItem}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={renderUpcomingEventBanner}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
              onEndReached={() => fetchPosts(true)}
              onEndReachedThreshold={0.5}
            />
          )}

          {!teamIsClosed && (
            <View style={styles.inputContainer}>
              {replyingTo && (
                <View style={styles.replyIndicator}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="return-down-forward"
                      size={16}
                      color={colors.primary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.replyIndicatorText}>
                      Replying to{" "}
                      <Text style={{ fontWeight: "bold", color: colors.teal }}>
                        {replyingTo.name}
                      </Text>
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.textSubtle}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {selectedMedia ? (
                <View style={styles.imagePreviewContainer}>
                  {mediaType === "video" ? (
                    <View
                      style={[
                        styles.imagePreview,
                        {
                          backgroundColor: "#000",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Ionicons name="videocam" size={24} color="#FFF" />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: selectedMedia }}
                      style={styles.imagePreview}
                      contentFit="cover"
                      transition={200}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => {
                      setSelectedMedia(null);
                      setMediaType(null);
                    }}
                  >
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : null}

            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={pickMedia}
                style={styles.attachBtn}
                disabled={!!replyingTo}
              >
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={replyingTo ? colors.textSubtle : colors.teal}
                />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder={
                  replyingTo ? "Write a reply..." : "Share an update..."
                }
                placeholderTextColor={colors.textSubtle}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity
                onPress={handlePost}
                disabled={(!inputText && !selectedMedia) || isPosting}
              >
                {isPosting ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : (
                  <Ionicons
                    name="send"
                    size={24}
                    color={colors.teal}
                    style={{ opacity: !inputText && !selectedMedia ? 0.5 : 1 }}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={!!fullScreenImage}
        transparent
        onRequestClose={() => setFullScreenImage(null)}
      >
        <TouchableWithoutFeedback onPress={() => setFullScreenImage(null)}>
          <View style={styles.modalBackground}>
            {fullScreenImage && (
              <Image
                source={{ uri: fullScreenImage }}
                style={styles.fullScreenImage}
                contentFit="contain"
                transition={200}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMain} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editInput}
              multiline
              value={editContent}
              onChangeText={setEditContent}
              autoFocus
            />
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdatePost}
              disabled={!editContent.trim() || isUpdatingPost}
            >
              {isUpdatingPost ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.updateButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </SafeAreaView>
    </TabTransition>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: mode === 'light' ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)",
    backgroundColor: colors.background,
  },
  headerTitleContainer: { alignItems: "center", flex: 1, marginHorizontal: 10 },
  headerTeamName: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 2,
  },
  codeBadge: {
    backgroundColor: mode === 'light' ? "rgba(42, 157, 143, 0.1)" : "rgba(255,255,255,0.08)",
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
  listContent: { paddingTop: 16, paddingBottom: 20 },
  inputContainer: {
    backgroundColor: colors.cardBg,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
  },
  replyIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  replyIndicatorText: { color: colors.textSubtle, fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "center" },
  attachBtn: { marginRight: 12 },
  textInput: {
    flex: 1,
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    color: colors.textMain,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
  },
  imagePreviewContainer: {
    position: "relative",
    width: 60,
    height: 60,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreview: { width: "100%", height: "100%", borderRadius: 8 },
  removeImageBtn: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: colors.coral,
    borderRadius: 10,
    padding: 2,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
  },
  fullScreenImage: { width: "100%", height: "100%" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  editModalContainer: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    width: "100%",
    minHeight: 300,
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  editModalTitle: { color: colors.textMain, fontSize: 18, fontWeight: "bold" },
  editInput: {
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 16,
    color: colors.textMain,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  updateButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  updateButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  actionBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  successBanner: { backgroundColor: colors.teal },
  infoBanner: { backgroundColor: "#1976D2" },
  bannerText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  upcomingBanner: {
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.3)",
  },
  upcomingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  upcomingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.teal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  upcomingBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  upcomingTimeText: { color: colors.teal, fontSize: 12, fontWeight: "bold" },
  upcomingTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  upcomingLocation: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 16,
  },
  upcomingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 184, 166, 0.15)",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  upcomingBtnText: { color: colors.teal, fontSize: 14, fontWeight: "bold" },

  // --- NEW STYLES FOR FLOATING DATE ---
  floatingDateContainer: {
    position: "absolute",
    top: 15,
    alignSelf: "center",
    backgroundColor: colors.teal, // Deep slate with opacity
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingDateText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
