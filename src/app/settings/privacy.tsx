import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/appStore';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Card, Muted, Row } from '@/ui/components/primitives';
import { wipeDatabase } from '@/platform/database';
import { wipeAllSecrets } from '@/platform/secureStore';

export default function PrivacyScreen() {
  const { palette } = usePalette();
  const router = useRouter();
  const accounts = useAppStore((state) => state.accounts);

  const [confirmStep, setConfirmStep] = useState(0);

  const wipeEverything = () => {
    Alert.alert(
      'Supprimer toutes les données locales ?',
      'Comptes, notes, messages, conversations, mémoire et clés seront supprimés de cet appareil. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await wipeDatabase();
              await wipeAllSecrets(accounts.map((account) => account.id));
              Alert.alert('Données supprimées', 'Fermez et relancez l’application.');
              setConfirmStep(2);
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Aucun serveur éditeur</AppText>
        <Muted>
          Scolary n’a ni backend, ni compte cloud, ni base centrale. Les données scolaires restent dans une base SQLite chiffrée
          sur ce téléphone. Seuls deux destinataires externes existent, et seulement à votre demande : votre établissement
          (PRONOTE) et OpenAI (si vous activez l’assistant).
        </Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Ce qui est stocké</AppText>
        <Row title="Base locale" subtitle="SQLite chiffrée (SQLCipher), clé aléatoire dans le trousseau" />
        <Row title="Secrets" subtitle="Jeton PRONOTE, UUID d’appareil, clé OpenAI : trousseau uniquement" />
        <Row title="Journaux" subtitle="Aucune télémétrie, aucun analytics, aucune publicité" />
        <Row title="Recherche" subtitle="Index FTS5 local, sans envoi réseau" />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Partage avec OpenAI</AppText>
        <Muted>
          Désactivé par défaut. Vous pouvez le retirer à tout moment. Chaque requête contient uniquement les messages de la
          conversation et les résultats d’outils nécessaires. `store: false` est demandé ; la politique de conservation du
          fournisseur s’applique pour la modération.
        </Muted>
        <Button label="Gérer le consentement" variant="secondary" onPress={() => router.push('/settings/ai')} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Mineurs et RGPD</AppText>
        <Muted>
          L’application traite des données scolaires pouvant concerner un mineur. Elle ne collecte rien d’autre que ce que
          PRONOTE expose au compte connecté, ne transmet rien sans action de l’utilisateur, et permet la suppression complète.
          La politique de confidentialité fournie dans le dépôt doit être relue et validée par l’établissement ou le
          responsable légal avant publication.
        </Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Suppression complète</AppText>
        <Muted>
          Supprime toutes les lignes de la base, l’index de recherche et les secrets du trousseau (jeton PRONOTE, UUID,
          clé OpenAI, clé de base). Aucune sauvegarde n’est conservée par l’application.
        </Muted>
        <Button label="Supprimer toutes les données locales" variant="danger" onPress={wipeEverything} />
        {confirmStep === 2 ? <Banner tone="info" title="Suppression effectuée" description="Relancez l’application pour repartir d’une base vide." /> : null}
      </Card>

      <Muted style={{ color: palette.textFaint }}>
        Les données déjà importées restent consultables hors ligne, y compris sans réseau et sans clé OpenAI.
      </Muted>
    </ScrollView>
  );
}
