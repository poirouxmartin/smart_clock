import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/types';

type SettingsNav = React.NavigationProp<RootStackParamList, 'Settings'>;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();

  const settings = [
    {
      title: 'Général',
      items: [
        { key: 'language', label: 'Langue', value: 'Français', type: 'navigation' },
        { key: 'units', label: 'Unités', value: 'Métrique', type: 'navigation' },
        { key: 'theme', label: 'Thème', value: 'Système', type: 'navigation' },
      ],
    },
    {
      title: 'Réveil',
      items: [
        { key: 'smart_wake', label: 'Réveil intelligent', value: true, type: 'toggle' },
        { key: 'wake_window', label: 'Durée fenêtre', value: '1h30', type: 'navigation' },
        { key: 'fallback_alarm', label: 'Réveil secours', value: true, type: 'toggle' },
      ],
    },
    {
      title: 'Sons & Lumière',
      items: [
        { key: 'nature_sounds', label: 'Sons nature', value: true, type: 'toggle' },
        { key: 'custom_sounds', label: 'Sons personnalisés', value: false, type: 'navigation' },
        { key: 'light_integration', label: 'Ampoules connectées', value: false, type: 'navigation' },
        { key: 'fade_in', label: 'Fade-in progressif', value: '15 min', type: 'navigation' },
      ],
    },
    {
      title: 'Données & Confidentialité',
      items: [
        { key: 'export_data', label: 'Exporter mes données', value: '', type: 'action' },
        { key: 'delete_history', label: 'Supprimer l\'historique', value: '', type: 'destructive' },
        { key: 'local_only', label: 'Stockage local uniquement', value: true, type: 'toggle' },
      ],
    },
    {
      title: 'À propos',
      items: [
        { key: 'version', label: 'Version', value: '1.0.0-dev', type: 'info' },
        { key: 'github', label: 'Code source (GitHub)', value: '', type: 'link' },
        { key: 'license', label: 'Licences open source', value: '', type: 'navigation' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Paramètres</Text>
        </View>

        {settings.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map(item => (
              <TouchableOpacity
                key={item.key}
                style={styles.row}
                onPress={() => handleItemPress(item)}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </View>
                <View style={styles.rowRight}>
                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value as boolean}
                      onValueChange={() => {}}
                      trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                      thumbColor={item.value ? '#fff' : '#fff'}
                    />
                  )}
                  {item.type === 'navigation' && (
                    <Text style={styles.itemValue}>{item.value}</Text>
                  )}
                  {item.type === 'info' && (
                    <Text style={styles.itemValue}>{item.value}</Text>
                  )}
                  {item.type === 'action' && (
                    <Text style={styles.actionText}>▶</Text>
                  )}
                  {item.type === 'destructive' && (
                    <Text style={styles.destructiveText}>Supprimer</Text>
                  )}
                  {item.type === 'link' && (
                    <Text style={styles.actionText}>▶</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function handleItemPress(item: any) {
  console.log('Settings item pressed:', item.key);
  if (item.key === 'export_data') {
    alert('Export CSV/JSON - TODO');
  }
  if (item.key === 'delete_history') {
    alert('Supprimer tout l\'historique - TODO');
  }
  if (item.key === 'github') {
    alert('https://github.com/poirouxmartin/smart_clock');
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rowLeft: { flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { fontSize: 16, color: '#e2e8f0' },
  itemValue: { fontSize: 15, color: '#8b9cb3' },
  actionText: { fontSize: 16, color: '#64748b' },
  destructiveText: { fontSize: 15, color: '#ef4444' },
});