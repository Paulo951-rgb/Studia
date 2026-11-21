import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '@/state/appStore';
import { usePalette, radius, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Chip, Muted } from '@/ui/components/primitives';
import { MarkdownLite } from '@/ui/components/MarkdownLite';
import { hasAiConsent, AI_ERROR_LABELS } from '@/providers/ai/service';
import { toolLabel, formatRelative } from '@/ui/format';

const SUGGESTIONS = [
  'Quelle est ma moyenne générale ce trimestre ?',
  'Résume mes devoirs pour les 7 prochains jours.',
  'Que disent les professeurs sur mon travail en maths ?',
  'Ai-je des messages non lus importants ?',
];

export default function ChatScreen() {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const messages = useAppStore((state) => state.messages);
  const streamingText = useAppStore((state) => state.streamingText);
  const streaming = useAppStore((state) => state.streaming);
  const toolActivity = useAppStore((state) => state.toolActivity);
  const lastError = useAppStore((state) => state.lastError);
  const accounts = useAppStore((state) => state.accounts);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const syncRunning = useAppStore((state) => state.syncRunning);
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const send = useAppStore((state) => state.send);
  const cancel = useAppStore((state) => state.cancel);
  const startNewConversation = useAppStore((state) => state.startNewConversation);
  const regenerate = useAppStore((state) => state.regenerate);
  const model = useAppStore((state) => state.model);

  const [input, setInput] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);

  const account = accounts.find((entry) => entry.id === activeAccountId) ?? null;

  useEffect(() => {
    const repos = useAppStore.getState().repos;
    if (!repos) return;
    void hasAiConsent(repos).then(setConsent);
  }, [lastError, messages.length]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length, streamingText]);

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text);
  }, [input, send, streaming]);

  const errorLabel = lastError ? (AI_ERROR_LABELS[lastError] ?? `Erreur : ${lastError}`) : null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/history')} style={styles.headerButton} accessibilityLabel="Historique des conversations">
          <AppText variant="heading" color="textMuted">
            ☰
          </AppText>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="heading">Studia</AppText>
          <Muted numberOfLines={1}>
            {account
              ? `${account.studentName ?? account.displayName} · ${account.className ?? account.establishmentName ?? ''}`
              : 'Aucun compte PRONOTE'}
          </Muted>
        </View>
        <Pressable onPress={() => void startNewConversation()} style={styles.headerButton} accessibilityLabel="Nouvelle conversation">
          <AppText variant="heading" color="textMuted">
            ＋
          </AppText>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <Chip
          label={syncRunning ? 'Synchronisation…' : lastSyncAt ? `Synchronisé ${formatRelative(lastSyncAt)}` : 'Jamais synchronisé'}
          tone={syncRunning ? 'accent' : lastSyncAt ? 'success' : 'warning'}
          onPress={() => router.push('/settings/sync')}
        />
        <Chip
          label={consent === false ? 'Envoi IA désactivé' : 'Envoi IA autorisé'}
          tone={consent === false ? 'warning' : 'neutral'}
          onPress={() => router.push('/settings/ai')}
        />
        <Chip label={model} tone="neutral" onPress={() => router.push('/settings/ai')} />
      </View>

      {consent === false ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Banner
            tone="warning"
            title="Envoi vers OpenAI désactivé"
            description="Aucune donnée scolaire ne quitte l’appareil tant que vous n’avez pas accepté le partage dans Réglages › Assistant IA."
          />
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !streaming ? (
          <View style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="title">Bonjour.</AppText>
              <AppText variant="body" color="textMuted">
                Je réponds à partir des données PRONOTE enregistrées sur cet appareil. Rien n’est envoyé tant que vous n’avez
                pas accepté le partage, et je distingue toujours les données PRONOTE de mes calculs et de mes estimations.
              </AppText>
            </View>
            <View style={{ gap: spacing.sm }}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => setInput(suggestion)}
                  style={({ pressed }) => ({
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <AppText variant="body">{suggestion}</AppText>
                </Pressable>
              ))}
            </View>
            {!account ? <Button label="Connecter PRONOTE" onPress={() => router.push('/connect')} /> : null}
          </View>
        ) : null}

        {messages.map((message, messageIndex) => {
          const isUser = message.role === 'user';
          const isLast = messageIndex === messages.length - 1;
          return (
            <View
              key={message.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                backgroundColor: isUser ? palette.bubbleUser : palette.bubbleAssistant,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              {message.contentText ? <MarkdownLite content={message.contentText} /> : null}
              {message.toolCalls && message.toolCalls.length > 0 ? (
                <View style={{ gap: 4 }}>
                  {message.toolCalls.map((call) => (
                    <Muted key={call.id}>⚙ {toolLabel(call.name)}</Muted>
                  ))}
                </View>
              ) : null}
              {message.status === 'error' && message.errorCode ? (
                <Muted style={{ color: palette.danger }}>{AI_ERROR_LABELS[message.errorCode] ?? message.errorCode}</Muted>
              ) : null}
              {!isUser && message.contentText ? (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Pressable onPress={() => void Clipboard.setStringAsync(message.contentText)}>
                    <Muted>Copier</Muted>
                  </Pressable>
                  {isLast && !streaming ? (
                    <Pressable onPress={() => void regenerate()} accessibilityLabel="Régénérer la réponse">
                      <Muted>Régénérer</Muted>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {streaming ? (
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '92%',
              backgroundColor: palette.bubbleAssistant,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            {toolActivity ? <Muted>⚙ {toolLabel(toolActivity)}…</Muted> : null}
            {streamingText ? <MarkdownLite content={streamingText} /> : <Muted>Réflexion…</Muted>}
          </View>
        ) : null}

        {errorLabel ? (
          <Banner
            tone={lastError === 'consent_required' || lastError === 'missing_api_key' ? 'warning' : 'danger'}
            title={errorLabel}
            description={
              lastError === 'consent_required' || lastError === 'missing_api_key'
                ? 'Ouvrez Réglages › Assistant IA pour autoriser l’envoi ou saisir votre clé.'
                : 'Vos données locales restent consultables hors ligne.'
            }
          />
        ) : null}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingTop: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: palette.border,
            backgroundColor: palette.background,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: spacing.sm,
              backgroundColor: palette.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.borderStrong,
              borderRadius: radius.lg,
              padding: spacing.sm,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Posez une question sur votre scolarité…"
              placeholderTextColor={palette.textFaint}
              multiline
              style={{ flex: 1, color: palette.text, fontSize: 15, maxHeight: 140, paddingHorizontal: spacing.sm, paddingVertical: 8 }}
            />
            <Pressable
              onPress={streaming ? cancel : onSend}
              disabled={!streaming && input.trim().length === 0}
              style={({ pressed }) => ({
                backgroundColor: streaming ? palette.surfaceElevated : palette.accent,
                opacity: !streaming && input.trim().length === 0 ? 0.4 : pressed ? 0.8 : 1,
                borderRadius: radius.pill,
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
              })}
              accessibilityLabel={streaming ? 'Arrêter' : 'Envoyer'}
            >
              <AppText style={{ color: streaming ? palette.text : palette.accentText, fontWeight: '700' }}>
                {streaming ? '■' : '↑'}
              </AppText>
            </Pressable>
          </View>
          <Muted style={{ textAlign: 'center' }}>
            Calculs locaux, IA via votre propre clé OpenAI. Les contenus PRONOTE sont traités comme des données, jamais comme
            des consignes.
          </Muted>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
