# Connecteur PRONOTE

## 1. Audit des projets existants

Vérifications effectuées le 2026-11-21 via l'API GitHub et le registre npm.

| Projet | Dépôt | Licence | Dernière activité | Ce que c'est |
| --- | --- | --- | --- | --- |
| Papillon | `PapillonApp/Papillon` | GPL-3.0 | 2026-11-02, non archivé | Application mobile complète (React Native/Expo) |
| Pawnote | npm `pawnote` (1.6.2) | GPL-3.0-or-later | publication 2025-09-21 | Bibliothèque TypeScript extraite de Papillon |
| Pawnote LTS | `BlocksHub/Pawnote-LTS`, npm `@blockshub/pawnote-lts` (1.6.4) | GPL-3.0-or-later | 2026-10-26 | Fork maintenu de Pawnote |
| pronotepy | `bain3/pronotepy` | MIT | 2026-09-03, 248 ★ | Bibliothèque Python |

Conséquences :

- **Papillon** est une application, pas une bibliothèque : la réutiliser imposerait de
  reprendre son UI et son architecture. Écarté.
- **pronotepy** est en Python : inutilisable dans React Native. Utile seulement comme
  référence de comportement. Écarté comme dépendance.
- **Pawnote** est la seule option TypeScript sérieuse. Le fork LTS est plus récent que la
  publication npm d'origine (1.6.4 vs 1.6.2) et reste maintenu. **Retenu** :
  `@blockshub/pawnote-lts@1.6.4`.

## 2. Compatibilité React Native (vérifiée, pas supposée)

Pawnote est publié pour Node, mais son code compilé n'importe aucun module natif :

```
require("@literate.ink/utilities")   // pur JS
require("node-forge")                // pur JS (RSA/AES/MD5)
require("pako")                      // pur JS (zlib)
```

- aucun `require("node:crypto"|"fs"|"https"|"zlib"|"buffer"|"stream")` ;
- aucun usage de `Buffer`, `process.env` ni `globalThis.crypto` ;
- les requêtes passent par un `fetcher` injectable ; le `defaultFetcher` de
  `@literate.ink/utilities` s'appuie sur `fetch`, présent dans React Native.

Preuve : `npx expo export -p android` et `-p ios` produisent un bundle complet
(1 285 modules) incluant Pawnote, sans erreur de résolution.

Adaptations réellement nécessaires :

| Point | Adaptation |
| --- | --- |
| `fetcher` global | `src/providers/pronote/source.ts` fournit un `fetcher` avec `AbortSignal` et délai maximal |
| Jeton de session | jamais en SQLite : SecureStore, référence `secretRef` en base |
| Dates | Pawnote renvoie des `Date` locaux ; les mappers les convertissent en ISO UTC |
| Erreurs | `mapPronoteError` traduit `BadCredentialsError`, `SessionExpiredError`, `RateLimitedError`, `SecurityError`, etc. |
| Onglets non autorisés | `AccessDeniedError` -> ressource marquée `skipped`, jamais simulée |

## 3. Méthodes de connexion

| Méthode | État | Détail |
| --- | --- | --- |
| Identifiants (élève/parent) | ✅ `loginCredentials` | URL d'établissement + type de compte + identifiant + mot de passe |
| QR code | ✅ `loginQrCode` | QR + PIN à 4 chiffres ; le PIN déchiffre le jeton contenu dans le QR |
| Jeton existant | ✅ `loginToken` | renouvellement de session sans redemander le mot de passe |
| Double authentification PRONOTE | ⚠️ conditionnel | `SecurityError` expose les modes disponibles ; l'application ne contourne rien et affiche la marche à suivre |
| ENT / CAS | ❌ non pris en charge | `instance()` renvoie `casURL`/`casToken`, mais `loginCredentials` force `useCAS: false` ; Pawnote n'implémente pas le flux CAS |
| CAPTCHA | ❌ jamais contourné | Aucun code ne tente de résoudre ou de simuler un CAPTCHA |

Aucune autre méthode n'est inventée. Si un établissement impose un ENT, l'application le
signale et propose la connexion par QR code ou par identifiants PRONOTE directs lorsque
l'établissement l'autorise.

## 4. Cycle de vie de la session

1. `connectPronote` résout l'URL, ouvre une session Pawnote et stocke le jeton dans
   SecureStore (`scolary.pronote.token.<accountId>`).
2. Chaque synchronisation appelle `resumePronoteSessionOnce`, qui réutilise le jeton
   existant (`loginToken`) ; le renouvellement est sérialisé pour éviter deux
   authentifications concurrentes.
3. `SessionExpiredError` -> compte `expired`, l'UI demande une reconnexion ; les données
   locales restent intactes.
4. `disconnectAccount` supprime jeton, UUID d'appareil, session et données du compte.

## 5. Matrice de capacités

Source de vérité dans le code : `src/core/pronote/capabilities.ts` (chaque entrée nomme la
fonction Pawnote utilisée). Résumé :

| Capacité | État | Fonctions Pawnote |
| --- | --- | --- |
| Profil, classe, établissement | ✅ | `session.user`, `session.userResource`, `account` |
| Établissements (recherche) | ⚠️ conditionnel | `instance`, `geolocation` (exige la position) |
| Périodes | ✅ | `userResource.tabs[...].periods` |
| Notes, moyennes, coefficients | ✅ | `gradesOverview`, `gradebook` |
| Appréciations des professeurs | ✅ | `gradesOverview`, `gradebook` |
| Évaluations par compétences | ⚠️ conditionnel | `evaluations` (onglet 201) |
| Bulletins | ⚠️ conditionnel | `gradebook`, `gradebookPDF` (onglet 13) |
| Devoirs, cahier de textes | ✅ | `assignmentsFromIntervals`, `resourcesFromIntervals` |
| Documents et pièces jointes | ⚠️ conditionnel | `resourcesFromIntervals` (métadonnées et liens) |
| Messagerie | ⚠️ conditionnel | `discussions`, `discussionMessages` |
| Actualités | ⚠️ conditionnel | `news` |
| Événements | ⚠️ conditionnel | `homepage` |
| Emploi du temps, cours annulés | ✅ | `timetableFromIntervals`, `parseTimetable` |
| Absences, retards | ⚠️ conditionnel | `notebook` |
| Menus de cantine | ⚠️ conditionnel | `menus` |
| Envoi de messages | ❌ | `discussionSendMessage` existe, non branché (hors périmètre, action irréversible) |

« Conditionnel » signifie : la fonction existe dans Pawnote, mais la donnée n'est
présente que si l'établissement a activé l'onglet correspondant. Le moteur de
synchronisation marque alors la ressource `skipped` avec le code `access_denied` — il ne
fabrique jamais de contenu.

## 6. Limites connues

- **Pas d'extraction de texte PDF** : Pawnote ne fournit que le lien du document. L'outil
  `read_document` renvoie donc titre, description et lien, et l'indique explicitement.
- **Pas de connexion ENT** (voir §3).
- **Pas de contournement de la double authentification** : l'utilisateur doit la traiter
  dans son navigateur ou avec l'application officielle.
- **API PRONOTE non contractuelle** : une mise à jour côté Index Education peut casser le
  connecteur. Le code isole les appels dans `source.ts` pour limiter l'impact.
- **Test réel non effectué** : aucun identifiant d'établissement n'était disponible. Le
  connecteur est vérifié par lecture du code publié et par des tests d'intégration sur des
  payloads typés, pas par une connexion live.
