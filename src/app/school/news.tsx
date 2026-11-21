import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDate } from '@/ui/format';

export default function NewsScreen() {
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    return repos.school.listNews({ accountId: activeAccountId, limit: 50, unreadOnly });
  }, [activeAccountId, unreadOnly]);

  if (loading) return <Spinner label="Lecture des actualités…" />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Toutes" selected={!unreadOnly} onPress={() => setUnreadOnly(false)} />
        <Chip label="Non lues" selected={unreadOnly} onPress={() => setUnreadOnly(true)} />
      </View>

      {!data || data.length === 0 ? (
        <EmptyState
          title="Aucune actualité"
          description="Les actualités n’apparaissent que si l’onglet est autorisé pour ce compte, après synchronisation."
        />
      ) : null}

      {data?.map((item) => (
        <Card key={item.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {item.title}
            </AppText>
            {!item.isRead ? <Chip label="non lue" tone="accent" /> : null}
          </View>
          <Muted>
            {[item.category, item.author, formatDate(item.publishedAt), item.isSurvey ? 'sondage' : null].filter(Boolean).join(' · ')}
          </Muted>
          {item.bodyText ? <AppText variant="body">{item.bodyText}</AppText> : <Muted>Contenu non fourni par PRONOTE.</Muted>}
        </Card>
      ))}
    </ScrollView>
  );
}
