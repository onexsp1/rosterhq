import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Linking,
  Keyboard,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// --- UPDATED IMPORT: Added useFocusEffect ---
import { useGlobalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTheme } from "../../../../src/theme/ThemeContext";
import { apiClient } from "../../../../src/services/apiClient";
import { useAuth } from "../../../../src/hooks/useAuth";
import { EventItem } from "../../../../src/components/EventItem";
import { UserAvatar } from "../../../../src/components/UserAvatar";
import { TeamHeader } from "@/src/components/TeamHeader";
import { TabTransition } from "../../../../src/components/TabTransition";

const STATUS_OPTIONS = ["On Going", "Canceled", "Postponed"];

export default function TeamScheduleScreen() {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors, mode);
  const router = useRouter();
  const { id, isClosed } = useGlobalSearchParams();
  const { userId: myId } = useAuth();
  const teamIsClosed = isClosed === "true";
  const formatToLocalISO = (date: Date) => {
    const pad = (n: number) => (n < 10 ? "0" + n : n);
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":" +
      pad(date.getSeconds())
    );
  };

  // --- STATE ---
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeListTab, setActiveListTab] = useState<"upcoming" | "past">(
    "upcoming",
  );

  // --- NOTIFICATION BANNER STATE ---
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const modalScrollRef = useRef<ScrollView>(null);

  // --- MODAL & FORM STATES ---
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [address, setAddress] = useState("");
  const [eventStatus, setEventStatus] = useState(STATUS_OPTIONS[0]);
  const [showDatePickerIos, setShowDatePickerIos] = useState(false);

  const [rsvpModalVisible, setRsvpModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [activeRsvpTab, setActiveRsvpTab] = useState<"going" | "notGoing">(
    "going",
  );

  // --- NOTIFICATION LOGIC ---
  const showNotification = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setNotification({ message, type });

    // Slide Down
    Animated.spring(bannerAnim, {
      toValue: Platform.OS === "ios" ? 20 : 10, // Position adjusted for SafeArea
      useNativeDriver: true,
      friction: 8,
    }).start();

    // Hide after 3 seconds
    setTimeout(() => {
      Animated.timing(bannerAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setNotification(null));
    }, 3000);
  };

  // --- DATA FETCHING ---
  const fetchCreatorStatus = async (currentUserId: string | null) => {
    try {
      const response = await apiClient.get(`/teams/${id}/members`);
      if (response.ok) {
        const members = await response.json();
        const me = members.find(
          (m: any) => String(m.id) === String(currentUserId),
        );
        setIsCreator(me?.isAdmin || false);
      }
    } catch (e) {
      console.error("Error checking creator status:", e);
    }
  };

  const fetchEvents = useCallback(
    async (isLoadMore = false) => {
      if (!id || (isLoadMore && (!hasMore || isLoadingMore))) return;

      try {
        if (isLoadMore) setIsLoadingMore(true);
        else if (!isRefreshing) setIsLoading(true);

        const skip = isLoadMore ? events.length : 0;
        const limit = 10;
        const response = await apiClient.get(
          `/teams/${id}/events?skip=${skip}&limit=${limit}`,
        );

        if (response.ok) {
          const data = await response.json();
          setEvents((prev) => {
            const combined = isLoadMore ? [...prev, ...data] : data;
            return combined.sort(
              (a: any, b: any) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
          });
          setHasMore(data.length === limit);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Network request failed"
        ) {
          console.log("Network offline - events fetch paused.");
        } else {
          console.log("Failed to fetch events:", error);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [id, events.length, hasMore, isLoadingMore, isRefreshing],
  );

  // --- UPDATED LOGIC: Replace useEffect with useFocusEffect ---
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadScreenData = async () => {
        if (id && id !== "undefined" && myId) {
          // 1. Fetch events fresh every time the tab opens
          await fetchEvents();

          // 2. Fetch admin status so it updates immediately if roles changed
          if (isActive) {
            await fetchCreatorStatus(myId);
          }
        }
      };

      loadScreenData();

      // Cleanup function prevents state updates if the user clicks away quickly
      return () => {
        isActive = false;
      };
    }, [id, myId, fetchEvents]),
  );
  // -------------------------------------------------------------

  const onRefresh = () => {
    setIsRefreshing(true);
    setHasMore(true);
    fetchEvents(false);
  };

  const handleRsvp = async (eventId: number, status: string) => {
    try {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, userRsvp: ev.userRsvp === status ? null : status }
            : ev,
        ),
      );
      const response = await apiClient.post(`/events/${eventId}/rsvp`, {
        status,
      });
      if (response.ok) {
        const updatedRes = await apiClient.get(
          `/teams/${id}/events?skip=0&limit=${events.length}`,
        );
        if (updatedRes.ok) setEvents(await updatedRes.json());
      }
    } catch (error) {
      console.error("RSVP Error:", error);
    }
  };

  // --- DATE PICKER LOGIC ---
  const showAndroidPicker = (
    currentMode: "date" | "time",
    currentSelectedDate: Date,
  ) => {
    DateTimePickerAndroid.open({
      value: currentSelectedDate,
      onChange: (event, nextSelectedDate) => {
        if (event.type === "set" && nextSelectedDate) {
          setDate(nextSelectedDate);
          if (currentMode === "date") {
            showAndroidPicker("time", nextSelectedDate);
          }
        }
      },
      mode: currentMode,
      is24Hour: true,
      minimumDate: currentMode === "date" ? new Date() : undefined,
    });
  };

  const handleDatePress = () => {
    Keyboard.dismiss();
    if (Platform.OS === "android") {
      showAndroidPicker("date", date);
    } else {
      setShowDatePickerIos(true);
    }
  };

  const handleSaveEvent = async () => {
    if (!title.trim() || !address.trim()) {
      Alert.alert("Required", "Please fill in all fields.");
      return;
    }

    if (new Date(date).getTime() < Date.now() - 60000) {
      Alert.alert(
        "Invalid Date",
        "You cannot schedule or edit an event to a past time.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title,
        date: formatToLocalISO(date),
        address,
        status: eventStatus,
      };
      const response = editingEventId
        ? await apiClient.put(`/events/${editingEventId}`, payload)
        : await apiClient.post(`/teams/${id}/events`, payload);

      if (response.ok) {
        setModalVisible(false);
        fetchEvents();
        // Trigger the beautiful notification
        showNotification(
          editingEventId
            ? "Event updated successfully!"
            : "Event created successfully!",
        );
      } else {
        Alert.alert("Error", "Could not save event.");
      }
    } catch (error) {
      Alert.alert("Error", "Check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderRsvpItem = ({ item }: { item: any }) => (
    <View style={styles.rsvpUserRow}>
      <UserAvatar
        uri={item.profile_picture}
        name={`${item.firstName} ${item.lastName}`}
        size={42}
      />
      <View style={styles.rsvpUserInfo}>
        <Text style={styles.rsvpUserName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.rsvpUserEmail}>{item.email}</Text>
      </View>
      <Ionicons
        name={activeRsvpTab === "going" ? "checkmark-circle" : "close-circle"}
        size={24}
        color={activeRsvpTab === "going" ? colors.teal : colors.coral}
      />
    </View>
  );

  // --- FILTER LOGIC ---
  const now = Date.now();
  const upcomingEvents = events.filter(
    (e) => new Date(e.date).getTime() >= now,
  );
  const pastEvents = events
    .filter((e) => new Date(e.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const displayedEvents =
    activeListTab === "upcoming" ? upcomingEvents : pastEvents;

  return (
    <TabTransition>
      <SafeAreaView style={styles.container} edges={["top"]}>
      {/* BEAUTIFUL NOTIFICATION BANNER */}
      {notification && (
        <Animated.View
          style={[
            styles.notificationBanner,
            { transform: [{ translateY: bannerAnim }] },
            notification.type === "success"
              ? styles.successBanner
              : styles.infoBanner,
          ]}
        >
          <Ionicons
            name={
              notification.type === "success"
                ? "checkmark-circle"
                : "information-circle"
            }
            size={20}
            color="#FFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.notificationText}>{notification.message}</Text>
        </Animated.View>
      )}

      {/* HEADER */}
      <TeamHeader
        rightComponent={
          isCreator && !teamIsClosed ? (
            <TouchableOpacity
              onPress={() => {
                setEditingEventId(null);
                setTitle("");
                setAddress("");
                setDate(new Date());
                setEventStatus(STATUS_OPTIONS[0]);
                setModalVisible(true);
              }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.eventTabsContainer}>
        <TouchableOpacity
          style={[
            styles.eventTab,
            activeListTab === "upcoming" && styles.activeEventTab,
          ]}
          onPress={() => setActiveListTab("upcoming")}
        >
          <Text
            style={[
              styles.eventTabText,
              activeListTab === "upcoming" && styles.activeEventTabText,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.eventTab,
            activeListTab === "past" && styles.activeEventTab,
          ]}
          onPress={() => setActiveListTab("past")}
        >
          <Text
            style={[
              styles.eventTabText,
              activeListTab === "past" && styles.activeEventTabText,
            ]}
          >
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={displayedEvents}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <EventItem
              event={item}
              isCreator={isCreator}
              isPast={activeListTab === "past"}
              onEditPress={(e: any) => {
                setEditingEventId(e.id);
                setTitle(e.title);
                setDate(new Date(e.date));
                setAddress(e.address);
                setEventStatus(e.status);
                setModalVisible(true);
              }}
              onRsvpPress={handleRsvp}
              onOpenRsvpList={(e: any) => {
                setSelectedEvent(e);
                setRsvpModalVisible(true);
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          onEndReached={() => fetchEvents(true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={colors.teal} style={{ margin: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="calendar-outline"
                size={64}
                color="rgba(255,255,255,0.1)"
              />
              <Text style={styles.emptyText}>
                {activeListTab === "upcoming"
                  ? "No upcoming events."
                  : "No past events yet."}
              </Text>
            </View>
          }
        />
      )}

      {/* MODALS RENDERED BELOW */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEventId ? "Edit Event" : "New Event"}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={modalScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 25 }}
            >
              <Text style={styles.inputLabel}>Event Description</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Weekly Practice"
                placeholderTextColor={colors.textSubtle}
              />

              <Text style={styles.inputLabel}>Date & Time</Text>
              <TouchableOpacity
                style={styles.dateTimeBtn}
                onPress={handleDatePress}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.dateTimeText}>
                  {date.toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
              </TouchableOpacity>

              {Platform.OS === "ios" && showDatePickerIos && (
                <View>
                  <DateTimePicker
                    value={date}
                    mode="datetime"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(e, d) => d && setDate(d)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowDatePickerIos(false)}
                    style={{ alignItems: "center", padding: 10 }}
                  >
                    <Text style={{ color: colors.teal, fontWeight: "bold" }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.inputLabel}>Location / Map Link</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Address or Google Maps link"
                placeholderTextColor={colors.textSubtle}
                onFocus={() => {
                  setTimeout(() => {
                    modalScrollRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />

              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveEvent}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingEventId ? "Update" : "Create"} Event
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={rsvpModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { height: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance</Text>
              <TouchableOpacity onPress={() => setRsvpModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeRsvpTab === "going" && styles.activeTab,
                ]}
                onPress={() => setActiveRsvpTab("going")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeRsvpTab === "going" && styles.activeTabText,
                  ]}
                >
                  Going ({selectedEvent?.goingUsers?.length || 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeRsvpTab === "notGoing" && styles.activeTab,
                ]}
                onPress={() => setActiveRsvpTab("notGoing")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeRsvpTab === "notGoing" && styles.activeTabText,
                  ]}
                >
                  Not Going ({selectedEvent?.notGoingUsers?.length || 0})
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={
                activeRsvpTab === "going"
                  ? selectedEvent?.goingUsers
                  : selectedEvent?.notGoingUsers
              }
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderRsvpItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No one here yet.</Text>
              }
            />
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.background,
  },
  headerTitle: { color: colors.textMain, fontSize: 20, fontWeight: "bold" },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  addBtn: {
    backgroundColor: colors.teal,
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  centerLoader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Notification Banner
  notificationBanner: {
    position: "absolute",
    left: "10%",
    right: "10%",
    height: 45,
    borderRadius: 22.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 8 },
    }),
  },
  successBanner: { backgroundColor: colors.teal },
  infoBanner: { backgroundColor: colors.primary },
  notificationText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },

  eventTabsContainer: {
    flexDirection: "row",
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 5,
    padding: 4,
  },
  eventTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeEventTab: { backgroundColor: colors.cardBg },
  eventTabText: { color: colors.textSubtle, fontSize: 13, fontWeight: "600" },
  activeEventTabText: { color: colors.teal, fontWeight: "bold" },

  listContent: { padding: 20, paddingBottom: 100 },
  emptyContainer: { alignItems: "center", marginTop: 100, gap: 10 },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  backdrop: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: { color: colors.textMain, fontSize: 22, fontWeight: "bold" },
  closeBtn: { padding: 5 },
  inputLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
    color: colors.textMain,
    padding: 18,
    borderRadius: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
  },
  dateTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mode === 'light' ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
    padding: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
  },
  dateTimeText: { color: colors.textMain, fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.teal,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 35,
  },
  saveBtnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  tabBar: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: colors.cardBg },
  tabText: { color: colors.textSubtle, fontSize: 14, fontWeight: "600" },
  activeTabText: { color: colors.teal, fontWeight: "bold" },
  rsvpUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
    gap: 15,
  },
  rsvpUserInfo: { flex: 1 },
  rsvpUserName: { color: colors.textMain, fontSize: 16, fontWeight: "600" },
  rsvpUserEmail: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
});
