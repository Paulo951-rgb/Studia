import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Button, Card, EmptyState, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatRelative } from '@/ui/format';

export default function HistoryScreen() {
  const { palette } = usePalette();
  const router = useRouter();
  const activeConversationId = useAppStore((state) => state.conversationId);
  const openConversation = useAppStore((state) => state.openConversation);
  const startNewConversation = useAppStore((state) => state.startNewConversation);
  const [nonce, setNonce] = useState(0);

  const { data, loading } = useAsyncData(async (repos) => repos.chat.listConversations(100), [nonce]);

  const remove = (id: string) => {
    Alert.alert('Supprimer cette conversation ?', 'Les messages seront supprimés de cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          const repos = useAppStore.getState().repos;
          if (!repos) return;
          void repos.chat.deleteConversation(id).then(() => setNonce((value) => value + 1));
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Button label="Nouvelle conversation" onPress={() => void startNewConversation().then(() => router.back())} />
      {loading ? <Spinner /> : null}
      {data && data.length === 0 ? <EmptyState title="Aucune conversation" description="Vos échanges restent sur cet appareil." /> : null}
      <Card style={{ gap: 0 }}>
        {data?.map((conversation) => (
          <Row
            key={conversation.id}
            title={conversation.title || 'Sans titre'}
            subtitle={`${formatRelative(conversation.updatedAt)}${conversation.id === activeConversationId ? ' · ouverte' : ''}`}
            onPress={() => void openConversation(conversation.id).then(() => router.back())}
            right={
              <Pressable onPress={() => remove(conversation.id)} hitSlop={8}>
                <Muted style={{ color: palette.danger, paddingHorizontal: spacing.sm }}>supprimer</Muted>
              </Pressable>
            }
            accessory={null}
          />
        ))}
      </Card>
      <Muted style={{ color: palette.textFaint }}>
        Les conversations ne sont jamais envoyées à un serveur Scolary : il n’en existe aucun. OpenAI reçoit uniquement les
        messages nécessaires à chaque réponse, avec `store: false`.
      </Muted>
    </ScrollView>
  );
}
