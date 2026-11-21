import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, radius, spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDate, formatTime } from '@/ui/format';

export default function TimetableScreen() {
  const { palette } = usePalette();
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const to = new Date(now.getTime() + 21 * 24 * 3600 * 1000).toISOString();
    return repos.school.listTimetable({ accountId: activeAccountId, from, to, limit: 300 });
  }, [activeAccountId]);

  const days = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, typeof data>();
    for (const entry of data) {
      const day = entry.startsAt.slice(0, 10);
      const list = grouped.get(day) ?? [];
      list.push(entry);
      grouped.set(day, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [data]);

  if (loading) return <Spinner label="Lecture de l’emploi du temps…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucun cours enregistré"
          description="L’emploi du temps n’est disponible que si l’onglet est autorisé pour ce compte, et après une synchronisation."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      {days.map(([day, entries]) => (
        <View key={day} style={{ gap: spacing.sm }}>
          <AppText variant="heading">{formatDate(day)}</AppText>
          {entries.map((entry) => (
            <Card
              key={entry.id}
              style={{
                gap: 4,
                borderLeftWidth: 3,
                borderLeftColor: entry.canceled ? palette.danger : entry.isTest ? palette.warning : palette.accent,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="body" style={{ flex: 1, fontWeight: '600' }}>
                  {entry.subjectName ?? entry.title}
                </AppText>
                <Muted>
                  {formatTime(entry.startsAt)} – {formatTime(entry.endsAt)}
                </Muted>
              </View>
              <Muted>
                {[
                  entry.rooms.length > 0 ? `Salle ${entry.rooms.join(', ')}` : null,
                  entry.teachers.length > 0 ? entry.teachers.join(', ') : null,
                  entry.groups.length > 0 ? entry.groups.join(', ') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Muted>
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 }}>
                {entry.canceled ? <Chip label="Annulé" tone="danger" /> : null}
                {entry.isTest ? <Chip label="Contrôle prévu" tone="warning" /> : null}
                {entry.exempted ? <Chip label="Dispensé" /> : null}
                {entry.status ? <Chip label={entry.status} /> : null}
                {entry.virtualClassrooms.length > 0 ? <Chip label="Classe virtuelle" tone="accent" /> : null}
              </View>
            </Card>
          ))}
        </View>
      ))}
      <Muted style={{ color: palette.textFaint }}>
        Fenêtre affichée : 7 jours passés et 21 jours à venir, telle qu’importée lors de la dernière synchronisation.
      </Muted>
      <View style={{ height: radius.lg }} />
    </ScrollView>
  );
}
