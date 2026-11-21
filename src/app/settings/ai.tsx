import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Card, Chip, Field, Muted, Row } from '@/ui/components/primitives';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  getModel,
  grantAiConsent,
  hasAiConsent,
  memoryEnabled,
  revokeAiConsent,
  setMemoryEnabled,
  setModel,
} from '@/providers/ai/service';
import { deleteOpenAiKey, getOpenAiKey, setOpenAiKey } from '@/platform/secureStore';
import { formatUsd } from '@/core/ai/cost';
import type { AiUsageSummary } from '@/core/domain/types';

export default function AiSettingsScreen() {
  const { palette } = usePalette();
  const repos = useAppStore((state) => state.repos);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);
  const [model, setModelState] = useState(DEFAULT_MODEL);
  const [memory, setMemory] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);

  useEffect(() => {
    void getOpenAiKey().then((key) => setHasKey(Boolean(key)));
    if (!repos) return;
    void hasAiConsent(repos).then(setConsent);
    void getModel(repos).then(setModelState);
    void memoryEnabled(repos).then(setMemory);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    void repos.usage
      .summary({ accountId: null, since: monthStart.toISOString() })
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [repos]);

  const saveKey = async () => {
    try {
      await setOpenAiKey(keyInput);
      setKeyInput('');
      setHasKey(true);
      setMessage('Clé enregistrée dans le trousseau du système.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Banner
        tone="warning"
        title="Votre clé, vos coûts"
        description="Studia n’embarque aucune clé commune. Vous utilisez votre propre clé API OpenAI, facturée par OpenAI. Un abonnement ChatGPT Plus ne donne pas accès à l’API."
      />

      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Clé API OpenAI</AppText>
        <Muted>
          Stockée dans le trousseau sécurisé (Keychain / Keystore), jamais dans la base SQLite, les journaux ou le code. Sur un
          téléphone, une clé reste extractible par le propriétaire de l’appareil : ce n’est pas un secret inviolable.
        </Muted>
        <Row title="État" right={<Chip label={hasKey ? 'clé enregistrée' : 'aucune clé'} tone={hasKey ? 'success' : 'warning'} />} />
        <Field
          label={hasKey ? 'Remplacer la clé' : 'Clé API'}
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="sk-…"
          secureTextEntry
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Enregistrer" onPress={() => void saveKey()} disabled={keyInput.trim().length === 0} style={{ flex: 1 }} />
          <Button
            label="Supprimer"
            variant="secondary"
            onPress={() => {
              Alert.alert('Supprimer la clé OpenAI ?', 'L’assistant ne pourra plus répondre.', [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: () => {
                    void deleteOpenAiKey().then(() => {
                      setHasKey(false);
                      setMessage('Clé supprimée.');
                    });
                  },
                },
              ]);
            }}
            style={{ flex: 1 }}
          />
        </View>
        {message ? <Muted>{message}</Muted> : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Consentement d’envoi</AppText>
        <Muted>
          Tant que vous n’acceptez pas, aucune requête n’est envoyée à OpenAI. Les questions et les extraits de données
          nécessaires (notes, messages, devoirs…) sont transmis directement depuis ce téléphone, sans serveur intermédiaire.
          La requête utilise `store: false` : OpenAI ne conserve pas la réponse pour récupération ultérieure, mais peut
          conserver des journaux de modération selon sa politique.
        </Muted>
        <Row title="Consentement" right={<Chip label={consent ? 'accordé' : 'non accordé'} tone={consent ? 'success' : 'warning'} />} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="J’accepte l’envoi"
            onPress={() => {
              if (!repos) return;
              void grantAiConsent(repos).then(() => setConsent(true));
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Retirer"
            variant="secondary"
            onPress={() => {
              if (!repos) return;
              void revokeAiConsent(repos).then(() => setConsent(false));
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Modèle</AppText>
        <Muted>La liste est limitée aux modèles exposés par l’API Responses au moment de la rédaction.</Muted>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {AVAILABLE_MODELS.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              selected={model === entry.id}
              onPress={() => {
                if (!repos) return;
                void setModel(repos, entry.id).then(() => setModelState(entry.id));
              }}
            />
          ))}
        </View>
        <Muted>Identifiant envoyé : {model}</Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Consommation ce mois-ci</AppText>
        <Row title="Requêtes" right={<Muted>{usage ? String(usage.requests) : '—'}</Muted>} />
        <Row
          title="Tokens"
          subtitle="entrée / sortie"
          right={<Muted>{usage ? `${usage.inputTokens} / ${usage.outputTokens}` : '—'}</Muted>}
        />
        <Row title="Coût estimé" right={<Muted>{usage ? formatUsd(usage.estimatedCostUsd) : '—'}</Muted>} />
        {usage && usage.unknownCostRequests > 0 ? (
          <Muted>
            {usage.unknownCostRequests} requête(s) sans estimation : le modèle n’est pas dans le barème local.
          </Muted>
        ) : null}
        <Muted style={{ color: palette.textFaint }}>
          Estimation calculée sur ce téléphone à partir d’un barème local indicatif, sans télémétrie. Seule la facturation
          OpenAI fait foi ; consultez la page tarifaire officielle pour les prix à jour.
        </Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Mémoire</AppText>
        <Muted>La mémoire locale ajoute vos préférences au contexte. Elle ne quitte pas l’appareil sauf dans la requête en cours.</Muted>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip
            label="Activée"
            selected={memory}
            onPress={() => {
              if (!repos) return;
              void setMemoryEnabled(repos, true).then(() => setMemory(true));
            }}
          />
          <Chip
            label="Désactivée"
            selected={!memory}
            onPress={() => {
              if (!repos) return;
              void setMemoryEnabled(repos, false).then(() => setMemory(false));
            }}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
