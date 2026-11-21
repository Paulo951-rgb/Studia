import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
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
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');

  const { data, loading } = useAsyncData(async (repos) => {
    const trimmed = query.trim();
    if (trimmed.length >= 2 && activeAccountId) {
      return repos.chat.searchConversations(activeAccountId, trimmed, 50);
    }
    return repos.chat.listConversations(100);
  }, [nonce, query, activeAccountId]);

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
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher dans mes conversations…"
        placeholderTextColor={palette.textFaint}
        style={{
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: palette.text,
        }}
      />
      {loading ? <Spinner /> : null}
      {data && data.length === 0 ? (
        <EmptyState
          title={query.trim().length >= 2 ? 'Aucun résultat' : 'Aucune conversation'}
          description={query.trim().length >= 2 ? 'La recherche porte sur le contenu des messages enregistrés.' : 'Vos échanges restent sur cet appareil.'}
        />
      ) : null}
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
        Les conversations ne sont jamais envoyées à un serveur Studia : il n’en existe aucun. OpenAI reçoit uniquement les
        messages nécessaires à chaque réponse, avec `store: false`.
      </Muted>
    </ScrollView>
  );
}
