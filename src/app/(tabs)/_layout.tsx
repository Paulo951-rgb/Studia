import React from 'react';
import { Tabs } from 'expo-router';
import { usePalette } from '@/ui/theme/theme';
import { AppText } from '@/ui/components/primitives';

function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  const { palette } = usePalette();
  return <AppText style={{ fontSize: 18, color: focused ? palette.accent : palette.textFaint }}>{glyph}</AppText>;
}

export default function TabsLayout() {
  const { palette } = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Assistant', tabBarIcon: ({ focused }) => <TabGlyph glyph="◍" focused={focused} /> }}
      />
      <Tabs.Screen
        name="school"
        options={{ title: 'École', tabBarIcon: ({ focused }) => <TabGlyph glyph="▤" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Réglages', tabBarIcon: ({ focused }) => <TabGlyph glyph="⚙" focused={focused} /> }}
      />
    </Tabs>
  );
}
