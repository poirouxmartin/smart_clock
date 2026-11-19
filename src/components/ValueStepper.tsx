import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { makeTypography, Spacing, useThemedStyles, useTheme, type Palette } from '@/theme';

interface Props {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  canMinus: boolean;
  canPlus: boolean;
}

export function ValueStepper({ label, value, onMinus, onPlus, canMinus, canPlus }: Props) {
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useI18n();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.button, !canMinus && styles.buttonDisabled]}
        onPress={onMinus}
        disabled={!canMinus}
        accessibilityLabel={t('decrease', undefined, 'night')}
      >
        <Ionicons name="remove" size={20} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        style={[styles.button, !canPlus && styles.buttonDisabled]}
        onPress={onPlus}
        disabled={!canPlus}
        accessibilityLabel={t('increase', undefined, 'night')}
      >
        <Ionicons name="add" size={20} color={c.text} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    label: { ...T.bodySmall, color: c.text, flex: 1 },
    button: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
    buttonDisabled: { opacity: 0.35 },
    value: { ...T.body, color: c.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  });
};
