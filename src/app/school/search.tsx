import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Field, Muted, Spinner } from '@/ui/components/primitives';
import type { SearchKind } from '@/db/repositories/search';

const KINDS: { key: SearchKind; label: string }[] = [
  { key: 'message', label: 'Messages' },
  { key: 'document', label: 'Documents' },
  { key: 'homework', label: 'Devoirs' },
  { key: 'grade_comment', label: 'Appréciations' },
  { key: 'news', label: 'Actualités' },
  { key: 'evaluation', label: 'Évaluations' },
  { key: 'report_card', label: 'Bulletins' },
];

export default function SearchScreen() {
  const { palette } = usePalette();
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<SearchKind[]>([]);
  const [submitted, setSubmitted] = useState('');

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId || submitted.trim().length === 0) return [];
    return repos.search.search({
      query: submitted,
      accountId: activeAccountId,
      ...(kinds.length > 0 ? { kinds } : {}),
      limit: 40,
    });
  }, [activeAccountId, submitted, kinds.join(',')]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <Field
        label="Recherche locale (FTS5)"
        value={query}
        onChangeText={setQuery}
        placeholder="ex. oral, contrôle, sortie scolaire"
        hint="La recherche s’exécute sur l’appareil, sans envoi réseau."
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {KINDS.map((kind) => (
          <Chip
            key={kind.key}
            label={kind.label}
            selected={kinds.includes(kind.key)}
            onPress={() =>
              setKinds((current) => (current.includes(kind.key) ? current.filter((entry) => entry !== kind.key) : [...current, kind.key]))
            }
          />
        ))}
      </View>
      <Chip label="Rechercher" tone="accent" selected onPress={() => setSubmitted(query)} />

      {loading ? <Spinner /> : null}
      {!loading && submitted && data?.length === 0 ? <EmptyState title="Aucun résultat" description="Essayez d’autres termes ou vérifiez que les données sont synchronisées." /> : null}

      {data?.map((hit) => (
        <Card key={`${hit.kind}-${hit.refId}`} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
              {hit.title}
            </AppText>
            <Chip label={hit.kind} />
          </View>
          <Muted>{hit.snippet}</Muted>
        </Card>
      ))}
    </ScrollView>
  );
}
