import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Button, Card, Chip, EmptyState, Muted, Row, Spinner } from '@/ui/components/primitives';
import { formatDateTime, formatRelative } from '@/ui/format';
import { PRONOTE_ERROR_LABELS, type PronoteErrorCode } from '@/core/pronote/errors';
import { SYNC_ORDER } from '@/core/sync/engine';
import { isBackgroundSyncEnabled, setBackgroundSyncEnabled } from '@/platform/backgroundSync';

export default function SyncScreen() {
  const { palette } = usePalette();
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const syncRunning = useAppStore((state) => state.syncRunning);
  const syncNow = useAppStore((state) => state.syncNow);
  const lastSyncSummary = useAppStore((state) => state.lastSyncSummary);
  const [backgroundSync, setBackgroundSync] = useState(false);

  useEffect(() => {
    void isBackgroundSyncEnabled()
      .then(setBackgroundSync)
      .catch(() => setBackgroundSync(false));
  }, []);

  const { data, loading, reload } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    const [history, account] = await Promise.all([
      repos.sync.listRuns(activeAccountId, 10),
      repos.accounts.get(activeAccountId),
    ]);
    return { history, account };
  }, [activeAccountId, lastSyncSummary?.runId]);

  if (!activeAccountId) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState title="Aucun compte" description="Connectez PRONOTE pour synchroniser." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">État</AppText>
        <Row title="Dernière synchronisation" right={<Muted>{data?.account?.lastSyncAt ? formatRelative(data.account.lastSyncAt) : 'jamais'}</Muted>} />
        <Row title="Statut du compte" right={<Chip label={data?.account?.status ?? '—'} tone={data?.account?.status === 'active' ? 'success' : 'warning'} />} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label={syncRunning ? 'Synchronisation…' : 'Synchroniser maintenant'} onPress={() => void syncNow('manual').then(reload)} loading={syncRunning} style={{ flex: 1 }} />
        </View>
        <Muted>
          Une synchronisation incrémentale est tentée à l’ouverture de l’application si la dernière date de plus de 10 minutes.
          Le budget de requêtes est plafonné pour ne pas surcharger le serveur de l’établissement.
        </Muted>
        <Row
          title="Actualisation en arrière-plan"
          subtitle="Opportuniste : le système décide du moment, sans garantie de fréquence."
          right={
            <Switch
              value={backgroundSync}
              onValueChange={(value) => {
                setBackgroundSync(value);
                void setBackgroundSyncEnabled(value).catch(() => setBackgroundSync(!value));
              }}
              trackColor={{ false: palette.border, true: palette.accent }}
            />
          }
        />
      </Card>

      {lastSyncSummary ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">Dernière exécution</AppText>
          <Muted>
            {lastSyncSummary.kind} · {lastSyncSummary.requests} requête(s) · {formatDateTime(lastSyncSummary.startedAt)}
          </Muted>
          {lastSyncSummary.errorCode ? (
            <Muted style={{ color: palette.danger }}>
              {PRONOTE_ERROR_LABELS[lastSyncSummary.errorCode as PronoteErrorCode] ?? lastSyncSummary.errorCode}
            </Muted>
          ) : null}
          {SYNC_ORDER.filter((resource) => lastSyncSummary.resources[resource]).map((resource) => {
            const report = lastSyncSummary.resources[resource];
            if (!report) return null;
            return (
              <Row
                key={resource}
                title={resource}
                subtitle={report.errorCode ? report.errorMessage ?? report.errorCode : undefined}
                right={<Chip label={report.status} tone={report.status === 'ok' ? 'success' : report.status === 'skipped' ? 'warning' : 'danger'} />}
              />
            );
          })}
        </Card>
      ) : null}

      {loading ? <Spinner /> : null}

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Historique</AppText>
        {data?.history.length === 0 ? <Muted>Aucune synchronisation enregistrée.</Muted> : null}
        {data?.history.map((run) => (
          <Row
            key={run.id}
            title={`${run.kind} · ${run.status}`}
            subtitle={[formatDateTime(run.startedAt), run.errorCode ? PRONOTE_ERROR_LABELS[run.errorCode as PronoteErrorCode] ?? run.errorCode : null]
              .filter(Boolean)
              .join(' · ')}
            right={run.durationMs !== null ? <Muted>{Math.round(run.durationMs / 100) / 10}s</Muted> : null}
            accessory={null}
          />
        ))}
      </Card>
    </ScrollView>
  );
}
