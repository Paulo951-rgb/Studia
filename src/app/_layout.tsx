import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { usePalette } from '@/ui/theme/theme';
import { AppText, Button, Screen } from '@/ui/components/primitives';
import { isAppLockEnabled } from '@/platform/secureStore';
import { unlockWithDevice } from '@/platform/appLock';
// Register the background task at app startup as required by Expo TaskManager.
import '@/platform/backgroundSync';

type LockState = 'checking' | 'locked' | 'unlocked';

export default function RootLayout() {
  const { palette } = usePalette();
  const status = useAppStore((state) => state.status);
  const fatalMessage = useAppStore((state) => state.fatalMessage);
  const bootstrap = useAppStore((state) => state.bootstrap);

  const [lockState, setLockState] = useState<LockState>('checking');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const unlockInFlight = useRef(false);
  const autoPrompted = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    void (async () => {
      setLockState((await isAppLockEnabled()) ? 'locked' : 'unlocked');
    })();
  }, []);

  // The lock must close again when the app leaves the foreground, otherwise a phone
  // handed to someone else exposes the school data from the app switcher.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      setLockState((current) => (current === 'unlocked' ? 'locked' : current));
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (unlockInFlight.current) return;
    unlockInFlight.current = true;
    const result = await unlockWithDevice();
    unlockInFlight.current = false;
    if (result.ok) {
      setUnlockError(null);
      autoPrompted.current = false;
      setLockState('unlocked');
      return;
    }
    setUnlockError(result.message);
    setLockState('locked');
  }, []);

  useEffect(() => {
    if (lockState !== 'locked' || autoPrompted.current) return;
    autoPrompted.current = true;
    void unlock();
  }, [lockState, unlock]);

  if (status === 'booting') {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent} />
        <AppText variant="caption" color="textMuted" style={{ marginTop: 12 }}>
          Ouverture de la base locale chiffrée…
        </AppText>
      </Screen>
    );
  }

  if (status === 'fatal') {
    return (
      <Screen style={{ padding: 24, justifyContent: 'center', gap: 12 }}>
        <AppText variant="title">Stockage local indisponible</AppText>
        <AppText variant="body" color="textMuted">
          {fatalMessage ?? 'La base chiffrée n’a pas pu être ouverte.'}
        </AppText>
        <AppText variant="caption" color="textFaint">
          L’application refuse d’enregistrer des données scolaires non chiffrées. Installez une compilation de développement
          contenant SQLCipher (`expo prebuild` avec le plugin expo-sqlite, `useSQLCipher: true`).
        </AppText>
        <Button label="Réessayer" onPress={() => void bootstrap()} />
      </Screen>
    );
  }

  if (lockState === 'checking') {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent} />
      </Screen>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ title: 'Historique' }} />
        <Stack.Screen name="connect" options={{ title: 'Connexion PRONOTE', presentation: 'modal' }} />
        <Stack.Screen name="settings/ai" options={{ title: 'Assistant IA' }} />
        <Stack.Screen name="settings/privacy" options={{ title: 'Confidentialité' }} />
        <Stack.Screen name="settings/memory" options={{ title: 'Mémoire' }} />
        <Stack.Screen name="settings/about" options={{ title: 'À propos' }} />
        <Stack.Screen name="settings/sync" options={{ title: 'Synchronisation' }} />
        <Stack.Screen name="school/grades" options={{ title: 'Notes' }} />
        <Stack.Screen name="school/report-cards" options={{ title: 'Bulletins' }} />
        <Stack.Screen name="school/homework" options={{ title: 'Devoirs' }} />
        <Stack.Screen name="school/timetable" options={{ title: 'Emploi du temps' }} />
        <Stack.Screen name="school/messages" options={{ title: 'Messages' }} />
        <Stack.Screen name="school/message" options={{ title: 'Message' }} />
        <Stack.Screen name="school/news" options={{ title: 'Actualités' }} />
        <Stack.Screen name="school/events" options={{ title: 'Événements' }} />
        <Stack.Screen name="school/absences" options={{ title: 'Absences et retards' }} />
        <Stack.Screen name="school/canteen" options={{ title: 'Cantine' }} />
        <Stack.Screen name="school/documents" options={{ title: 'Documents' }} />
        <Stack.Screen name="school/revision" options={{ title: 'Révisions et bilans' }} />
        <Stack.Screen name="school/search" options={{ title: 'Recherche' }} />
      </Stack>
      {lockState === 'locked' ? (
        // Rendered on top of the stack rather than replacing it, so unlocking returns to
        // the same screen instead of the first route.
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: palette.background,
            padding: 24,
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <AppText variant="title">Studia est verrouillé</AppText>
          <AppText variant="body" color="textMuted">
            Vos notes, messages et conversations restent sur ce téléphone. Déverrouillez pour les consulter.
          </AppText>
          {unlockError ? <AppText variant="caption" color="danger">{unlockError}</AppText> : null}
          <Button label="Déverrouiller" onPress={() => void unlock()} />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}
