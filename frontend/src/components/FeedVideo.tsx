import React from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface FeedVideoProps {
  uri: string;
}

/**
 * Reusable video player for feed items.
 * Uses expo-video for efficient playback.
 */
export const FeedVideo = React.memo(({ uri }: FeedVideoProps) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
  });

  return (
    <VideoView
      style={styles.postImage}
      player={player}
      allowsPictureInPicture
      fullscreenOptions={{ enable: true }}
    />
  );
});

const styles = StyleSheet.create({
  postImage: { 
    width: '100%', 
    height: 200, 
    borderRadius: 12, 
    marginBottom: 16 
  },
});
