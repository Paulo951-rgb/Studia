import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/state/appStore';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Card, Muted, Row } from '@/ui/components/primitives';

/**
 * These actions do not compute anything themselves: they open a conversation with a
 * precise request, and the assistant answers through the local tools. Anything the
 * model infers is therefore labelled as an interpretation, never as a PRONOTE figure.
 */
const ACTIONS = [
  {
    title: 'Bilan de la semaine',
    prompt:
      'Fais un bilan de ma semaine scolaire : devoirs à rendre, contrôles prévus, absences, messages importants et actualités. Utilise les outils locaux, cite les dates exactes et sépare clairement les faits issus de PRONOTE de tes interprétations.',
  },
  {
    title: 'Planifier mes devoirs',
    prompt:
      'Planifie mes devoirs des 7 prochains jours, jour par jour, en tenant compte des contrôles de mon emploi du temps. Indique la source de chaque échéance et précise que la répartition est une suggestion.',
  },
  {
    title: 'Fiche de révision',
    prompt:
      'Prépare une fiche de révision pour la matière où j’ai un contrôle bientôt, en t’appuyant sur mes devoirs, mes documents et les remarques de mes professeurs. Cite les éléments d’origine et indique ce qui relève de ta synthèse.',
  },
  {
    title: 'QCM d’entraînement',
    prompt:
      'Propose un QCM de 10 questions sur le chapitre qui arrive, avec les corrigés à la fin. Précise que les questions sont générées par toi et ne proviennent pas de PRONOTE.',
  },
  {
    title: 'Flashcards',
    prompt:
      'Propose 12 flashcards (recto/verso) sur les notions à revoir d’après mes derniers devoirs et remarques. Précise que le contenu est une aide générée par toi.',
  },
  {
    title: 'Comparer les périodes',
    prompt:
      'Compare mes moyennes entre les périodes disponibles, matière par matière. Utilise les moyennes publiées par PRONOTE pour les faits, et signale les écarts calculés localement.',
  },
];

export default function RevisionScreen() {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const startNewConversation = useAppStore((state) => state.startNewConversation);
  const send = useAppStore((state) => state.send);
  const streaming = useAppStore((state) => state.streaming);

  const run = async (prompt: string) => {
    if (streaming) return;
    await startNewConversation();
    router.navigate('/');
    await send(prompt);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <AppText variant="title">Révisions et bilans</AppText>
      <Muted>
        Chaque action ouvre une conversation dans l’onglet Assistant. L’assistant lit vos données locales via ses outils ;
        les calculs de moyenne restent exacts et étiquetés, le reste est présenté comme une aide générée.
      </Muted>

      {!activeAccountId ? (
        <Banner
          tone="warning"
          title="Aucun compte PRONOTE"
          description="Sans compte synchronisé, l’assistant n’a aucune donnée scolaire à lire."
        />
      ) : null}

      <Card style={{ gap: 0 }}>
        {ACTIONS.map((action) => (
          <Row
            key={action.title}
            title={action.title}
            subtitle={action.prompt.slice(0, 90) + '…'}
            onPress={() => void run(action.prompt)}
          />
        ))}
      </Card>

      <Muted style={{ color: palette.textFaint }}>
        Aucun envoi n’a lieu sans consentement explicite et sans votre propre clé API OpenAI.
      </Muted>
    </ScrollView>
  );
}
