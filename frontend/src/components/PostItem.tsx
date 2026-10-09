import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../theme/ThemeContext";
import { BASE_URL } from "../constants/api";
import { apiClient } from "../services/apiClient";
import { UserAvatar } from "./UserAvatar";
import { FeedVideo } from "./FeedVideo";

interface PostItemProps {
  post: any;
  currentUserId: string | null;
  onReply: (postId: number, authorName: string) => void;
  onImagePress: (uri: string) => void;
  onDelete: (postId: number) => void;
  onEdit: (post: any) => void;
  formatDate: (timestamp: any) => string; // Required prop to receive formatter
}

const getSafeDate = (item: any) =>
  item?.created_at || item?.timestamp || item?.date || "";

export const PostItem = React.memo(
  ({
    post,
    onReply,
    currentUserId,
    onImagePress,
    onDelete,
    onEdit,
    formatDate, // Using the imported prop
  }: PostItemProps) => {
    const { colors, mode } = useTheme();
    const styles = getStyles(colors, mode);
    const swipeableRef = useRef<any>(null);
    const isAuthor =
      post.author_id && post.author_id.toString() === currentUserId?.toString();
    const [isLiked, setIsLiked] = useState(post.isLikedByMe);
    const [likeCount, setLikeCount] = useState(post.likes || 0);

    useEffect(() => {
      setIsLiked(post.isLikedByMe);
      setLikeCount(post.likes || 0);
    }, [post.isLikedByMe, post.likes]);

    const handleLike = async () => {
      try {
        const newLikedState = !isLiked;
        setIsLiked(newLikedState);
        setLikeCount((prev: number) => (newLikedState ? prev + 1 : prev - 1));

        const response = await apiClient.post(`/posts/${post.id}/like`);
        if (!response.ok) {
          setIsLiked(isLiked);
          setLikeCount((prev: number) => (isLiked ? prev + 1 : prev - 1));
        }
      } catch (error) {
        console.error("Like error:", error);
      }
    };

    const renderContentWithLinks = React.useCallback((text: string) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);

      return parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() => Linking.openURL(part)}
            >
              {part}
            </Text>
          );
        }
        return <Text key={index} style={{ color: colors.textMain }}>{part}</Text>;
      });
    }, []);

    const isVideo =
      post.image_url &&
      (post.image_url.toLowerCase().endsWith(".mp4") ||
        post.image_url.toLowerCase().endsWith(".mov"));

    const renderRightActions = () => {
      if (!isAuthor) return null;
      return (
        <View style={styles.swipeActionsContainer}>
          <TouchableOpacity
            style={[styles.swipeActionBtn, styles.editActionBtn]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit(post);
            }}
          >
            <Ionicons name="pencil" size={24} color="#FFF" />
            <Text style={styles.swipeActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeActionBtn, styles.deleteActionBtn]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete(post.id);
            }}
          >
            <Ionicons name="trash" size={24} color="#FFF" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      );
    };

    const content = (
      <View style={styles.postContainer}>
        <View style={styles.mainPostContent}>
          <View style={styles.postHeader}>
            <UserAvatar uri={post.author_avatar} name={post.author_name} />
            <View style={styles.headerText}>
              <Text style={styles.userName}>{post.author_name}</Text>
              {/* --- MAIN POST DATE FORMAT --- */}
              <Text style={styles.timestamp}>
                {formatDate(getSafeDate(post))}
              </Text>
            </View>
          </View>

          {post.content ? (
            <Text style={styles.content}>
              {renderContentWithLinks(post.content)}
            </Text>
          ) : null}

          {isVideo ? (
            <FeedVideo uri={`${BASE_URL}/${post.image_url}`} />
          ) : post.image_url ? (
            <TouchableOpacity
              onPress={() => onImagePress(`${BASE_URL}/${post.image_url}`)}
            >
              <Image
                source={{ uri: `${BASE_URL}/${post.image_url}` }}
                style={styles.postImage}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={22}
                color={isLiked ? "#E53935" : colors.textSubtle}
              />
              <Text
                style={[styles.actionText, isLiked && { color: "#E53935" }]}
              >
                {likeCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onReply(post.id, post.author_name)}
            >
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={colors.textSubtle}
              />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* REPLIES SECTION */}
        {post.replies && post.replies.length > 0 && (
          <View style={styles.repliesWrapper}>
            {post.replies.map((reply: any) => (
              <View key={reply.id} style={styles.replyThread}>
                <View style={styles.threadLine} />
                <View style={styles.replyCard}>
                  <View style={styles.replyHeader}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <UserAvatar
                        uri={reply.author_avatar}
                        name={reply.author_name}
                        size={16}
                      />
                      <Text style={styles.replyAuthor}>
                        {reply.author_name}
                      </Text>
                    </View>
                    {/* --- REPLY DATE FORMAT --- */}
                    <Text style={styles.replyTimestamp}>
                      {formatDate(getSafeDate(reply))}
                    </Text>
                  </View>
                  <Text style={styles.replyText}>
                    {renderContentWithLinks(reply.content)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );

    if (!isAuthor) return content;

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={2}
        rightThreshold={40}
      >
        {content}
      </Swipeable>
    );
  },
);

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  postContainer: {
    backgroundColor: colors.cardBg,
    marginBottom: 8,
    paddingVertical: 12,
  },
  mainPostContent: { paddingHorizontal: 16 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  headerText: { flex: 1, marginLeft: 12 },
  userName: { color: colors.textMain, fontSize: 16, fontWeight: "bold" },
  timestamp: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  content: {
    color: colors.textMain,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  postImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },
  linkText: { color: colors.teal, textDecorationLine: "underline" },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: mode === 'light' ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)",
    paddingTop: 12,
  },
  actionButton: { flexDirection: "row", alignItems: "center", marginRight: 24 },
  actionText: { color: colors.textSubtle, fontSize: 14, marginLeft: 6 },
  repliesWrapper: { marginTop: 8, paddingLeft: 16 },
  replyThread: { flexDirection: "row", marginBottom: 10 },
  threadLine: {
    width: 2,
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
    marginRight: 12,
    borderRadius: 1,
  },
  replyCard: {
    flex: 1,
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 8,
  },

  // Adjusted Reply Header to push date to the right side
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    justifyContent: "space-between",
  },
  replyAuthor: { color: colors.primary, fontSize: 13, fontWeight: "bold" },
  replyTimestamp: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "500",
  },

  replyText: { color: colors.textMain, fontSize: 14, lineHeight: 20 },
  swipeActionsContainer: { flexDirection: "row", width: 140 },
  swipeActionBtn: { flex: 1, justifyContent: "center", alignItems: "center" },
  editActionBtn: { backgroundColor: "#1976D2" },
  deleteActionBtn: { backgroundColor: "#D32F2F" },
  swipeActionText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 4,
  },
});
