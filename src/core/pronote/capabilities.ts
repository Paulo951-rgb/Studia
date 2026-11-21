/**
 * What the PRONOTE connector can and cannot do, verified against the public API
 * surface of Pawnote 1.6.x (`@blockshub/pawnote-lts`).
 *
 * Every entry names the exact exported function used, so the claim is auditable.
 * `unavailable` entries are listed on purpose: the app must never pretend to fetch
 * data the connector cannot reach.
 */
export type CapabilityStatus = 'supported' | 'conditional' | 'unavailable';

export type Capability = {
  key: string;
  label: string;
  status: CapabilityStatus;
  /** Exported Pawnote functions used, or `null` when unavailable. */
  api: string[] | null;
  /** PRONOTE tab authorisation required, when relevant. */
  requiresTab?: number;
  notes?: string;
};

export const TAB_LOCATIONS = {
  grades: 198,
  resources: 89,
  assignments: 88,
  timetable: 16,
  evaluations: 201,
  account: 49,
  presence: 7,
  news: 8,
  notebook: 19,
  discussions: 131,
  gradebook: 13,
  menus: 10,
} as const;

export const CAPABILITIES: Capability[] = [
  {
    key: 'profile',
    label: 'Profil et ressources',
    status: 'supported',
    api: ['createSessionHandle', 'loginCredentials', 'loginToken', 'loginQrCode', 'account'],
    notes: 'Le nom, la classe et l’établissement viennent de session.user et session.userResource. `account()` ajoute les coordonnées déclarées (adresse, INE, téléphone).',
  },
  {
    key: 'establishments',
    label: 'Établissements',
    status: 'conditional',
    api: ['instance', 'geolocation'],
    notes: '`instance(url)` résout le nom, la version et les comptes d’une URL. `geolocation()` liste les établissements proches et exige la position de l’appareil : l’app ne l’appelle que si l’utilisateur autorise la géolocalisation.',
  },
  {
    key: 'periods',
    label: 'Périodes',
    status: 'supported',
    api: ['createSessionHandle'],
    notes: 'Périodes exposées par userResource.tabs[TabLocation.*].periods et instance.periods.',
  },
  {
    key: 'grades',
    label: 'Notes',
    status: 'supported',
    api: ['gradesOverview'],
    requiresTab: TAB_LOCATIONS.grades,
    notes: '`gradesOverview(period)` renvoie notes, moyennes de classe, min/max, coefficients et commentaires.',
  },
  {
    key: 'averages',
    label: 'Moyennes',
    status: 'supported',
    api: ['gradesOverview'],
    requiresTab: TAB_LOCATIONS.grades,
    notes: 'Moyennes par matière (subjectsAverages) et moyenne générale (overallAverage) telles que calculées par PRONOTE.',
  },
  {
    key: 'coefficients',
    label: 'Coefficients',
    status: 'supported',
    api: ['gradesOverview', 'gradebook'],
    requiresTab: TAB_LOCATIONS.grades,
    notes: 'Coefficient de chaque note et coefficient par matière dans le carnet de notes.',
  },
  {
    key: 'evaluations',
    label: 'Évaluations par compétences',
    status: 'conditional',
    api: ['evaluations'],
    requiresTab: TAB_LOCATIONS.evaluations,
    notes: 'Disponible uniquement si l’onglet « Évaluations » est autorisé pour le compte.',
  },
  {
    key: 'report_cards',
    label: 'Bulletins',
    status: 'conditional',
    api: ['gradebook', 'gradebookPDF'],
    requiresTab: TAB_LOCATIONS.gradebook,
    notes: '`gradebook(period)` fournit moyennes par matière, coefficients, professeurs et appréciations. Le PDF (`gradebookPDF`) est une URL signée, pas un binaire : il n’est pas archivé automatiquement.',
  },
  {
    key: 'teacher_feedback',
    label: 'Appréciations des professeurs',
    status: 'supported',
    api: ['gradebook', 'gradesOverview', 'evaluations'],
    notes: 'Appréciations par matière du bulletin, commentaires de notes et descriptions d’évaluations.',
  },
  {
    key: 'homework',
    label: 'Devoirs',
    status: 'supported',
    api: ['assignmentsFromWeek', 'assignmentsFromIntervals', 'assignmentStatus'],
    requiresTab: TAB_LOCATIONS.assignments,
    notes: '`assignmentStatus` permet de cocher un devoir comme fait ; l’app ne l’appelle que sur action explicite de l’utilisateur.',
  },
  {
    key: 'notebook_contents',
    label: 'Cahier de textes',
    status: 'supported',
    api: ['resourcesFromWeek', 'resourcesFromIntervals', 'resource'],
    requiresTab: TAB_LOCATIONS.resources,
    notes: 'Contenus de cours (titre, description HTML, pièces jointes) et devoirs associés.',
  },
  {
    key: 'documents',
    label: 'Documents et pièces jointes',
    status: 'conditional',
    api: ['resource', 'resourcesFromWeek', 'assignmentsFromWeek', 'discussionMessages', 'news'],
    notes: 'Les métadonnées et URL des pièces jointes sont récupérables. Le texte interne d’un PDF ou d’un document bureautique n’est pas fourni par PRONOTE : `read_document` renvoie titre, description et lien, jamais un contenu inventé.',
  },
  {
    key: 'messages',
    label: 'Messagerie',
    status: 'conditional',
    api: ['discussions', 'discussionMessages', 'discussionRecipients'],
    requiresTab: TAB_LOCATIONS.discussions,
    notes: 'Lecture des discussions et messages. L’envoi (`newDiscussion`, `discussionSendMessage`) existe mais dépend de authorizations.canDiscuss et n’est pas exposé aux outils IA.',
  },
  {
    key: 'news',
    label: 'Actualités',
    status: 'conditional',
    api: ['news', 'newsRead', 'newsInformationAcknowledge'],
    requiresTab: TAB_LOCATIONS.news,
    notes: 'Informations et sondages. Le corps texte est extrait du HTML renvoyé par PRONOTE.',
  },
  {
    key: 'events',
    label: 'Événements',
    status: 'conditional',
    api: ['createSessionHandle', 'timetableFromIntervals'],
    notes: 'PRONOTE n’expose pas d’API « événements » dédiée. Les vacances viennent de instance.periods/holidays, et les contrôles planifiés de l’emploi du temps (test = true). L’app les stocke comme événements dérivés, avec la source indiquée.',
  },
  {
    key: 'timetable',
    label: 'Emploi du temps',
    status: 'supported',
    api: ['timetableFromWeek', 'timetableFromIntervals', 'parseTimetable'],
    requiresTab: TAB_LOCATIONS.timetable,
    notes: '`parseTimetable` avec withCanceledClasses expose les cours annulés, les salles, les professeurs et les contrôles.',
  },
  {
    key: 'absences',
    label: 'Absences et retards',
    status: 'conditional',
    api: ['notebook'],
    requiresTab: TAB_LOCATIONS.notebook,
    notes: '`notebook(period)` renvoie absences, retards, observations et punitions. Certaines absences peuvent être partiellement anonymisées par l’établissement.',
  },
  {
    key: 'canteen',
    label: 'Menus de cantine',
    status: 'conditional',
    api: ['menus'],
    requiresTab: TAB_LOCATIONS.menus,
    notes: '`menus(date)` renvoie la semaine contenant la date, avec allergènes. Nécessite que la restauration soit activée sur l’instance.',
  },
  {
    key: 'qr_login',
    label: 'Connexion par QR code',
    status: 'supported',
    api: ['loginQrCode', 'securitySave', 'securitySource', 'securityCheckPIN'],
    notes: 'Le QR code est fourni par PRONOTE (compte élève/parent) puis validé par un code à 4 chiffres. Aucun CAPTCHA n’est contourné.',
  },
  {
    key: 'password_login',
    label: 'Connexion identifiants',
    status: 'supported',
    api: ['loginCredentials'],
    notes: 'Le mot de passe sert uniquement à obtenir un jeton lié à l’appareil (RefreshInformation.token). Le mot de passe n’est jamais stocké.',
  },
  {
    key: 'token_login',
    label: 'Renouvellement de session par jeton',
    status: 'supported',
    api: ['loginToken'],
    notes: 'Le jeton PRONOTE est à usage unique : chaque renouvellement en émet un nouveau, que l’app remplace dans le trousseau sécurisé.',
  },
  {
    key: 'double_auth',
    label: 'Double authentification PRONOTE',
    status: 'conditional',
    api: ['SecurityError', 'securitySource', 'securityCheckPIN', 'securityCheckCustomPassword', 'securitySave', 'finishLoginManually'],
    notes: 'Si l’établissement impose une double authentification, l’app affiche le défi renvoyé par PRONOTE et laisse l’utilisateur saisir le code. Aucun contournement.',
  },
  {
    key: 'ent_login',
    label: 'Connexion ENT / CAS',
    status: 'unavailable',
    api: null,
    notes: 'Pawnote expose `instance.casURL` et `finishLoginManually`, mais l’obtention des cookies CAS exige un navigateur intégré et une interaction humaine (identifiants ENT, parfois CAPTCHA). Cette version ne l’implémente pas : elle le signale au lieu de simuler une connexion. Solution autorisée : ouvrir le portail ENT dans un navigateur, puis saisir les identifiants PRONOTE de l’établissement si l’établissement en fournit.',
  },
  {
    key: 'send_message',
    label: 'Envoi de messages',
    status: 'unavailable',
    api: ['newDiscussion', 'discussionSendMessage'],
    notes: 'Techniquement présent dans Pawnote mais volontairement hors périmètre de cette version : l’app est en lecture seule côté PRONOTE pour éviter tout envoi accidentel depuis un assistant IA.',
  },
];

export function capabilityByKey(key: string): Capability | undefined {
  return CAPABILITIES.find((capability) => capability.key === key);
}

export function capabilitiesForTabs(tabs: number[]): Capability[] {
  const allowed = new Set(tabs);
  return CAPABILITIES.filter((capability) => capability.requiresTab === undefined || allowed.has(capability.requiresTab));
}

export function unsupportedCapabilities(tabs: number[]): Capability[] {
  const allowed = new Set(tabs);
  return CAPABILITIES.filter((capability) => capability.requiresTab !== undefined && !allowed.has(capability.requiresTab));
}
