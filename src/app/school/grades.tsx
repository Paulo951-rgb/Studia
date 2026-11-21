import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Card, Chip, EmptyState, Field, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatAverage, formatDate, formatGrade, GRADE_KIND_LABELS } from '@/ui/format';
import { computeGradesAverage, computeOverallAverage, simulateGrade, buildProgression } from '@/core/school/averages';

export default function GradesScreen() {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading, reload } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const periods = await repos.school.listPeriods(activeAccountId);
    const subjects = await repos.school.listSubjects(activeAccountId);
    const grades = await repos.school.listGrades({ accountId: activeAccountId, limit: 500 });
    const averages = await repos.school.listAverages({ accountId: activeAccountId });
    return { periods, subjects, grades, averages };
  }, [activeAccountId]);

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [simSubject, setSimSubject] = useState('');
  const [simPoints, setSimPoints] = useState('');
  const [simOutOf, setSimOutOf] = useState('20');
  const [simCoef, setSimCoef] = useState('1');
  const [simResult, setSimResult] = useState<{ before: number | null; after: number | null; delta: number | null } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  if (!activeAccountId) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, padding: spacing.lg }}>
        <EmptyState title="Aucun compte connecté" description="Connectez PRONOTE pour importer vos notes." />
      </View>
    );
  }

  if (loading) return <Spinner label="Lecture du cache local…" />;
  if (!data) return <EmptyState title="Aucune donnée" description="Lancez une synchronisation depuis l’onglet École." />;

  const currentPeriod = data.periods.find((period) => period.id === periodId) ?? data.periods.find((period) => period.isDefault) ?? data.periods[data.periods.length - 1] ?? null;
  const periodGrades = currentPeriod ? data.grades.filter((grade) => grade.periodId === currentPeriod.id) : data.grades;
  const periodAverages = currentPeriod ? data.averages.filter((average) => average.periodId === currentPeriod.id) : data.averages;

  const pronoteAverages = periodAverages.filter((average) => average.source === 'pronote');
  const computedAverages = periodAverages.filter((average) => average.source === 'computed');

  const subjectsForPeriod = data.subjects.filter((subject) => periodGrades.some((grade) => grade.subjectId === subject.id));
  const progression = buildProgression(
    data.periods.map((period) => ({
      periodId: period.id,
      periodName: period.name,
      startDate: period.startDate,
      grades: data.grades.filter((grade) => grade.periodId === period.id),
    })),
  );

  const subjectName = (subjectId: string | null) => data.subjects.find((subject) => subject.id === subjectId)?.name ?? 'Moyenne générale';

  const runSimulation = () => {
    setSimError(null);
    setSimResult(null);
    const subject = subjectsForPeriod.find((entry) => entry.name.toLowerCase().includes(simSubject.toLowerCase().trim()));
    if (!subject) {
      setSimError('Matière introuvable dans les notes synchronisées.');
      return;
    }
    const points = Number(simPoints.replace(',', '.'));
    const outOf = Number(simOutOf.replace(',', '.'));
    const coefficient = Number(simCoef.replace(',', '.'));
    if (!Number.isFinite(points) || !Number.isFinite(outOf) || !Number.isFinite(coefficient)) {
      setSimError('Valeurs numériques invalides.');
      return;
    }
    try {
      const grades = periodGrades.filter((grade) => grade.subjectId === subject.id);
      const result = simulateGrade({ currentGrades: grades, hypothetical: { points, outOf, coefficient } });
      setSimResult({ before: result.currentAverage, after: result.simulatedAverage, delta: result.delta });
    } catch (error) {
      setSimError(error instanceof Error ? error.message : 'Simulation impossible');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      {data.periods.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {data.periods.map((period) => (
            <Chip key={period.id} label={period.name} selected={currentPeriod?.id === period.id} onPress={() => setPeriodId(period.id)} />
          ))}
        </ScrollView>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Moyennes PRONOTE</AppText>
        <Muted>Valeurs calculées par PRONOTE et importées telles quelles.</Muted>
        {pronoteAverages.length === 0 ? (
          <Muted>Aucune moyenne PRONOTE enregistrée pour cette période.</Muted>
        ) : (
          pronoteAverages.map((average) => (
            <Row
              key={average.id}
              title={subjectName(average.subjectId)}
              subtitle={average.classValue !== null ? `Classe : ${formatAverage(average.classValue)}` : undefined}
              right={<AppText variant="heading">{formatAverage(average.studentValue)}</AppText>}
            />
          ))
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Calculs locaux</AppText>
        <Muted>
          Recalcul à partir des notes et coefficients stockés. Peut différer de l’arrondi officiel de PRONOTE.
        </Muted>
        {computedAverages.length === 0 ? (
          <Muted>Aucun calcul local disponible (aucune note pour cette période).</Muted>
        ) : (
          computedAverages.map((average) => (
            <Row key={average.id} title={subjectName(average.subjectId)} right={<Muted>{formatAverage(average.studentValue)}</Muted>} />
          ))
        )}
        {(() => {
          const overall = computeOverallAverage(
            subjectsForPeriod.map((subject) => ({
              subjectId: subject.id,
              subjectName: subject.name,
              grades: periodGrades.filter((grade) => grade.subjectId === subject.id),
              subjectCoefficient: null,
            })),
          );
          if (overall.value === null) return null;
          return (
            <Banner
              tone="info"
              title={`Moyenne générale ${overall.isEstimate ? 'estimée' : 'calculée'} : ${formatAverage(overall.value)}`}
              description={
                overall.isEstimate
                  ? 'Coefficients de matière indisponibles : pondération à égalité, donc estimation.'
                  : 'Calcul pondéré par les coefficients de matière.'
              }
            />
          );
        })()}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Progression par période</AppText>
        <Muted>Moyenne recalculée localement sur les notes de chaque période.</Muted>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, height: 120, marginTop: spacing.sm }}>
          {progression.map((point) => {
            const height = point.value === null ? 2 : Math.max(4, (point.value / 20) * 110);
            return (
              <View key={point.periodId} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Muted>{point.value === null ? '—' : point.value.toFixed(1)}</Muted>
                <View style={{ width: '70%', height, backgroundColor: palette.accent, borderRadius: 6, opacity: point.value === null ? 0.3 : 1 }} />
                <Muted numberOfLines={1}>{point.periodName}</Muted>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Simuler une note</AppText>
        <Muted>
          Simulation locale uniquement : ce n’est ni une note réelle, ni une prévision officielle.
        </Muted>
        <Field label="Matière" value={simSubject} onChangeText={setSimSubject} placeholder={subjectsForPeriod[0]?.name ?? 'Mathématiques'} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Note" value={simPoints} onChangeText={setSimPoints} keyboardType="numeric" placeholder="15" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Barème" value={simOutOf} onChangeText={setSimOutOf} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Coefficient" value={simCoef} onChangeText={setSimCoef} keyboardType="numeric" />
          </View>
        </View>
        <Button label="Calculer la simulation" onPress={runSimulation} />
        {simError ? <Muted style={{ color: palette.danger }}>{simError}</Muted> : null}
        {simResult ? (
          <Banner
            tone="info"
            title={`Simulation : ${formatAverage(simResult.before)} → ${formatAverage(simResult.after)}`}
            description={`Variation : ${simResult.delta !== null && simResult.delta > 0 ? '+' : ''}${simResult.delta ?? '—'} point(s). Résultat de simulation, pas une note.`}
          />
        ) : null}
      </Card>

      <Card style={{ gap: spacing.xs }}>
        <AppText variant="heading" style={{ marginBottom: spacing.xs }}>
          Notes ({periodGrades.length})
        </AppText>
        {periodGrades.length === 0 ? <Muted>Aucune note enregistrée pour cette période.</Muted> : null}
        {periodGrades.map((grade) => (
          <Row
            key={grade.id}
            title={`${grade.subjectName} · ${formatGrade(grade.valuePoints, grade.outOfPoints)}`}
            subtitle={[
              formatDate(grade.gradedAt),
              `coef ${grade.coefficient}`,
              GRADE_KIND_LABELS[grade.valueKind] && grade.valueKind !== 0 ? GRADE_KIND_LABELS[grade.valueKind] : null,
              grade.classAverage !== null ? `moy. classe ${grade.classAverage.toFixed(2).replace('.', ',')}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={null}
            accessory={null}
          />
        ))}
        <Button label="Rafraîchir" variant="ghost" onPress={reload} />
      </Card>
    </ScrollView>
  );
}
