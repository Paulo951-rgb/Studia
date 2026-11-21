import React from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, radius, spacing } from '@/ui/theme/theme';
import { AppText, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDateTime } from '@/ui/format';

export default function MessageDetailScreen() {
  const { palette } = usePalette();
  const params = useLocalSearchParams<{ discussionId: string; subject?: string }>();
  const discussionId = typeof params.discussionId === 'string' ? params.discussionId : '';
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId || !discussionId) return null;
    const messages = await repos.school.listMessages({ accountId: activeAccountId, discussionId, limit: 200 });
    return messages.slice().sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));
  }, [activeAccountId, discussionId]);

  if (loading) return <Spinner label="Lecture du message…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState title="Aucun message enregistré" description="Synchronisez pour importer les messages de cette discussion." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      {typeof params.subject === 'string' && params.subject ? <AppText variant="heading">{params.subject}</AppText> : null}
      {data.map((message) => (
        <View
          key={message.id}
          style={{
            backgroundColor: palette.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: palette.border,
            padding: spacing.md,
            gap: 6,
          }}
        >
          <Muted>
            {message.authorName ?? 'Auteur non fourni'} · {formatDateTime(message.sentAt)}
          </Muted>
          <AppText variant="body">{message.contentText || '(message sans texte)'}</AppText>
          {message.attachments.length > 0 ? (
            <View style={{ gap: 2 }}>
              {message.attachments.map((attachment) => (
                <Muted key={attachment.id}>📎 {attachment.name}</Muted>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      <Muted style={{ color: palette.textFaint }}>
        Lecture seule : l’application n’envoie pas de message depuis l’assistant.
      </Muted>
    </ScrollView>
  );
}
