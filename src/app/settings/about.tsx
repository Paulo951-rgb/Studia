import React from 'react';
import { ScrollView, View } from 'react-native';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Card, Muted } from '@/ui/components/primitives';
import { CAPABILITIES } from '@/core/pronote/capabilities';

const DEPENDENCIES = [
  { name: 'expo', version: '58.0.26', license: 'MIT', role: 'Runtime et compilation' },
  { name: 'react-native', version: '0.88.1', license: 'MIT', role: 'Interface native' },
  { name: 'expo-router', version: '58.0.32', license: 'MIT', role: 'Navigation' },
  { name: 'expo-sqlite', version: '58.0.18', license: 'MIT', role: 'Base locale, SQLCipher sur build natif' },
  { name: 'expo-secure-store', version: '58.0.3', license: 'MIT', role: 'Trousseau (secrets)' },
  { name: 'expo-camera', version: '58.0.14', license: 'MIT', role: 'Scan du QR code PRONOTE' },
  { name: 'expo-background-task', version: '58.0.13', license: 'MIT', role: 'Tâches opportunistes' },
  { name: 'expo-clipboard', version: '58.0.4', license: 'MIT', role: 'Copier une réponse' },
  { name: 'zustand', version: '5.1.0', license: 'MIT', role: 'État applicatif' },
  { name: '@blockshub/pawnote-lts', version: '1.6.4', license: 'GPL-3.0-or-later', role: 'Connecteur PRONOTE (fork maintenu de Pawnote)' },
];

export default function AboutScreen() {
  const { palette } = usePalette();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Card style={{ gap: spacing.xs }}>
        <AppText variant="title">Studia</AppText>
        <Muted>Version 0.1.0 · application locale Android et iOS</Muted>
        <Muted>
          Assistant conversationnel adossé à PRONOTE. Aucun serveur éditeur, aucune base centrale, aucune télémétrie.
        </Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Dépendances principales</AppText>
        {DEPENDENCIES.map((dependency) => (
          <View key={dependency.name} style={{ gap: 2 }}>
            <AppText variant="body">
              {dependency.name} <Muted>{dependency.version}</Muted>
            </AppText>
            <Muted>
              {dependency.license} · {dependency.role}
            </Muted>
          </View>
        ))}
        <Muted style={{ marginTop: spacing.sm }}>
          Le connecteur Pawnote est distribué sous GPL-3.0-or-later : toute distribution de l’application doit respecter cette
          licence (code source correspondant disponible). Les autres dépendances sont sous licence MIT.
        </Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Limites connues</AppText>
        <Muted>• Connexion ENT/CAS non implémentée (navigateur et authentification humaine requis).</Muted>
        <Muted>• Envoi de messages PRONOTE volontairement désactivé : lecture seule.</Muted>
        <Muted>• Texte interne des PDF non extrait : PRONOTE ne le fournit pas.</Muted>
        <Muted>• Le chiffrement SQLCipher dépend du build natif ; l’application refuse de démarrer sans lui.</Muted>
        <Muted>• Les tâches d’arrière-plan sont opportunistes : le système peut les reporter.</Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Capacités du connecteur</AppText>
        {CAPABILITIES.map((capability) => (
          <View key={capability.key} style={{ gap: 1 }}>
            <AppText variant="caption">
              {capability.label} — {capability.status === 'supported' ? 'prise en charge' : capability.status === 'conditional' ? 'conditionnelle' : 'indisponible'}
            </AppText>
            {capability.api ? <Muted>{capability.api.join(', ')}</Muted> : null}
          </View>
        ))}
      </Card>

      <Muted style={{ color: palette.textFaint, textAlign: 'center' }}>
        Studia n’est pas affilié à Index Education. PRONOTE est une marque de son propriétaire.
      </Muted>
    </ScrollView>
  );
}
