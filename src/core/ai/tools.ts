/**
 * Tool definitions exposed to the model.
 *
 * They are deliberately small and read-only. Every parameter is validated locally
 * before any query runs, result counts are capped, and the model can never ask for
 * data belonging to another account: the account id is injected by the app.
 */

export type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

export type ToolName =
  | 'get_student_profile'
  | 'get_grades'
  | 'get_averages'
  | 'get_report_cards'
  | 'search_messages'
  | 'get_message_details'
  | 'search_teacher_feedback'
  | 'get_homework'
  | 'search_documents'
  | 'read_document'
  | 'get_timetable'
  | 'get_events'
  | 'get_absences'
  | 'get_canteen_menu'
  | 'get_school_news'
  | 'calculate_average'
  | 'simulate_grade'
  | 'get_school_summary'
  | 'search_school_history'
  | 'get_upcoming_tests'
  | 'get_subject_progress'
  | 'simulate_average_target'
  | 'get_weak_subjects';

export type ToolDefinition = {
  name: ToolName;
  description: string;
  parameters: JsonSchema;
};

const nullable = (schema: Record<string, unknown>): Record<string, unknown> => ({
  anyOf: [schema, { type: 'null' }],
});

const dateString = { type: 'string', description: 'Date ISO 8601, par exemple 2026-03-01 ou 2026-03-01T08:00:00Z.' };

export const TOOL_LIMITS = {
  maxResults: 50,
  maxDocumentChars: 4000,
  maxToolOutputChars: 16000,
  maxQueryLength: 200,
} as const;

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_student_profile',
    description:
      "Renvoie le profil scolaire local : nom affiché, classe, établissement, et la date de dernière synchronisation. À utiliser dès qu'une question dépend de qui est l'élève ou de sa classe.",
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'get_grades',
    description:
      'Renvoie les notes enregistrées localement, avec matière, date, note, barème, coefficient et commentaire. Les notes proviennent de PRONOTE ; ne jamais en inventer.',
    parameters: {
      type: 'object',
      properties: {
        period: nullable({ type: 'string', description: 'Nom ou identifiant de période (trimestre, semestre).' }),
        subject: nullable({ type: 'string', description: 'Nom de matière, insensible à la casse et aux accents.' }),
        from: nullable(dateString),
        to: nullable(dateString),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 50 }),
      },
      required: ['period', 'subject', 'from', 'to', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_averages',
    description:
      'Renvoie les moyennes par matière et la moyenne générale telles que PRONOTE les a calculées (source pronote), plus les moyennes recalculées localement si disponibles (source computed). Indiquer toujours la source.',
    parameters: {
      type: 'object',
      properties: { period: nullable({ type: 'string' }) },
      required: ['period'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_report_cards',
    description:
      'Renvoie les bulletins enregistrés : moyennes par matière, coefficients, professeurs, appréciations et commentaire général.',
    parameters: {
      type: 'object',
      properties: { period: nullable({ type: 'string' }) },
      required: ['period'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_messages',
    description:
      'Recherche plein texte (SQLite FTS5) dans les messages PRONOTE enregistrés. Renvoie des extraits et des identifiants ; utiliser get_message_details pour le texte complet.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termes recherchés.' },
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_message_details',
    description: 'Renvoie un message PRONOTE complet à partir de son identifiant local, avec auteur, date et pièces jointes.',
    parameters: {
      type: 'object',
      properties: { message_id: { type: 'string' } },
      required: ['message_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_teacher_feedback',
    description:
      "Recherche dans les appréciations des professeurs : commentaires de notes, appréciations de bulletin, descriptions d'évaluations. Sans requête, renvoie les plus récentes.",
    parameters: {
      type: 'object',
      properties: {
        query: nullable({ type: 'string' }),
        subject: nullable({ type: 'string' }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['query', 'subject', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_homework',
    description: 'Renvoie les devoirs enregistrés avec échéance, matière, description et pièces jointes.',
    parameters: {
      type: 'object',
      properties: {
        from: nullable(dateString),
        to: nullable(dateString),
        subject: nullable({ type: 'string' }),
        include_done: nullable({ type: 'boolean' }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 50 }),
      },
      required: ['from', 'to', 'subject', 'include_done', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_documents',
    description:
      'Recherche plein texte dans les documents du cahier de textes enregistrés localement (titres et descriptions).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        subject: nullable({ type: 'string' }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['query', 'subject', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_document',
    description:
      "Renvoie les métadonnées d'un document local : titre, matière, catégorie, description textuelle et lien de la pièce jointe. Le texte d'un PDF n'est pas extrait par PRONOTE : ne jamais prétendre l'avoir lu.",
    parameters: {
      type: 'object',
      properties: { document_id: { type: 'string' } },
      required: ['document_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_timetable',
    description: "Renvoie l'emploi du temps enregistré, y compris les cours annulés et les contrôles prévus.",
    parameters: {
      type: 'object',
      properties: {
        from: nullable(dateString),
        to: nullable(dateString),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 50 }),
      },
      required: ['from', 'to', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_events',
    description:
      'Renvoie les événements enregistrés : vacances et contrôles planifiés dérivés de PRONOTE. La source est indiquée pour chaque événement.',
    parameters: {
      type: 'object',
      properties: {
        from: nullable(dateString),
        to: nullable(dateString),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 50 }),
      },
      required: ['from', 'to', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_absences',
    description: 'Renvoie les absences et retards enregistrés, avec durée, justification et motif quand PRONOTE le fournit.',
    parameters: {
      type: 'object',
      properties: {
        from: nullable(dateString),
        to: nullable(dateString),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 50 }),
      },
      required: ['from', 'to', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_canteen_menu',
    description: 'Renvoie les menus de cantine enregistrés, avec allergènes, pour une plage de dates.',
    parameters: {
      type: 'object',
      properties: {
        from: nullable({ type: 'string', description: 'Date de début, format YYYY-MM-DD.' }),
        to: nullable({ type: 'string', description: 'Date de fin, format YYYY-MM-DD.' }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['from', 'to', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_school_news',
    description: "Renvoie les actualités de l'établissement enregistrées, avec auteur et date de publication.",
    parameters: {
      type: 'object',
      properties: {
        unread_only: nullable({ type: 'boolean' }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['unread_only', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'calculate_average',
    description:
      'Calcule une moyenne exacte à partir des notes et coefficients enregistrés. Résultat de type calcul, distinct des moyennes PRONOTE et de toute estimation.',
    parameters: {
      type: 'object',
      properties: {
        period: nullable({ type: 'string' }),
        subject: nullable({ type: 'string' }),
      },
      required: ['period', 'subject'],
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_grade',
    description:
      "Simule l'effet d'une note hypothétique sur une moyenne de matière. Résultat explicitement marqué comme simulation, jamais comme une note réelle.",
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        points: { type: 'number' },
        out_of: nullable({ type: 'number', minimum: 1, maximum: 100 }),
        coefficient: nullable({ type: 'number', minimum: 0.1, maximum: 100 }),
        period: nullable({ type: 'string' }),
      },
      required: ['subject', 'points', 'out_of', 'coefficient', 'period'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_school_summary',
    description:
      "Renvoie une synthèse factuelle de l'état local : nombre de notes, devoirs à venir, messages non lus, absences, date de dernière synchronisation.",
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'get_upcoming_tests',
    description:
      "Renvoie les contrôles et évaluations à venir dans les N prochains jours, à partir des évaluations enregistrées et des cours marqués comme contrôle dans l'emploi du temps.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Fenêtre en jours, de 1 à 60. Par défaut 14.' },
        limit: { type: 'number', description: `Nombre maximum de résultats (1 à ${TOOL_LIMITS.maxResults}).` },
      },
      required: ['days', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_subject_progress',
    description:
      "Renvoie, matière par matière, la moyenne de chaque période et l'écart entre les deux dernières périodes connues. Utile pour parler de progression sans inventer de tendance.",
    parameters: {
      type: 'object',
      properties: {
        subject: { ...nullable({ type: 'string' }), description: 'Filtre optionnel sur le nom de la matière.' },
      },
      required: ['subject'],
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_average_target',
    description:
      "Calcule la note nécessaire sur une prochaine évaluation, avec un coefficient donné, pour atteindre une moyenne cible dans une matière. Résultat arithmétique, pas une prédiction.",
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Nom de la matière.' },
        target: { type: 'number', description: 'Moyenne visée sur 20, entre 0 et 20.' },
        coefficient: { ...nullable({ type: 'number' }), description: 'Coefficient de la future note, par défaut 1.' },
        period: { ...nullable({ type: 'string' }), description: 'Période optionnelle ; la période courante est utilisée sinon.' },
      },
      required: ['subject', 'target', 'coefficient', 'period'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_weak_subjects',
    description:
      "Liste les matières dont la moyenne est nettement inférieure à la moyenne générale locale, avec la note la plus basse récente. Seuil et nombre de résultats paramétrables.",
    parameters: {
      type: 'object',
      properties: {
        threshold: { ...nullable({ type: 'number' }), description: 'Écart minimal en points sous la moyenne générale, par défaut 1.' },
        period: { ...nullable({ type: 'string' }), description: 'Période optionnelle.' },
        limit: { type: 'number', description: `Nombre maximum de matières (1 à 20).` },
      },
      required: ['threshold', 'period', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_school_history',
    description:
      'Recherche plein texte dans tout l’historique scolaire local : messages, documents, devoirs, appréciations, actualités, bulletins.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        kinds: nullable({
          type: 'array',
          items: { type: 'string' },
          description: 'Filtre optionnel : message, document, homework, grade_comment, news, evaluation, report_card.',
        }),
        limit: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
      },
      required: ['query', 'kinds', 'limit'],
      additionalProperties: false,
    },
  },
];

export class ToolArgumentError extends Error {
  readonly code = 'TOOL_ARGUMENT_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'ToolArgumentError';
  }
}

export type ToolArguments = Record<string, string | number | boolean | string[] | null>;

function assertKnownKeys(name: ToolName, args: Record<string, unknown>): void {
  const definition = TOOLS.find((tool) => tool.name === name);
  if (!definition) throw new ToolArgumentError(`Outil inconnu : ${name}`);
  const allowed = new Set(Object.keys(definition.parameters.properties));
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new ToolArgumentError(`Paramètre inattendu pour ${name} : ${key}`);
  }
}

function asString(value: unknown, field: string, maxLength: number = TOOL_LIMITS.maxQueryLength): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new ToolArgumentError(`${field} doit être une chaîne.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) throw new ToolArgumentError(`${field} dépasse ${maxLength} caractères.`);
  return trimmed;
}

function asNumber(value: unknown, field: string, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ToolArgumentError(`${field} doit être un nombre.`);
  if (value < min || value > max) throw new ToolArgumentError(`${field} doit être compris entre ${min} et ${max}.`);
  return value;
}

function asBoolean(value: unknown, field: string): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') throw new ToolArgumentError(`${field} doit être un booléen.`);
  return value;
}

function asStringArray(value: unknown, field: string, allowed?: string[]): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ToolArgumentError(`${field} doit être une liste de chaînes.`);
  }
  if (allowed) {
    const invalid = value.find((item) => !allowed.includes(item));
    if (invalid) throw new ToolArgumentError(`${field} contient une valeur non autorisée : ${invalid}`);
  }
  return value as string[];
}

export type ParsedToolArguments = {
  period?: string | null;
  subject?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number | null;
  query?: string | null;
  message_id?: string;
  document_id?: string;
  include_done?: boolean | null;
  unread_only?: boolean | null;
  points?: number;
  out_of?: number | null;
  coefficient?: number | null;
  kinds?: string[] | null;
  days?: number | null;
  target?: number | null;
  threshold?: number | null;
};

export function parseToolArguments(name: ToolName, raw: string): ParsedToolArguments {
  let parsed: unknown;
  try {
    parsed = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    throw new ToolArgumentError('Les arguments du modèle ne sont pas un JSON valide.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ToolArgumentError('Les arguments du modèle doivent être un objet JSON.');
  }
  const args = parsed as Record<string, unknown>;
  assertKnownKeys(name, args);

  switch (name) {
    case 'get_student_profile':
    case 'get_school_summary':
      return {};
    case 'get_grades':
      return {
        period: asString(args['period'], 'period'),
        subject: asString(args['subject'], 'subject'),
        from: asString(args['from'], 'from', 40),
        to: asString(args['to'], 'to', 40),
        limit: asNumber(args['limit'], 'limit', 1, TOOL_LIMITS.maxResults),
      };
    case 'get_averages':
    case 'get_report_cards':
      return { period: asString(args['period'], 'period') };
    case 'search_messages':
      return {
        query: asString(args['query'], 'query') ?? raise('query est obligatoire.'),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    case 'get_message_details':
      return { message_id: asString(args['message_id'], 'message_id', 120) ?? raise('message_id est obligatoire.') };
    case 'search_teacher_feedback':
      return {
        query: asString(args['query'], 'query'),
        subject: asString(args['subject'], 'subject'),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    case 'get_homework':
      return {
        from: asString(args['from'], 'from', 40),
        to: asString(args['to'], 'to', 40),
        subject: asString(args['subject'], 'subject'),
        include_done: asBoolean(args['include_done'], 'include_done'),
        limit: asNumber(args['limit'], 'limit', 1, TOOL_LIMITS.maxResults),
      };
    case 'search_documents':
      return {
        query: asString(args['query'], 'query') ?? raise('query est obligatoire.'),
        subject: asString(args['subject'], 'subject'),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    case 'read_document':
      return { document_id: asString(args['document_id'], 'document_id', 120) ?? raise('document_id est obligatoire.') };
    case 'get_timetable':
    case 'get_events':
    case 'get_absences':
      return {
        from: asString(args['from'], 'from', 40),
        to: asString(args['to'], 'to', 40),
        limit: asNumber(args['limit'], 'limit', 1, TOOL_LIMITS.maxResults),
      };
    case 'get_canteen_menu':
      return {
        from: asString(args['from'], 'from', 20),
        to: asString(args['to'], 'to', 20),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    case 'get_school_news':
      return {
        unread_only: asBoolean(args['unread_only'], 'unread_only'),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    case 'calculate_average':
      return { period: asString(args['period'], 'period'), subject: asString(args['subject'], 'subject') };
    case 'simulate_grade': {
      const points = asNumber(args['points'], 'points', 0, 100);
      if (points === null) raise('points est obligatoire.');
      return {
        subject: asString(args['subject'], 'subject') ?? raise('subject est obligatoire.'),
        points: points as number,
        out_of: asNumber(args['out_of'], 'out_of', 1, 100),
        coefficient: asNumber(args['coefficient'], 'coefficient', 0.1, 100),
        period: asString(args['period'], 'period'),
      };
    }
    case 'get_upcoming_tests':
      return {
        days: asNumber(args['days'], 'days', 1, 60),
        limit: asNumber(args['limit'], 'limit', 1, TOOL_LIMITS.maxResults),
      };
    case 'get_subject_progress':
      return { subject: asString(args['subject'], 'subject') };
    case 'simulate_average_target':
      return {
        subject: asString(args['subject'], 'subject') ?? raise('subject est obligatoire.'),
        target: asNumber(args['target'], 'target', 0, 20) ?? raise('target est obligatoire.'),
        coefficient: asNumber(args['coefficient'], 'coefficient', 0.1, 100),
        period: asString(args['period'], 'period'),
      };
    case 'get_weak_subjects':
      return {
        threshold: asNumber(args['threshold'], 'threshold', 0, 20),
        period: asString(args['period'], 'period'),
        limit: asNumber(args['limit'], 'limit', 1, 20),
      };
    case 'search_school_history':
      return {
        query: asString(args['query'], 'query') ?? raise('query est obligatoire.'),
        kinds: asStringArray(args['kinds'], 'kinds', [
          'message',
          'document',
          'homework',
          'grade_comment',
          'news',
          'evaluation',
          'report_card',
        ]),
        limit: asNumber(args['limit'], 'limit', 1, 30),
      };
    default:
      throw new ToolArgumentError(`Outil inconnu : ${String(name)}`);
  }
}

function raise(message: string): never {
  throw new ToolArgumentError(message);
}
