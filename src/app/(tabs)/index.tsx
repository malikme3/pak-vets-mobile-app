import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/ListRow';
import { getCurrentDoctor, getRecentVisits, getAnimalById } from '../../store/mockDb';
import { Visit } from '../../types/domain';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const doctor = getCurrentDoctor();
  const recentVisits = getRecentVisits(5);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderVisitItem = ({ item }: { item: Visit }) => {
    const animal = getAnimalById(item.animal_id);
    const animalInfo = animal
      ? `${animal.species}${animal.breed ? ` - ${animal.breed}` : ''}`
      : 'Unknown Animal';
    const subtitle = `${formatDate(item.visit_datetime)}${item.chief_complaint ? ` • ${item.chief_complaint}` : ''}`;

    return <ListRow title={animalInfo} subtitle={subtitle} />;
  };

  const handleNewVisit = () => {
    console.log('New Visit pressed');
  };

  const handleSearchAnimal = () => {
    console.log('Search Animal pressed');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome to Dashboard</Text>

        {/* Doctor Header Card */}
        <Card style={styles.doctorCard}>
          <View style={styles.doctorHeader}>
            <View style={styles.doctorInfo}>
              <Text style={[styles.doctorName, { color: colors.text }]}>{doctor.name}</Text>
              {doctor.location && (
                <Text style={[styles.doctorLocation, { color: colors.muted }]}>{doctor.location}</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <View style={styles.quickActionButton}>
              <Button title="New Visit" onPress={handleNewVisit} variant="primary" />
            </View>
            <View style={styles.quickActionButton}>
              <Button title="Search Animal" onPress={handleSearchAnimal} variant="secondary" />
            </View>
          </View>
        </View>

        {/* Recent Visits */}
        <View style={styles.recentVisitsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Visits</Text>
          {recentVisits.length > 0 ? (
            <Card style={styles.visitsCard}>
              <FlatList
                data={recentVisits}
                renderItem={renderVisitItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
              />
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No recent visits</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  doctorCard: {
    marginTop: 8,
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  doctorLocation: {
    fontSize: 16,
  },
  quickActionsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
  },
  quickActionButton: {
    flex: 1,
    marginRight: 16,
  },
  recentVisitsSection: {
    marginTop: 24,
  },
  visitsCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  emptyCard: {
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
