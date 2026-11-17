import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, type SwitchProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { makeTypography, Spacing, useTheme, useThemedStyles, THEME_IDS, PALETTES, asGradient, type Palette } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const THEME_LABEL_KEYS = { night: 'themeNight', nature: 'themeNature', dawn: 'themeDawn' } as const;

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    content: { padding: Spacing.xl, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xxl },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
    title: { ...T.h2, flex: 1 },

    card: { backgroundColor: c.bgCard + 'e6', borderRadius: 24, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: c.border },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    cardTitle: { ...T.label, color: c.text },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowLabel: { ...T.body, color: c.text, flex: 1 },
    rowLabelDestructive: { color: c.danger },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowValue: { ...T.bodySmall, color: c.textMuted },

    themeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
    themeItem: { alignItems: 'center', gap: Spacing.sm },
    swatchRing: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
    swatchRingActive: { borderColor: c.primary },
    swatch: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    themeLabel: { ...T.caption },
    themeLabelActive: { color: c.text, fontWeight: '600' },
  });
};

export function Screen({ title, icon, children }: { title: string; icon?: IconName; children: React.ReactNode }) {
  const navigation = useNavigation();
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <LinearGradient colors={asGradient(c.background)} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={c.textSecondary} />
            </TouchableOpacity>
            {icon && <Ionicons name={icon} size={24} color={c.primary} />}
            <Text style={styles.title}>{title}</Text>
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Card({ title, icon, children, style }: { title?: string; icon?: IconName; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.card, style]}>
      {(title || icon) && (
        <View style={styles.cardHeader}>
          {icon && <Ionicons name={icon} size={18} color={c.primary} />}
          {title && <Text style={styles.cardTitle}>{title}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

export function Row({ label, value, onPress, right, destructive }: { label: string; value?: string; onPress?: () => void; right?: React.ReactNode; destructive?: boolean }) {
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowRight}>
        {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
        {right}
        {onPress && !right && <Ionicons name="chevron-forward" size={16} color={c.textDim} />}
      </View>
    </TouchableOpacity>
  );
}

export function ThemedSwitch(props: SwitchProps) {
  const { palette: c } = useTheme();
  return <Switch trackColor={{ false: c.bgSurface, true: c.primaryDark }} thumbColor={c.text} {...props} />;
}

export function ThemePicker() {
  const { t } = useI18n();
  const { themeId, setThemeId } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.themeRow}>
      {THEME_IDS.map(id => {
        const active = id === themeId;
        return (
          <TouchableOpacity key={id} style={styles.themeItem} onPress={() => setThemeId(id)}>
            <View style={[styles.swatchRing, active && styles.swatchRingActive]}>
              <LinearGradient colors={asGradient(PALETTES[id].background)} style={styles.swatch}>
                <Ionicons name={PALETTES[id].icon} size={18} color={PALETTES[id].primary} />
              </LinearGradient>
            </View>
            <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{t(THEME_LABEL_KEYS[id], undefined, 'night')}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
