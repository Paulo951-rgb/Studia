# Tester Studia

Deux familles de tests, à ne pas confondre :

| Famille | Où | Ce qu'elle prouve |
| --- | --- | --- |
| **Automatisés** | `npm test`, sur votre PC | La logique : calculs, base de données, outils IA, synchronisation, sécurité. |
| **Manuels** | Sur un téléphone | Le rendu, les permissions, la biométrie, le réseau réel, PRONOTE. |

Aucun test sur appareil physique n'a encore été réalisé. Les tests manuels ci-dessous sont
donc une **procédure à exécuter**, pas un résultat acquis.

---

## 1. Tests automatisés

### 1.1 Lancer la suite

```powershell
npm run verify
```

Ou double-cliquez sur `TESTER-STUDIA.bat`.

### 1.2 Résultat attendu

```
ℹ tests 113
ℹ pass 113
ℹ fail 0
```

Avec `tsc --noEmit` silencieux avant. Si un test échoue, son nom s'affiche en clair
(`not ok …`).

### 1.3 Ce que couvre chaque fichier

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/unit/averages.test.ts` | Moyennes pondérées, coefficients, simulation de note, progression, cas limites (notes sur 10, 20, coefficients nuls). |
| `tests/unit/insights.test.ts` | Contrôles à venir, progression par matière, note nécessaire pour une cible, matières fragiles. |
| `tests/unit/tools.test.ts` | Les 23 outils : noms, schémas, bornes de paramètres, rejet des arguments invalides. |
| `tests/unit/prompt.test.ts` | Encadrement des contenus PRONOTE, résistance à une injection de prompt dans un message. |
| `tests/unit/gate.test.ts` | Le consentement et la clé API sont obligatoires avant tout envoi. |
| `tests/unit/openai.test.ts` | Construction des requêtes Responses, lecture du flux SSE. |
| `tests/unit/openai-resilience.test.ts` | Flux interrompu, fragmentation des appels d'outils, quota, délai maximal, rejeu sans streaming. |
| `tests/unit/sse.test.ts` | Analyse du format Server-Sent Events. |
| `tests/unit/mappers.test.ts` | Conversion des objets PRONOTE vers le modèle local. |
| `tests/unit/cost.test.ts` | Estimation locale du coût à partir des tokens. |
| `tests/unit/conversation.test.ts` | Régénération d'une réponse sans dupliquer l'historique. |
| `tests/integration/db.test.ts` | Migrations, clés étrangères, cascades de suppression, contraintes d'unicité. |
| `tests/integration/search.test.ts` | Recherche FTS5 sur messages, documents, historique et mémoire. |
| `tests/integration/sync.test.ts` | Synchronisation complète, incrémentale, ciblée, reprise après échec, absence de doublons. |
| `tests/integration/toolRunner.test.ts` | Exécution réelle des outils sur une base remplie, filtrage par compte, troncature des sorties. |

Ces tests utilisent une **vraie** base SQLite en mémoire (module `node:sqlite`), sans mock
de la base. Les appels réseau sont simulés par un faux serveur HTTP local, ce qui est
précisé dans les tests concernés.

### 1.4 Ce que les tests automatisés ne couvrent pas

- SQLCipher (module natif, absent de Node) ;
- SecureStore et biométrie (natifs) ;
- l'affichage et la navigation réels ;
- un vrai serveur PRONOTE ;
- un vrai appel OpenAI ;
- les tâches de fond.

### 1.5 Test de contrat PRONOTE

```powershell
npm run test:contract
```

Ce test interroge un établissement réel et **échoue volontairement** sans identifiants
(il explique quoi renseigner). Aucun identifiant réel n'a été utilisé à ce jour.

---

## 2. Tests manuels sur téléphone

Installez d'abord un APK (voir `docs/GUIDE_INSTALLATION_WINDOWS.md` §D). Cochez au fur et
à mesure.

### 2.1 Démarrage et stockage

| # | Action | Résultat attendu | Si ça échoue |
| --- | --- | --- | --- |
| 1 | Ouvrir Studia | Écran de chat, titre « Studia », trois onglets. | Écran blanc → §G.9 du guide Windows. |
| 2 | Lire le message affiché | « Stockage local indisponible » = SQLCipher absent du build. | Régénérez un APK `preview`. |
| 3 | Fermer complètement puis rouvrir | La conversation précédente est restaurée. | Si tout est vide, la base ne persiste pas : notez-le. |
| 4 | Écrire une question, puis Réglages → Confidentialité → Effacer toutes les données | L'application revient à l'état initial, conversations comprises. | — |

### 2.2 Assistant

| # | Action | Résultat attendu | Si ça échoue |
| --- | --- | --- | --- |
| 5 | Envoyer un message **sans** clé API | Le message reste affiché ; bannière « Aucune clé API OpenAI enregistrée ». Aucun réseau. | Le message disparaît = régression, signalez-la. |
| 6 | Réglages → Assistant IA → saisir une clé valide | La clé n'apparaît jamais en clair après enregistrement. | Une clé visible en clair = défaut de sécurité majeur. |
| 7 | Accepter le partage des données | Badge « Envoi IA autorisé » sur l'écran de chat. | — |
| 8 | Poser « Quelle est ma moyenne ? » | Réponse en streaming, puis un encart listant l'outil utilisé. | Erreur `invalid_api_key` → clé refusée par OpenAI. |
| 9 | Couper le Wi-Fi et poser une question | Message d'erreur réseau clair, pas de blocage du champ de saisie. | Champ bloqué sur « Réflexion… » = régression. |
| 10 | Appuyer sur « Copier » | Le texte est dans le presse-papiers. | — |
| 11 | Appuyer sur « Régénérer » | La dernière réponse est remplacée, pas dupliquée. | Deux réponses identiques = régression. |
| 12 | Appuyer sur ■ pendant la génération | La génération s'arrête, l'interface redevient utilisable. | — |
| 13 | Réglages → Assistant IA | Nombre de requêtes, tokens et coût estimé du mois. | Un coût affiché sans aucune requête = incohérence. |

### 2.3 Sécurité

| # | Action | Résultat attendu |
| --- | --- | --- |
| 14 | Réglages → Confidentialité → activer le verrouillage | Refus si aucune biométrie n'est configurée, avec explication. |
| 15 | Mettre l'application en arrière-plan puis revenir | L'écran de verrouillage recouvre l'application. |
| 16 | Déverrouiller par empreinte | Retour à l'écran précédent, pas au premier écran. |
| 17 | Inspecter les fichiers de l'application (téléphone rooté) | Aucun fichier `.db` lisible en clair : le contenu est chiffré. |

### 2.4 PRONOTE

| # | Action | Résultat attendu |
| --- | --- | --- |
| 18 | École → Connecter PRONOTE → QR code | La caméra s'ouvre, demande la permission la première fois. |
| 19 | Scanner le QR code d'un établissement | Session établie, ou message d'erreur explicite. Jamais de faux succès. |
| 20 | Lancer une synchronisation | Progression visible, date de dernière synchronisation mise à jour. |
| 21 | Couper le réseau pendant la synchronisation | Message d'erreur, reprise possible, aucune donnée partielle présentée comme complète. |
| 22 | École → Notes | Notes et moyennes issues de PRONOTE, ou « aucune donnée synchronisée ». |
| 23 | École → Devoirs → cocher un devoir | La coche persiste après fermeture, et survit à une synchronisation. |
| 24 | École → Emploi du temps | Cours de la semaine, cours annulés signalés. |
| 25 | École → Messages | Liste des discussions, recherche locale. |
| 26 | Mode avion, puis consulter Notes et Devoirs | Les données déjà synchronisées restent visibles. |

### 2.5 Cas d'erreur à provoquer volontairement

| # | Action | Résultat attendu |
| --- | --- | --- |
| 27 | Clé OpenAI invalide (`sk-test`) | Message « Clé API refusée par OpenAI », rien n'est perdu. |
| 28 | Clé valide mais quota épuisé | Message « Quota OpenAI dépassé », distinct d'une erreur réseau. |
| 29 | Session PRONOTE expirée | Invitation à se reconnecter, données locales toujours consultables. |
| 30 | Document PRONOTE sans contenu lisible | L'assistant dit qu'il ne peut pas lire le contenu, sans inventer. |

---

## 3. Comment rapporter un problème

Indiquez, dans cet ordre :

1. le numéro du test ci-dessus ;
2. ce que vous attendiez ;
3. ce qui s'est produit (capture d'écran si possible) ;
4. le modèle du téléphone et la version d'Android ;
5. si possible, la sortie de `adb logcat | findstr AndroidRuntime`.

Sans ces éléments, un problème de rendu ne peut pas être reproduit.
