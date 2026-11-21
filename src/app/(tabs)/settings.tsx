import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/state/appStore';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, Muted, Row } from '@/ui/components/primitives';
import { formatRelative } from '@/ui/format';

export default function SettingsTab() {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accounts = useAppStore((state) => state.accounts);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const account = accounts.find((entry) => entry.id === activeAccountId) ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <AppText variant="title">Réglages</AppText>

      <Card style={{ gap: 0 }}>
        <Row
          title="Assistant IA"
          subtitle="Clé OpenAI, consentement, modèle, mémoire"
          onPress={() => router.push('/settings/ai')}
        />
        <Row title="Synchronisation" subtitle={lastSyncAt ? `Dernière : ${formatRelative(lastSyncAt)}` : 'Jamais synchronisé'} onPress={() => router.push('/settings/sync')} />
        <Row title="Confidentialité" subtitle="Données locales, partage, suppression" onPress={() => router.push('/settings/privacy')} />
        <Row title="Mémoire" subtitle="Consulter et supprimer ce qui est mémorisé" onPress={() => router.push('/settings/memory')} />
        <Row title="À propos et licences" subtitle="Dépendances, connecteur, limites" onPress={() => router.push('/settings/about')} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Comptes PRONOTE</AppText>
        {accounts.length === 0 ? <Muted>Aucun compte connecté.</Muted> : null}
        {accounts.map((entry) => (
          <Row
            key={entry.id}
            title={entry.studentName ?? entry.displayName}
            subtitle={[entry.className, entry.establishmentName].filter(Boolean).join(' · ')}
            right={<Chip label={entry.status === 'active' ? 'actif' : entry.status === 'expired' ? 'expiré' : 'inactif'} tone={entry.status === 'active' ? 'success' : 'warning'} />}
          />
        ))}
        <Row title="Ajouter ou reconnecter un compte" onPress={() => router.push('/connect')} />
      </Card>

      <Muted style={{ color: palette.textFaint, textAlign: 'center' }}>
        Scolary 0.1.0 · application locale, sans serveur éditeur
      </Muted>
      <View style={{ height: spacing.md }} />
    </ScrollView>
  );
}
