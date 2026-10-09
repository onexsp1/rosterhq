import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGlobalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../src/theme/ThemeContext";
import { BASE_URL } from "../../../../src/constants/api";
import { apiClient } from "../../../../src/services/apiClient";
import { UserAvatar } from "../../../../src/components/UserAvatar";

// THE FIX: Import the video player
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { TeamHeader } from "@/src/components/TeamHeader";
import { TabTransition } from "../../../../src/components/TabTransition";

const screenWidth = Dimensions.get("window").width;
const numColumns = 3;
const tileSize = screenWidth / numColumns;

// --- 1. FULL SCREEN VIDEO COMPONENT ---
const FullScreenVideo = ({ uri, styles }: { uri: string; styles: any }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.play();
  });

  return (
    <VideoView
      style={styles.fullScreenImage}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

// --- 2. MAIN SCREEN COMPONENT ---
export default function TeamMediaScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const { id } = useGlobalSearchParams();

  const [groupedMedia, setGroupedMedia] = useState<any[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);

  // Helper to check if a URL is a video
  const isVideo = (url: string) =>
    url.toLowerCase().endsWith(".mp4") || url.toLowerCase().endsWith(".mov");

  // Helper to group media by author
  const groupItems = (items: any[]) => {
    const grouped = items.reduce((acc: any, post: any) => {
      const authorId = post.author_id || post.author_name;
      if (!acc[authorId]) {
        acc[authorId] = {
          name: post.author_name || "Unknown User",
          avatar: post.author_avatar,
          items: [],
        };
      }
      acc[authorId].items.push(post);
      return acc;
    }, {});

    return Object.keys(grouped).map((key) => ({
      author: grouped[key].name,
      avatar: grouped[key].avatar,
      items: grouped[key].items,
    }));
  };

  // --- API CALL WITH OFFLINE PROTECTION ---
  const fetchMedia = useCallback(
    async (isLoadMore = false) => {
      if (!id || (isLoadMore && (!hasMore || isLoadingMore))) return;

      try {
        if (isLoadMore) setIsLoadingMore(true);
        else if (!isRefreshing) setIsLoading(true);

        const currentSkip = isLoadMore ? rawItems.length : 0;

        const response = await apiClient.get(
          `/teams/${id}/media?skip=${currentSkip}&limit=15`,
        );

        // Check if response exists and is OK (prevents 'undefined' errors)
        if (response && response.ok) {
          const data = await response.json();

          if (data.length < 15) {
            setHasMore(false);
          } else if (!isLoadMore) {
            setHasMore(true);
          }

          const newRawItems = isLoadMore ? [...rawItems, ...data] : data;
          setRawItems(newRawItems);
          setGroupedMedia(groupItems(newRawItems));
        }
      } catch (e) {
        // Specifically silence network-related noise
        if (
          e instanceof Error &&
          (e.message === "Network request failed" || e.name === "TypeError")
        ) {
          console.log("[Media] Connection lost - fetch suspended.");
        } else {
          console.error("Error fetching media:", e);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [id, rawItems, hasMore, isLoadingMore, isRefreshing],
  );

  // --- AUTO-REFRESH ON RECONNECT ---
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("network_restored", () => {
      console.log("[Media] Internet restored - auto-refreshing gallery.");
      fetchMedia();
    });
    return () => sub.remove();
  }, [fetchMedia]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    setHasMore(true);
    await fetchMedia();
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      fetchMedia(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedia();
    }, [id]),
  );

  const renderGroup = ({ item }: { item: any }) => (
    <View style={styles.groupContainer}>
      <View style={styles.sectionHeader}>
        <UserAvatar uri={item.avatar} name={item.author} size={32} />
        <Text style={styles.sectionHeaderText}>{item.author}</Text>
        <Text style={styles.photoCountText}>
          {item.items.length} {item.items.length === 1 ? "item" : "items"}
        </Text>
      </View>

      <View style={styles.gridContainer}>
        {item.items.map((mediaItem: any) => {
          const mediaUrl = `${BASE_URL}/${mediaItem.image_url}`;
          const mediaType = isVideo(mediaUrl) ? "video" : "image";

          return (
            <TouchableOpacity
              key={mediaItem.id}
              style={styles.gridItem}
              onPress={() =>
                setSelectedMedia({ uri: mediaUrl, type: mediaType })
              }
            >
              {mediaType === "video" ? (
                <View style={styles.videoThumbnailPlaceholder}>
                  <Ionicons
                    name="videocam"
                    size={32}
                    color="rgba(255,255,255,0.7)"
                  />
                </View>
              ) : (
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={200}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <TabTransition>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <TeamHeader />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={groupedMedia}
          renderItem={renderGroup}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.teal} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="images-outline"
                size={80}
                color={colors.textSubtle + "4D"}
              />
              <Text style={styles.emptyTitle}>No Media Yet</Text>
              <Text style={styles.emptySubtitle}>
                Photos and videos uploaded to the Team Feed will appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* FULL SCREEN MEDIA MODAL */}
      <Modal
        visible={!!selectedMedia}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedMedia(null)}
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedMedia(null)}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.mediaContainer} pointerEvents="box-none">
            {selectedMedia?.type === "video" ? (
              <FullScreenVideo uri={selectedMedia.uri} styles={styles} />
            ) : selectedMedia?.type === "image" ? (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.fullScreenImage}
                contentFit="contain"
                transition={200}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </TabTransition>
  );
}

// --- 3. STYLES ---
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
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 40 },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
  groupContainer: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  sectionHeaderText: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  photoCountText: { color: colors.textSubtle, fontSize: 13 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: tileSize, height: tileSize, padding: 1 },
  thumbnail: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  videoThumbnailPlaceholder: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: colors.textMain,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 24,
  },
  emptySubtitle: {
    color: colors.textSubtle,
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaContainer: {
    width: "100%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: { width: "100%", height: "100%" },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
});
