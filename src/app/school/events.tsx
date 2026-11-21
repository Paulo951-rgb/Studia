import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDate } from '@/ui/format';

export default function EventsScreen() {
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    return repos.school.listEvents({ accountId: activeAccountId, from, limit: 100 });
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des événements…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucun événement"
          description="PRONOTE n’expose pas d’API d’événements : les vacances et les contrôles planifiés sont dérivés des données de session et de l’emploi du temps."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl }}>
      {data.map((event) => (
        <Card key={event.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
              {event.title}
            </AppText>
            <Chip label={event.kind === 'holiday' ? 'vacances' : event.kind === 'test' ? 'contrôle' : event.kind} />
          </View>
          <Muted>
            {formatDate(event.startsAt)}
            {event.endsAt ? ` → ${formatDate(event.endsAt)}` : ''}
          </Muted>
          {event.description ? <Muted>{event.description}</Muted> : null}
          <Muted>source : {event.source}</Muted>
        </Card>
      ))}
    </ScrollView>
  );
}
