import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { spacing } from '@/ui/theme/theme';
import { AppText, Card, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDate } from '@/ui/format';

export default function DocumentsScreen() {
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    return repos.school.listDocuments({ accountId: activeAccountId, limit: 100 });
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture du cahier de textes…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucun document"
          description="Le cahier de textes n’est disponible que si l’onglet est autorisé pour ce compte, après synchronisation."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      {data.map((document) => (
        <Card key={document.id} style={{ gap: 4 }}>
          <AppText variant="heading">{document.title}</AppText>
          <Muted>
            {[document.subjectName, document.category, formatDate(document.startsAt)].filter(Boolean).join(' · ')}
          </Muted>
          {document.descriptionText ? <AppText variant="body">{document.descriptionText}</AppText> : <Muted>Pas de description fournie.</Muted>}
        </Card>
      ))}
      <Muted>
        PRONOTE ne fournit pas le texte interne des PDF : l’application affiche le titre, la description et le lien de la pièce
        jointe, sans prétendre avoir lu le document.
      </Muted>
    </ScrollView>
  );
}
