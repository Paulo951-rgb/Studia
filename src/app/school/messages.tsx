import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatDateTime } from '@/ui/format';

export default function MessagesScreen() {
  const { palette } = usePalette();
  const router = useRouter();
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    return repos.school.listDiscussions(activeAccountId, 100);
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des discussions…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucune discussion enregistrée"
          description="La messagerie PRONOTE n’est disponible que si l’onglet est autorisé pour ce compte."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl }}>
      {data.map((discussion) => (
        <Card key={discussion.id} style={{ gap: 6 }}>
          <Row
            title={discussion.subject || '(sans objet)'}
            subtitle={[
              discussion.creator ? `de ${discussion.creator}` : null,
              discussion.lastMessageAt ? formatDateTime(discussion.lastMessageAt) : null,
              `${discussion.messageCount} message(s)`,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={discussion.unreadCount > 0 ? <Chip label={`${discussion.unreadCount} non lu`} tone="accent" /> : null}
            onPress={() => router.push({ pathname: '/school/message', params: { discussionId: discussion.id, subject: discussion.subject } })}
          />
          {discussion.closed ? <Muted style={{ color: palette.warning }}>Discussion fermée par l’établissement</Muted> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
