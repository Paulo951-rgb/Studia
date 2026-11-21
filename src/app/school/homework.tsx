import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatDateTime } from '@/ui/format';

export default function HomeworkScreen() {
  const { palette } = usePalette();
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const [showDone, setShowDone] = useState(false);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const items = await repos.school.listHomework({ accountId: activeAccountId, includeDone: true, limit: 200 });
    return items;
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des devoirs…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState title="Aucun devoir enregistré" description="Synchronisez depuis l’onglet École pour importer les devoirs." />
      </View>
    );
  }

  const visible = data.filter((item) => (showDone ? true : !item.done));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label={`À faire (${data.filter((item) => !item.done).length})`} selected={!showDone} onPress={() => setShowDone(false)} />
        <Chip label={`Tous (${data.length})`} selected={showDone} onPress={() => setShowDone(true)} />
      </View>

      {visible.length === 0 ? <EmptyState title="Rien à faire" description="Tous les devoirs enregistrés sont marqués comme faits." /> : null}

      {visible.map((item) => (
        <Card key={item.id} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {item.subjectName}
            </AppText>
            <Chip label={formatDateTime(item.deadline)} tone={item.done ? 'success' : 'neutral'} />
          </View>
          {item.description ? <AppText variant="body">{item.description}</AppText> : <Muted>Pas de description fournie.</Muted>}
          <Muted>
            {[
              item.estimatedMinutes ? `~${item.estimatedMinutes} min` : null,
              item.themes.length > 0 ? item.themes.join(', ') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
          {item.attachments.length > 0 ? (
            <View style={{ gap: 4 }}>
              {item.attachments.map((attachment) => (
                <Row
                  key={attachment.id}
                  title={attachment.name}
                  subtitle="Pièce jointe PRONOTE"
                  onPress={() => {
                    if (attachment.url) void Linking.openURL(attachment.url).catch(() => undefined);
                  }}
                  accessory={<Muted>ouvrir</Muted>}
                />
              ))}
            </View>
          ) : null}
        </Card>
      ))}
      <Muted style={{ color: palette.textFaint }}>
        Les devoirs cochés proviennent de PRONOTE. L’application ne modifie pas l’état des devoirs côté PRONOTE.
      </Muted>
    </ScrollView>
  );
}
