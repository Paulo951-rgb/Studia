import React from 'react';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '@/state/appStore';
import { useAsyncData } from '@/ui/useAsyncData';
import { spacing } from '@/ui/theme/theme';
import { AppText, Card, Chip, EmptyState, Muted, Spinner } from '@/ui/components/primitives';
import { formatDate } from '@/ui/format';

export default function CanteenScreen() {
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  const { data, loading } = useAsyncData(async (repos) => {
    if (!activeAccountId) return null;
    return repos.school.listCanteenMenus({ accountId: activeAccountId, limit: 30 });
  }, [activeAccountId]);

  if (loading) return <Spinner label="Lecture des menus…" />;
  if (!data || data.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          title="Aucun menu enregistré"
          description="La restauration n’est peut-être pas activée sur l’établissement, ou l’onglet n’est pas autorisé pour ce compte."
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      {data.map((menu) => (
        <Card key={menu.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="heading">{formatDate(menu.menuDate)}</AppText>
            <Chip label={menu.meal === 'lunch' ? 'déjeuner' : 'dîner'} />
          </View>
          {menu.courses.map((course) => (
            <View key={`${menu.id}-${course.section}`} style={{ gap: 2 }}>
              <Muted style={{ textTransform: 'capitalize' }}>{course.section}</Muted>
              {course.items.map((item, index) => (
                <AppText key={`${course.section}-${index}`} variant="body">
                  {item.name}
                  {item.allergens.length > 0 ? ` (${item.allergens.join(', ')})` : ''}
                </AppText>
              ))}
            </View>
          ))}
          {menu.allergens.length > 0 ? <Muted>Allergènes : {menu.allergens.join(', ')}</Muted> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
