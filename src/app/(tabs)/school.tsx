import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Card, Chip, Muted, Row, Stat } from '@/ui/components/primitives';
import { formatRelative } from '@/ui/format';
import { CAPABILITIES, capabilitiesForTabs } from '@/core/pronote/capabilities';

export default function SchoolScreen() {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accounts = useAppStore((state) => state.accounts);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const syncRunning = useAppStore((state) => state.syncRunning);
  const syncNow = useAppStore((state) => state.syncNow);
  const lastSyncSummary = useAppStore((state) => state.lastSyncSummary);

  const account = accounts.find((entry) => entry.id === activeAccountId) ?? null;

  const { data, loading, reload } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const [profile, counts, latest] = await Promise.all([
      repos.school.getProfile(activeAccountId),
      repos.school.counts(activeAccountId),
      repos.school.latestSync(activeAccountId),
    ]);
    const discussions = await repos.school.listDiscussions(activeAccountId, 50);
    const unread = discussions.reduce((total, discussion) => total + discussion.unreadCount, 0);
    return { profile, counts, latest, unread };
  }, [activeAccountId, lastSyncSummary?.runId]);

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
        <AppText variant="title">École</AppText>
        <Banner
          tone="warning"
          title="Aucun compte PRONOTE"
          description="Connectez votre compte PRONOTE pour importer vos notes, devoirs, messages et emploi du temps sur cet appareil."
        />
        <Button label="Connecter PRONOTE" onPress={() => router.push('/connect')} />
        <Card>
          <AppText variant="heading">Ce que l’application fait des données</AppText>
          <Muted style={{ marginTop: spacing.xs }}>
            Les données sont stockées uniquement sur ce téléphone, dans une base SQLCipher. Aucun serveur intermédiaire n’est
            utilisé.
          </Muted>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <View style={{ gap: 2 }}>
        <AppText variant="title">{data?.profile?.name ?? account.studentName ?? 'École'}</AppText>
        <Muted>
          {[data?.profile?.className ?? account.className, data?.profile?.establishmentName ?? account.establishmentName]
            .filter(Boolean)
            .join(' · ')}
        </Muted>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 2 }}>
            <AppText variant="heading">Dernière synchronisation</AppText>
            <Muted>
              {account.lastSyncAt ? formatRelative(account.lastSyncAt) : 'Jamais synchronisé'}
              {data?.latest ? ` · ${statusLabel(data.latest.status)}` : ''}
            </Muted>
          </View>
          <Chip label={syncRunning ? 'En cours' : 'Actualiser'} tone={syncRunning ? 'accent' : 'neutral'} onPress={() => (syncRunning ? undefined : void syncNow('manual').then(reload))} />
        </View>
        <Row
          title="Détail et historique"
          subtitle="Requêtes, ressources ignorées, erreurs"
          onPress={() => router.push('/settings/sync')}
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
        <Stat label="Notes" value={String(data?.counts['grades'] ?? 0)} />
        <Stat label="Devoirs" value={String(data?.counts['homework'] ?? 0)} />
        <Stat label="Messages non lus" value={String(data?.unread ?? 0)} tone={(data?.unread ?? 0) > 0 ? 'accent' : undefined} />
        <Stat label="Absences" value={String(data?.counts['absences'] ?? 0)} />
      </View>

      <Card style={{ gap: 0 }}>
        <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
          Scolarité
        </AppText>
        <Row title="Notes et moyennes" subtitle="Notes, coefficients, moyennes PRONOTE et calculs locaux" onPress={() => router.push('/school/grades')} />
        <Row title="Bulletins" subtitle="Moyennes par matière, appréciations" onPress={() => router.push('/school/report-cards')} />
        <Row title="Devoirs" subtitle="Échéances, descriptions, pièces jointes" onPress={() => router.push('/school/homework')} />
        <Row title="Emploi du temps" subtitle="Cours, annulations, contrôles" onPress={() => router.push('/school/timetable')} />
        <Row title="Messages" subtitle="Discussions avec l’établissement" onPress={() => router.push('/school/messages')} />
        <Row title="Actualités" subtitle="Informations et sondages" onPress={() => router.push('/school/news')} />
        <Row title="Événements" subtitle="Vacances et contrôles planifiés" onPress={() => router.push('/school/events')} />
        <Row title="Absences et retards" subtitle="Durées, justificatifs, motifs" onPress={() => router.push('/school/absences')} />
        <Row title="Cantine" subtitle="Menus et allergènes" onPress={() => router.push('/school/canteen')} />
        <Row title="Documents" subtitle="Cahier de textes et pièces jointes" onPress={() => router.push('/school/documents')} />
        <Row title="Révisions et bilans" subtitle="Bilan hebdomadaire, fiches, QCM, flashcards" onPress={() => router.push('/school/revision')} />
        <Row title="Recherche locale" subtitle="Rechercher dans tout l’historique (FTS5)" onPress={() => router.push('/school/search')} />
      </Card>

      <Card>
        <AppText variant="heading">Capacités PRONOTE</AppText>
        <Muted style={{ marginTop: 4, marginBottom: spacing.sm }}>
          Vérifiées dans le connecteur, pas déduites. Les onglets non autorisés pour ce compte restent vides.
        </Muted>
        <View style={{ gap: spacing.xs }}>
          {CAPABILITIES.map((capability) => (
            <View key={capability.key} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Muted style={{ width: 90 }}>
                {capability.status === 'supported' ? 'pris en charge' : capability.status === 'conditional' ? 'conditionnel' : 'indisponible'}
              </Muted>
              <View style={{ flex: 1 }}>
                <AppText variant="caption">{capability.label}</AppText>
                {capability.notes ? <Muted>{capability.notes}</Muted> : null}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Profil</AppText>
        <Row title="Établissement" right={<Muted>{account.establishmentName ?? '—'}</Muted>} />
        <Row title="Type de compte" right={<Muted>{account.accountKind}</Muted>} />
        <Row title="État" right={<Muted>{account.status === 'active' ? 'actif' : account.status === 'expired' ? 'session expirée' : 'désactivé'}</Muted>} />
        <Button label="Gérer la connexion" variant="secondary" onPress={() => router.push('/connect')} />
      </Card>

      {loading ? <Muted>Chargement…</Muted> : null}
    </ScrollView>
  );
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'synchronisation complète';
  if (status === 'partial') return 'synchronisation partielle';
  if (status === 'aborted') return 'synchronisation interrompue';
  return 'erreur de synchronisation';
}

export const capabilityCount = (tabs: number[]) => capabilitiesForTabs(tabs).length;
