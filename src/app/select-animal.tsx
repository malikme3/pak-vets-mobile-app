import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { AppInput } from '../components/ui/AppInput';
import { Button } from '../components/ui/Button';
import { ListRow } from '../components/ui/ListRow';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { getAnimals } from '../store/mockDb';
import { Animal } from '../types/domain';

type SearchFilter = 'tag' | 'owner_name' | 'owner_phone';

export default function SelectAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || '/create-visit';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('tag');
  const [results, setResults] = useState<Animal[]>([]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    const allAnimals = getAnimals();
    const filtered = allAnimals.filter((animal) => {
      const query = searchQuery.toLowerCase();
      switch (filter) {
        case 'tag':
          return animal.tag_id?.toLowerCase().includes(query);
        case 'owner_name':
          return animal.owner_name.toLowerCase().includes(query);
        case 'owner_phone':
          return animal.owner_phone.includes(searchQuery);
        default:
          return false;
      }
    });
    setResults(filtered);
  };

  const handleAnimalSelect = (animal: Animal) => {
    router.push({
      pathname: returnTo as any,
      params: { animalId: animal.id },
    });
  };

  const handleCreateAnimal = () => {
    router.push({
      pathname: '/create-animal',
      params: { returnTo },
    });
  };

  const renderAnimalItem = ({ item }: { item: Animal }) => {
    const subtitle = `${item.owner_name}${item.owner_phone ? ` • ${item.owner_phone}` : ''}`;
    return (
      <ListRow
        title={`${item.species}${item.breed ? ` - ${item.breed}` : ''}${item.tag_id ? ` (${item.tag_id})` : ''}`}
        subtitle={subtitle}
        onPress={() => handleAnimalSelect(item)}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Search Animal</Text>

        {/* Search Input */}
        <Card style={styles.card}>
          <AppInput
            label="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search by ${filter === 'tag' ? 'Tag ID' : filter === 'owner_name' ? 'Owner Name' : 'Owner Phone'}`}
          />
        </Card>

        {/* Filter Segmented Control */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Search by:</Text>
          <SegmentedControl
            options={[
              { label: 'Tag ID', value: 'tag' },
              { label: 'Owner Name', value: 'owner_name' },
              { label: 'Phone', value: 'owner_phone' },
            ]}
            selectedValue={filter}
            onValueChange={(value) => setFilter(value as SearchFilter)}
          />
        </View>

        {/* Search Button */}
        <Button
          title="Search"
          onPress={handleSearch}
          variant="primary"
          style={styles.searchButton}
        />

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.muted }]}>
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </Text>
            <Card style={styles.resultsCard}>
              <FlatList
                data={results}
                renderItem={renderAnimalItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
              />
            </Card>
          </View>
        )}

        {/* Create New Animal CTA */}
        <View style={styles.createSection}>
          <Text style={[styles.createLabel, { color: colors.muted }]}>Animal not found?</Text>
          <Button
            title="Create New Animal"
            onPress={handleCreateAnimal}
            variant="secondary"
            style={styles.createButton}
          />
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  searchButton: {
    marginBottom: 24,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  resultsCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  createSection: {
    marginTop: 8,
  },
  createLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  createButton: {
    marginTop: 8,
  },
});
