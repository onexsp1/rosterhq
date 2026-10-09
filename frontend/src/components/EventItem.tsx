import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface EventItemProps {
  event: any;
  isCreator: boolean;
  isPast?: boolean; // NEW: Added isPast prop
  onEditPress: (event: any) => void;
  onRsvpPress: (eventId: number, status: string) => void;
  onOpenRsvpList: (event: any) => void;
}

/**
 * Enhanced Event Card Component with Pencil icon and dynamic Status Badges.
 */
export const EventItem = React.memo(({ 
  event, 
  isCreator, 
  isPast,
  onEditPress, 
  onRsvpPress, 
  onOpenRsvpList 
}: EventItemProps) => {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors, mode);

  if (!event) return null;

  const dateObj = new Date(event.date);
  const month = dateObj.toLocaleString('en-US', { month: 'short' });
  const day = dateObj.getDate();
  const weekday = dateObj.toLocaleString('en-US', { weekday: 'short' });
  const time = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const openMaps = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(event.address)}`,
      android: `geo:0,0?q=${encodeURIComponent(event.address)}`,
    });
    if (url) Linking.openURL(url);
  };

  // Badge Color Mapping
  const getStatusStyle = (status: string, past: boolean) => {
    if (past) return { bg: mode === 'light' ? 'rgba(231, 111, 81, 0.1)' : 'rgba(231, 111, 81, 0.15)', text: colors.coral };
    
    switch (status) {
      case 'Canceled': return { bg: mode === 'light' ? 'rgba(231, 111, 81, 0.1)' : 'rgba(231, 111, 81, 0.15)', text: colors.coral };
      case 'Postponed': return { bg: mode === 'light' ? 'rgba(255, 183, 77, 0.1)' : 'rgba(255, 183, 77, 0.15)', text: '#FFB74D' };
      default: return { bg: mode === 'light' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.15)', text: colors.teal };
    }
  };

  const currentStatus = isPast ? 'Event ended' : (event.status || 'On Going');
  const statusStyle = getStatusStyle(event.status || 'On Going', !!isPast);

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.badgeWeekday}>{weekday}</Text>
          <Text style={styles.badgeDay}>{day}</Text>
          <Text style={[styles.badgeMonth, { color: statusStyle.text }]}>{month}</Text>
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
            {/* ONLY show edit button if the user is a creator AND the event hasn't passed */}
            {!isPast && isCreator && (
              <TouchableOpacity onPress={() => onEditPress(event)} style={styles.editBtn}>
                <Ionicons name="pencil" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSubtle} />
            <Text style={styles.metaText}>{time}</Text>
            <View style={styles.dot} />
            {/* Dynamic Status Tag */}
            <View style={[styles.statusTag, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{currentStatus}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={openMaps} style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>{event.address}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* RSVP Stats Bar */}
      <TouchableOpacity style={styles.statsBar} onPress={() => onOpenRsvpList(event)} activeOpacity={0.7}>
        <View style={styles.avatarsRow}>
          {event.goingUsers?.slice(0, 3).map((u: any, i: number) => (
            <View key={u.id} style={[styles.miniAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <Ionicons name="person-circle" size={24} color={colors.teal} />
            </View>
          ))}
          <Text style={styles.statsText}>
            {/* Dynamically change attending -> attended based on isPast */}
            {event.goingUsers?.length || 0} {isPast ? 'attended' : 'attending'} • {event.notGoingUsers?.length || 0} not coming
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      {/* ONLY show the Action Row (Going / No buttons) if the event is upcoming */}
      {!isPast && (
        <View style={styles.actionRow}>
          <TouchableOpacity 
            onPress={() => onRsvpPress(event.id, 'going')} 
            style={[styles.rsvpBtn, event.userRsvp === 'going' && styles.goingBtnActive]}
          >
            <Ionicons 
              name={event.userRsvp === 'going' ? "checkmark-circle" : "checkmark-circle-outline"} 
              size={18} 
              color={event.userRsvp === 'going' ? "#FFF" : colors.teal} 
            />
            <Text style={[styles.rsvpBtnText, { color: event.userRsvp === 'going' ? "#FFF" : colors.teal }]}>Going</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => onRsvpPress(event.id, 'notGoing')} 
            style={[styles.rsvpBtn, event.userRsvp === 'notGoing' && styles.notGoingBtnActive]}
          >
            <Ionicons 
              name={event.userRsvp === 'notGoing' ? "close-circle" : "close-circle-outline"} 
              size={18} 
              color={event.userRsvp === 'notGoing' ? "#FFF" : colors.coral} 
            />
            <Text style={[styles.rsvpBtnText, { color: event.userRsvp === 'notGoing' ? "#FFF" : colors.coral }]}>No</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 }
    })
  },
  topSection: { flexDirection: 'row', marginBottom: 16 },
  dateBadge: {
    width: 65,
    height: 80,
    backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
  },
  badgeWeekday: { color: colors.textSubtle, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  badgeDay: { color: colors.textMain, fontSize: 24, fontWeight: '800', marginVertical: 2 },
  badgeMonth: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  mainInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: colors.textMain, fontSize: 18, fontWeight: 'bold', flex: 1 },
  editBtn: { padding: 4 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaText: { color: colors.textSubtle, fontSize: 13, marginLeft: 4 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { color: colors.primary, fontSize: 12, marginLeft: 4, fontWeight: '500' },
  
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBg },
  statsText: { color: colors.textSubtle, fontSize: 12, marginLeft: 8 },
  
  actionRow: { flexDirection: 'row', gap: 12 },
  rsvpBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  goingBtnActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  notGoingBtnActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  rsvpBtnText: { fontSize: 14, fontWeight: 'bold' }
});