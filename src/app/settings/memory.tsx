import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Button, Card, Chip, EmptyState, Field, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatRelative } from '@/ui/format';
import { saveMemory } from '@/providers/ai/service';

export default function MemoryScreen() {
  const { palette } = usePalette();
  const repos = useAppStore((state) => state.repos);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'user' | 'school'>('user');
  const [nonce, setNonce] = useState(0);

  const { data, loading } = useAsyncData(async (repo) => repo.writer.listMemories(activeAccountId ?? ''), [activeAccountId, nonce]);

  const remove = (id: string) => {
    Alert.alert('Supprimer cette mémoire ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          if (!repos) return;
          void repos.writer.deleteMemory(id).then(() => setNonce((current) => current + 1));
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Muted>
        La mémoire est séparée en deux portées : préférences utilisateur et informations scolaires. Elle reste sur l’appareil,
        peut être désactivée dans Réglages › Assistant IA, et chaque entrée peut être supprimée.
      </Muted>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Ajouter une mémoire</AppText>
        <Field label="Sujet" value={key} onChangeText={setKey} placeholder="Préférence de révision" />
        <Field label="Contenu" value={value} onChangeText={setValue} placeholder="Je préfère des fiches courtes avec des exemples." multiline />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Utilisateur" selected={scope === 'user'} onPress={() => setScope('user')} />
          <Chip label="Scolaire" selected={scope === 'school'} onPress={() => setScope('school')} />
        </View>
        <Button
          label="Enregistrer"
          disabled={!key.trim() || !value.trim()}
          onPress={() => {
            if (!repos) return;
            void saveMemory(repos, { accountId: activeAccountId, scope, key, value }).then(() => {
              setKey('');
              setValue('');
              setNonce((current) => current + 1);
            });
          }}
        />
      </Card>

      {loading ? <Spinner /> : null}
      {data && data.length === 0 ? <EmptyState title="Aucune mémoire" description="Rien n’est mémorisé pour le moment." /> : null}

      {data?.map((memory) => (
        <Card key={memory.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
              {memory.key}
            </AppText>
            <Chip label={memory.scope === 'user' ? 'utilisateur' : 'scolaire'} />
          </View>
          <AppText variant="body">{memory.value}</AppText>
          <Row
            title={<Muted>modifiée {formatRelative(memory.updatedAt)}</Muted>}
            right={
              <Pressable onPress={() => remove(memory.id)} hitSlop={8}>
                <Muted style={{ color: palette.danger }}>supprimer</Muted>
              </Pressable>
            }
            accessory={null}
          />
        </Card>
      ))}
    </ScrollView>
  );
}
