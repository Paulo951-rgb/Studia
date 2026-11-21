import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppStore } from '@/state/appStore';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText, Banner, Button, Card, Chip, Field, Muted } from '@/ui/components/primitives';
import { connectPronote, parseQrPayload, type ParsedQrPayload } from '@/providers/pronote/service';
import { mapPronoteError, PRONOTE_ERROR_LABELS } from '@/core/pronote/errors';

type Mode = 'password' | 'qr';

export default function ConnectScreen() {
  const { palette } = usePalette();
  const router = useRouter();
  const repos = useAppStore((state) => state.repos);
  const refreshAccounts = useAppStore((state) => state.refreshAccounts);
  const syncNow = useAppStore((state) => state.syncNow);

  const [mode, setMode] = useState<Mode>('password');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [kind, setKind] = useState<'student' | 'parent'>('student');
  const [pin, setPin] = useState('');
  const [qr, setQr] = useState<ParsedQrPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const submit = async () => {
    if (!repos) return;
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'password'
          ? await connectPronote(repos, { method: 'password', url, username, password, kind })
          : await connectPronote(repos, { method: 'qr', qr: qr as ParsedQrPayload, pin });
      setPassword('');
      setPin('');
      await refreshAccounts();
      await useAppStore.getState().setActiveAccount(result.accountId);
      await syncNow('initial');
      router.replace('/(tabs)/school');
    } catch (cause) {
      const mapped = mapPronoteError(cause);
      setError(
        mapped.code === 'unknown'
          ? cause instanceof Error
            ? cause.message
            : 'Connexion impossible'
          : PRONOTE_ERROR_LABELS[mapped.code],
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = mode === 'password' ? url.trim() && username.trim() && password.length > 0 : Boolean(qr) && /^\d{4}$/.test(pin);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <Banner
        tone="info"
        title="Connexion directe, sans serveur intermédiaire"
        description="L’application se connecte directement au serveur PRONOTE de votre établissement. Le mot de passe sert uniquement à obtenir un jeton lié à cet appareil ; il n’est jamais enregistré."
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Identifiants" selected={mode === 'password'} onPress={() => setMode('password')} />
        <Chip label="QR code PRONOTE" selected={mode === 'qr'} onPress={() => setMode('qr')} />
      </View>

      {mode === 'password' ? (
        <Card style={{ gap: spacing.md }}>
          <Field
            label="Adresse PRONOTE"
            value={url}
            onChangeText={setUrl}
            placeholder="https://0123456a.index-education.net/pronote"
            keyboardType="url"
            autoCapitalize="none"
            hint="L’URL de l’établissement, sans espace. L’application ne devine pas l’adresse."
          />
          <Field label="Identifiant" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Élève" selected={kind === 'student'} onPress={() => setKind('student')} />
            <Chip label="Parent" selected={kind === 'parent'} onPress={() => setKind('parent')} />
          </View>
          <Muted>
            La double authentification PRONOTE, si l’établissement l’impose, sera demandée par PRONOTE lui-même : l’application
            ne la contourne pas.
          </Muted>
        </Card>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <Muted>
            Scannez le QR code affiché dans PRONOTE (menu « Connexion par QR code »), puis saisissez le code à 4 chiffres
            affiché par PRONOTE.
          </Muted>
          {qr ? (
            <View style={{ gap: 2 }}>
              <AppText variant="body">QR code lu : {qr.username}</AppText>
              <Muted>{qr.url}</Muted>
            </View>
          ) : null}
          {scanning ? (
            <View style={{ height: 320, borderRadius: 16, overflow: 'hidden' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  try {
                    setQr(parseQrPayload(data));
                    setScanning(false);
                    setError(null);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'QR code illisible');
                  }
                }}
              />
            </View>
          ) : (
            <Button
              label={qr ? 'Scanner un autre QR code' : 'Ouvrir la caméra'}
              variant="secondary"
              onPress={() => {
                if (!permission?.granted) {
                  void requestPermission().then((result) => {
                    if (result.granted) setScanning(true);
                    else setError('Permission caméra refusée : impossible de scanner le QR code.');
                  });
                } else {
                  setScanning(true);
                }
              }}
            />
          )}
          <Field label="Code à 4 chiffres" value={pin} onChangeText={setPin} keyboardType="numeric" />
        </Card>
      )}

      {error ? <Banner tone="danger" title="Connexion impossible" description={error} /> : null}

      <Button label="Se connecter" onPress={() => void submit()} loading={busy} disabled={!canSubmit} />

      <Card style={{ gap: spacing.xs }}>
        <AppText variant="heading">Connexion ENT / CAS</AppText>
        <Muted>
          Non prise en charge dans cette version. L’obtention des cookies d’un ENT exige un navigateur intégré et une
          authentification humaine (parfois un CAPTCHA) : l’application le signale au lieu de simuler une connexion.
          Solution autorisée : ouvrir le portail de votre ENT dans un navigateur, puis utiliser l’identifiant PRONOTE fourni
          par l’établissement.
        </Muted>
      </Card>
    </ScrollView>
  );
}
