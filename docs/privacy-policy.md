# Politique de confidentialité — brouillon à faire valider

> Ce document est un **brouillon technique**. Il décrit ce que fait réellement le code.
> Il doit être relu et validé par un juriste (RGPD, données de mineurs, information des
> titulaires de l'autorité parentale) avant toute publication sur un store.

## 1. Responsable de traitement

L'utilisateur (ou son représentant légal) est responsable des données qu'il importe.
L'éditeur de l'application n'exploite aucun serveur et ne reçoit aucune donnée.

## 2. Données traitées et lieu de stockage

| Donnée | Stockage | Chiffrement |
| --- | --- | --- |
| Identifiants PRONOTE (jeton de session, UUID d'appareil) | SecureStore (keychain/keystore) | fourni par l'OS |
| Clé API OpenAI | SecureStore | fourni par l'OS |
| Clé de la base | SecureStore | fourni par l'OS |
| Profil, notes, bulletins, devoirs, messages, emploi du temps, absences, cantine, actualités, documents | SQLite locale | SQLCipher (AES-256) |
| Conversations et mémoire | SQLite locale | SQLCipher |
| Recherche (index FTS5) | SQLite locale | SQLCipher |

Aucune donnée n'est envoyée à l'éditeur. Aucune analytique, aucun traceur, aucune publicité.
L'application ne collecte pas l'identité de l'appareil au-delà de l'UUID PRONOTE.

## 3. Destinataires

1. **PRONOTE / Index Education** : le serveur de l'établissement, contacté directement par
   le téléphone en HTTPS, avec les identifiants de l'utilisateur.
2. **OpenAI** : uniquement si l'utilisateur a saisi sa clé **et** accepté le partage.
   Sont transmis : la demande, l'historique de la conversation en cours et les résultats
   d'outils nécessaires. Ne sont jamais transmis : le jeton PRONOTE, les autres comptes,
   la base complète, les fichiers non ouverts.

Aucun autre destinataire. Aucun sous-traitant de l'éditeur.

## 4. Base légale et consentement

- Connexion PRONOTE : exécution du service demandé par l'utilisateur.
- Envoi à OpenAI : **consentement explicite**, recueilli dans l'écran Réglages → IA, avec
  possibilité de retrait immédiat (suppression du consentement et de la clé).
- Mémoire : activée par défaut pour l'usage local, désactivable, consultable et effaçable.

## 5. Mineurs

L'application est destinée à des élèves, souvent mineurs. En conséquence :

- aucune donnée n'est transmise à l'éditeur ;
- aucun profilage publicitaire ;
- l'envoi de données scolaires à un fournisseur d'IA est une décision explicite du
  titulaire de l'autorité parentale ou de l'élève majeur ;
- le texte de consentement doit être adapté et validé avant publication.

## 6. Durées de conservation

- Données locales : conservées jusqu'à suppression par l'utilisateur (déconnexion du
  compte ou « Effacer toutes les données »).
- Historique de synchronisation : 20 dernières exécutions par compte.
- Chez OpenAI : `store: false` est envoyé à chaque requête ; OpenAI indique néanmoins
  conserver les requêtes selon sa politique d'abus. L'application ne peut pas garantir la
  suppression côté fournisseur : voir <https://openai.com/policies/privacy-policy>.
- Chez PRONOTE : la politique de l'établissement s'applique.

## 7. Droits

- Accès, rectification, effacement : depuis l'application (Réglages → Confidentialité).
- Effacement complet : « Effacer toutes les données » supprime les lignes, puis la clé de
  chiffrement, rendant le fichier illisible.
- Réclamation : autorité de contrôle compétente (en France, la CNIL).

## 8. Sécurité

- HTTPS obligatoire pour PRONOTE et OpenAI.
- Base chiffrée ; refus de démarrer si SQLCipher est absent.
- Secrets uniquement dans le stockage sécurisé de l'OS.
- Verrouillage biométrique optionnel : l'empreinte ou le visage sont vérifiés par le
  système (Android BiometricPrompt / iOS LocalAuthentication). Scolary ne reçoit, ne
  stocke ni ne transmet aucune donnée biométrique ; elle ne reçoit qu'une réponse
  oui/non. Le verrou se referme dès que l'application passe en arrière-plan.
- Aucune télémétrie : les compteurs de tokens et le coût estimé restent dans la base
  locale et ne sont envoyés à personne.
- Validation stricte des entrées et des sorties d'outils.
- Protection contre les injections de prompt (contenus PRONOTE traités comme données).

Limites honnêtes : une clé API stockée sur un téléphone peut être extraite par la personne
qui contrôle l'appareil (appareil rooté/jailbreaké, sauvegarde compromise). Elle ne
constitue pas un secret inviolable. L'application ne prétend pas le contraire.

## 9. Transferts hors UE

Les appels à OpenAI peuvent être traités hors de l'Union européenne. L'utilisateur en est
informé avant de consentir. Aucun autre transfert n'a lieu.
