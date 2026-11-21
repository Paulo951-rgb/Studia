# Dépendances et licences

Versions installées (`package.json` / `node_modules`). Vérification : `npm ls`, inspection
des `package.json` des paquets et du code publié.

## Production

| Paquet | Version | Licence | Rôle |
| --- | --- | --- | --- |
| `@blockshub/pawnote-lts` | 1.6.4 | **GPL-3.0-or-later** | connecteur PRONOTE (Pawnote LTS) |
| `expo` | ~58.0.26 | MIT | plateforme |
| `expo-router` | ~58.0.32 | MIT | navigation par fichiers |
| `expo-sqlite` | ~58.0.18 | MIT | SQLite + FTS5 + SQLCipher |
| `expo-secure-store` | ~58.0.3 | MIT | keychain / keystore |
| `expo-crypto` | ~58.0.8 | MIT | aléa cryptographique |
| `expo-background-task` | ~58.0.13 | MIT | actualisation opportuniste |
| `expo-task-manager` | ~58.0.14 | MIT | définition des tâches de fond |
| `expo-camera` | ~58.0.14 | MIT | scan du QR code PRONOTE |
| `expo-local-authentication` | ~58.0.3 | MIT | verrouillage biométrique |
| `expo-network` | ~58.0.5 | MIT | **installé, inutilisé** |
| `expo-clipboard` | ~58.0.4 | MIT | copier une réponse |
| `expo-file-system` | ~58.0.14 | MIT | **installé, inutilisé** |
| `expo-document-picker` | ~58.0.5 | MIT | **installé, inutilisé** (aucune pièce jointe dans le chat) |
| `expo-sharing` | ~58.0.23 | MIT | **installé, inutilisé** |
| `expo-print` | ~58.0.9 | MIT | **installé, inutilisé** |
| `expo-haptics`, `expo-system-ui`, `expo-constants` | ~58.x | MIT | **installé, inutilisé** |
| `expo-splash-screen`, `expo-status-bar`, `expo-linking` | ~58.x | MIT | support UI |
| `react` / `react-dom` | 19.3.0 | MIT | rendu |
| `react-native` | 0.88.1 | MIT | runtime natif |
| `react-native-svg` | 15.16.0 | MIT | **installé, inutilisé** : la progression est dessinée avec des `View` |
| `react-native-safe-area-context` | ~5.11.1 | MIT | marges système |
| `react-native-screens` | ~4.30.1 | MIT | navigation native |
| `react-native-gesture-handler` | ~3.3.0 | MIT | gestes |
| `react-native-reanimated` + `react-native-worklets` | 4.7.1 / 0.13.0 | MIT | animations |
| `zustand` | ^5.1.0 | MIT | état applicatif |

Dépendances transitives notables de Pawnote : `node-forge` (BSD-3-Clause), `pako`
(MIT/Zlib), `@literate.ink/utilities` (MIT).

## Développement

| Paquet | Version | Licence | Rôle |
| --- | --- | --- | --- |
| `typescript` | ~6.0.3 | Apache-2.0 | typage strict |
| `tsx` | ^4.20.6 | MIT | exécution TypeScript des tests |
| `@types/node`, `@types/react` | 24.x / 19.x | MIT | types |
| `node:test` + `node:sqlite` | Node 24 | fournis avec Node | exécuteur de tests, SQLite FTS5 en test |

## Conséquences de licence

Pawnote est **GPL-3.0-or-later**. Une application qui l'intègre et le distribue doit être
publiée sous une licence compatible et fournir le code source correspondant. Ce dépôt est
donc sous GPL-3.0-or-later (`LICENSE`). Toute publication sur les stores doit inclure
l'offre de code source exigée par la GPL.

Le nom et l'identité visuelle de PRONOTE appartiennent à Index Education ; l'application ne
les réutilise pas au-delà de la mention factuelle du service utilisé.
