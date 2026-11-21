import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { spacing } from '@/ui/theme/theme';
import { AppText, Card, EmptyState, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatAverage, formatDate } from '@/ui/format';

export default function ReportCardsScreen() {
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const [cards, periods] = await Promise.all([
      repos.school.listReportCards(activeAccountId),
      repos.school.listPeriods(activeAccountId),
    ]);
    return { cards, periods };
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des bulletins enregistrés…" />;
  if (!data || data.cards.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucun bulletin enregistré"
          description="PRONOTE ne fournit le carnet de notes que si l’onglet correspondant est autorisé pour ce compte. Lancez une synchronisation depuis l’onglet École."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      {data.cards.map((card) => {
        const period = data.periods.find((entry) => entry.id === card.periodId);
        return (
          <Card key={card.id} style={{ gap: spacing.sm }}>
            <AppText variant="heading">{period?.name ?? 'Période'}</AppText>
            <Muted>
              {period ? `${formatDate(period.startDate)} → ${formatDate(period.endDate)}` : ''} · importé le {formatDate(card.syncedAt)}
            </Muted>
            {card.overallAssessments.length > 0 ? (
              <View style={{ gap: 2, marginVertical: spacing.xs }}>
                {card.overallAssessments.map((assessment) => (
                  <Row key={assessment.name} title={assessment.name} right={<Muted>{assessment.value}</Muted>} />
                ))}
              </View>
            ) : null}
            {card.generalComment ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" color="textMuted">
                  Commentaire général
                </AppText>
                <AppText variant="body">{card.generalComment}</AppText>
              </View>
            ) : null}
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {card.subjects.map((subject) => (
                <View key={subject.id} style={{ gap: 2, paddingVertical: spacing.xs }}>
                  <Row
                    title={subject.subjectName}
                    subtitle={[
                      `coef ${subject.coefficient}`,
                      subject.teachers.length > 0 ? subject.teachers.join(', ') : null,
                      subject.classAverage !== null ? `classe ${formatAverage(subject.classAverage)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={<AppText variant="heading">{formatAverage(subject.studentAverage)}</AppText>}
                    accessory={null}
                  />
                  {subject.assessments.length > 0 ? (
                    <Muted>{subject.assessments.join(' — ')}</Muted>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}
