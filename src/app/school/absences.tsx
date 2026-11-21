import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Spinner, Stat } from '@/ui/components/primitives';
import { formatDateTime } from '@/ui/format';

export default function AbsencesScreen() {
  const { palette } = usePalette();
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    return repos.school.listAbsences({ accountId: activeAccountId, limit: 200 });
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des absences…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucune absence enregistrée"
          description="Le carnet de correspondance PRONOTE n’est disponible que si l’onglet est autorisé pour ce compte."
        />
      </View>
    );
  }

  const absences = data.filter((entry) => entry.kind === 'absence');
  const delays = data.filter((entry) => entry.kind === 'delay');
  const totalMinutes = absences.reduce((total, entry) => total + (entry.minutes ?? 0), 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <View style={{ flexDirection: 'row', gap: spacing.xl }}>
        <Stat label="Absences" value={String(absences.length)} />
        <Stat label="Retards" value={String(delays.length)} />
        <Stat label="Heures manquées" value={(totalMinutes / 60).toFixed(1).replace('.', ',')} />
      </View>

      {data.map((entry) => (
        <Card key={entry.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
              {entry.kind === 'absence' ? 'Absence' : 'Retard'}
            </AppText>
            <Chip label={entry.justified ? 'justifié' : 'non justifié'} tone={entry.justified ? 'success' : 'warning'} />
          </View>
          <Muted>
            {formatDateTime(entry.startsAt)}
            {entry.endsAt ? ` → ${formatDateTime(entry.endsAt)}` : ''}
          </Muted>
          <Muted>
            {[
              entry.minutes !== null ? `${entry.minutes} min` : null,
              entry.daysMissed !== null ? `${entry.daysMissed} jour(s)` : null,
              entry.shouldParentsJustify ? 'justificatif attendu' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
          {entry.reason ? <AppText variant="body">Motif : {entry.reason}</AppText> : null}
        </Card>
      ))}
      <Muted style={{ color: palette.textFaint }}>
        Certains motifs peuvent être masqués par l’établissement ; l’application n’invente jamais de motif.
      </Muted>
    </ScrollView>
  );
}
