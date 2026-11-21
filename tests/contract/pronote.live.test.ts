import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { login, PronoteSource, describeInstance } from '@/providers/pronote/source';

/**
 * Live contract test against a real PRONOTE school server.
 *
 * It performs no write and never bypasses a security control: it uses the same
 * credential flow as the app. It is skipped unless the four variables below are
 * provided, because the project has no test account:
 *
 *   PRONOTE_URL=https://0xxxxx.index-education.net/pronote
 *   PRONOTE_USERNAME=...
 *   PRONOTE_PASSWORD=...
 *   PRONOTE_KIND=student|parent   (default: student)
 *
 * Run with: npm run test:contract
 */
const url = process.env['PRONOTE_URL'];
const username = process.env['PRONOTE_USERNAME'];
const password = process.env['PRONOTE_PASSWORD'];
const kind = process.env['PRONOTE_KIND'] === 'parent' ? 'parent' : 'student';
const configured = Boolean(url && username && password);

test('live PRONOTE contract', { skip: configured ? false : 'PRONOTE_URL / USERNAME / PASSWORD not set' }, async () => {
  assert.ok(url && username && password);

  const instance = await describeInstance(url);
  console.log(`[contract] établissement: ${instance.name} (PRONOTE ${instance.version.join('.')})`);
  assert.ok(instance.name.length > 0);

  const session = await login({ method: 'password', url, username, password, kind, deviceUuid: randomUUID() });
  assert.ok(session.token.length > 0, 'a session token is returned');
  console.log(`[contract] connexion ${session.accountKind} ok, ${session.navigatorIdentifier.length} caractères d'identifiant de navigateur`);

  const source = new PronoteSource(session.session, 'acc_contract');
  const tabs = source.authorizedTabs();
  console.log(`[contract] onglets autorisés: ${tabs.join(', ')}`);

  const profile = await source.fetchProfile();
  assert.ok(profile.name.length > 0);
  assert.match(profile.syncedAt, /^\d{4}-\d{2}-\d{2}T/);
  console.log(`[contract] profil: ${profile.kind} ${profile.className ?? ''}`);

  const { periods, defaultPeriodId } = await source.fetchPeriods();
  assert.ok(periods.length > 0, 'at least one period');
  const period = periods.find((entry) => entry.id === defaultPeriodId) ?? periods[periods.length - 1];
  assert.ok(period);
  console.log(`[contract] ${periods.length} période(s), défaut: ${period.name}`);

  const subjects = await source.fetchSubjects();
  console.log(`[contract] ${subjects.length} matière(s)`);

  const gradesResult = await source.fetchGrades(period.id);
  const grades = gradesResult.grades;
  assert.ok(gradesResult.averages.length >= 0);
  for (const grade of grades) {
    assert.ok(grade.id.length > 0);
    assert.match(grade.gradedAt, /^\d{4}-\d{2}-\d{2}/);
    if (grade.outOfPoints !== null) assert.ok(grade.outOfPoints > 0);
  }
  console.log(`[contract] ${grades.length} note(s), moyenne publiée: ${grades.length > 0 ? 'oui' : 'aucune note'}`);

  const today = new Date();
  const iso = (offsetDays: number): string => {
    const date = new Date(today.getTime());
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };
  const timetable = await source.fetchTimetable(iso(-7), iso(14));
  console.log(`[contract] ${timetable.length} créneau(x) d'emploi du temps`);
  const homework = await source.fetchHomework(iso(-7), iso(21));
  console.log(`[contract] ${homework.length} devoir(s)`);
  const absences = await source.fetchAbsences(period.id);
  console.log(`[contract] ${absences.length} absence(s)/retard(s)`);
  const news = await source.fetchNews();
  console.log(`[contract] ${news.length} actualité(s)`);
  const discussions = await source.fetchDiscussions();
  console.log(`[contract] ${discussions.length} discussion(s)`);
  const events = await source.fetchEvents();
  console.log(`[contract] ${events.length} événement(s)`);
  const documents = await source.fetchDocuments(iso(-30), iso(0));
  console.log(`[contract] ${documents.length} document(s)`);
  const menus = await source.fetchCanteen(iso(-1), iso(5));
  console.log(`[contract] ${menus.length} menu(s) de cantine`);
});
