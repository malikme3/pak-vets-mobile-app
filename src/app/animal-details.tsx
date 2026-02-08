import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ListRow } from '../components/ui/ListRow';
import { getAnimalById, getVisitsByAnimalId } from '../store/mockDb';
import { Visit } from '../types/domain';

export default function AnimalDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  
  // For now, use first animal as mock - later will come from params
  const animalId = (params.id as string) || '1';
  const animal = getAnimalById(animalId);
  const visits = animal ? getVisitsByAnimalId(animalId) : [];

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
    const subtitle = `${formatDate(item.visit_datetime)}${item.chief_complaint ? ` • ${item.chief_complaint}` : ''}`;
    return <ListRow title="Visit" subtitle={subtitle} />;
  };

  const handleCreateVisit = () => {
    console.log('Create Visit pressed');
  };

  if (!animal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Animal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Animal Summary Card */}
        <Card style={styles.animalCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Animal Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Species:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{animal.species}</Text>
          </View>
          {animal.breed && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Breed:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{animal.breed}</Text>
            </View>
          )}
          {animal.tag_id && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Tag ID:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{animal.tag_id}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Owner:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{animal.owner_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Phone:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{animal.owner_phone}</Text>
          </View>
        </Card>

        {/* Create Visit Button */}
        <Button
          title="Create Visit"
          onPress={handleCreateVisit}
          variant="primary"
          style={styles.createVisitButton}
        />

        {/* Visit History */}
        <View style={styles.visitsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Visit History</Text>
          {visits.length > 0 ? (
            <Card style={styles.visitsCard}>
              <FlatList
                data={visits}
                renderItem={renderVisitItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
              />
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No visits recorded</Text>
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
  animalCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    width: 80,
  },
  value: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  createVisitButton: {
    marginBottom: 24,
  },
  visitsSection: {
    marginTop: 8,
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
