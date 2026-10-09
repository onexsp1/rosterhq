import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { BASE_URL } from '../constants/api';
import { colors } from '../theme/colors';

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  fallbackColor?: string;
}

/**
 * Reusable UserAvatar Component.
 * Handles profile picture with a robust fallback to initials.
 */
export const UserAvatar = React.memo(({ 
  uri, 
  name, 
  size = 44, 
  fallbackColor = '#1E88E5' 
}: UserAvatarProps) => {
  const initials = name ? name[0].toUpperCase() : '?';
  
  // Decide the source: if uri starts with http or file, use it directly. 
  // Otherwise, prepend BASE_URL.
  const sourceUri = uri?.startsWith('http') || uri?.startsWith('file') || uri?.startsWith('content')
    ? uri 
    : uri ? `${BASE_URL}/${uri}` : null;
  
  return (
    <View style={[
      styles.avatar, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: sourceUri ? 'transparent' : fallbackColor 
      }
    ]}>
      {sourceUri ? (
        <Image 
          source={{ uri: sourceUri }} 
          style={{ width: size, height: size, borderRadius: size / 2 }} 
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
