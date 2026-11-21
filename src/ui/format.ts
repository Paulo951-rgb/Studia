export function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_student_profile: 'profil',
    get_grades: 'notes',
    get_averages: 'moyennes',
    get_report_cards: 'bulletins',
    search_messages: 'messages',
    get_message_details: 'message',
    search_teacher_feedback: 'appréciations',
    get_homework: 'devoirs',
    search_documents: 'documents',
    read_document: 'document',
    get_timetable: 'emploi du temps',
    get_events: 'événements',
    get_absences: 'absences',
    get_canteen_menu: 'cantine',
    get_school_news: 'actualités',
    calculate_average: 'calcul de moyenne',
    simulate_grade: 'simulation',
    get_school_summary: 'synthèse',
    search_school_history: 'recherche',
  };
  return labels[name] ?? name;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatGrade(value: number | null, outOf: number | null): string {
  if (value === null) return '—';
  const scale = outOf && outOf > 0 ? outOf : 20;
  return `${value.toFixed(2).replace('.', ',')}/${scale}`;
}

export function formatAverage(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2).replace('.', ',')}/20`;
}

export const GRADE_KIND_LABELS: Record<number, string> = {
  [-1]: 'Erreur',
  0: 'Note',
  1: 'Absent',
  2: 'Dispensé',
  3: 'Non noté',
  4: 'Inapte',
  5: 'Non rendu',
  6: 'Absent (zéro)',
  7: 'Non rendu (zéro)',
  8: 'Félicitations',
};
