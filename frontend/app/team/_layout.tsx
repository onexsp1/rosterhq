// app/team/_layout.tsx
import { Stack } from "expo-router";

export default function TeamLayout() {
  return (
    // This globally kills the phantom header for the entire team section!
    <Stack screenOptions={{ headerShown: false }} />
  );
}
