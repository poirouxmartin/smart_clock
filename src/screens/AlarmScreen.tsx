import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { Screen, Card } from '@/components/Screen';
import { ValueStepper } from '@/components/ValueStepper';
import { TimeWheelModal } from '@/components/TimeWheelModal';
import { requestAutoPermissions, useNightSettings } from '@/modules/night/useNightSettings';
import { DAY_KEYS, formatMinuteOfDay, isDayOn } from '@/modules/night/autoConfig';
import { DAWN_CHOICES, RAMP_CHOICES, WINDOW_CHOICES, dayTarget, hm, nextTargetMs, stepChoice } from '@/modules/night/wakeChoices';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { WakeOptions, WakeSound } from '../../modules/smart-alarm';
import { makeTypography, Spacing, Radius, useTheme, useThemedStyles, type Palette } from '@/theme';

type McIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const SOUND_CHOICES: Array<{ id: WakeSound; labelKey: string; icon: McIconName }> = [
  { id: 'birds', labelKey: 'soundBirds', icon: 'bird' },
  { id: 'waves', labelKey: 'soundWaves', icon: 'waves' },
  { id: 'forest', labelKey: 'soundForest', icon: 'pine-tree' },
  { id: 'rain', labelKey: 'soundRain', icon: 'weather-rainy' },
  { id: 'stream', labelKey: 'soundStream', icon: 'water' },
  { id: 'storm', labelKey: 'soundStorm', icon: 'weather-lightning' },
];

const pad = (n: number) => String(n).padStart(2, '0');

export function AlarmScreen() {
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');
  const { settings, updateSettings } = useNightSettings();

  const [activityDenied, setActivityDenied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dayPicker, setDayPicker] = useState<number | null>(null);
  const [wake, setWake] = useState<WakeOptions>({ sound: 'birds', rampSeconds: 60, dawnEnabled: true, dawnMinutes: 30, torch: false });

  useEffect(() => {
    SmartAlarm.getWakeOptions()
      .then(setWake)
      .catch(e => console.error('getWakeOptions error:', e));
    return () => {
      SmartAlarm.stopPreview().catch(e => console.error('stopPreview error:', e));
    };
  }, []);

  const updateWake = async (partial: Partial<WakeOptions>) => {
    try {
      setWake(await SmartAlarm.setWakeOptions(partial));
    } catch (e) {
      console.error('setWakeOptions error:', e);
    }
  };

  const onToggleAuto = async (value: boolean) => {
    updateSettings({ auto: value });
    if (value) setActivityDenied(await requestAutoPermissions());
  };

  const onPickSound = async (id: WakeSound) => {
    await updateWake({ sound: id });
    try {
      await SmartAlarm.previewSound(id);
    } catch (e) {
      console.error('previewSound error:', e);
    }
  };

  const onTestRing = async () => {
    try {
      await SmartAlarm.testRing(10);
      Alert.alert(tn('testRing'), tn('testScheduled'));
    } catch (e) {
      console.error('testRing error:', e);
    }
  };

  const setDayMinutes = (dayIndex: number, minutes: number) => {
    const next = [...settings.dayMinutes];
    next[dayIndex] = minutes;
    updateSettings({ dayMinutes: next });
  };

  const targetMs = nextTargetMs(settings.targetMinutes, new Date(), settings.dayMinutes);
  const windowStartMs = targetMs - settings.windowMinutes * 60000;
  const timeText = `${pad(Math.floor(settings.targetMinutes / 60))}:${pad(settings.targetMinutes % 60)}`;
  const trackColor = { false: c.bgSurface, true: c.primaryDark };

  return (
    <Screen title={tn('alarmTitle')} icon="alarm-outline">
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.cardHeaderInline}>
            <Ionicons name="leaf-outline" size={18} color={c.primary} />
            <Text style={styles.cardTitle}>{tn('autoTitle')}</Text>
          </View>
          <Switch value={settings.auto} onValueChange={onToggleAuto} trackColor={trackColor} thumbColor={c.text} />
        </View>
        {settings.auto && activityDenied && <Text style={styles.hint}>{tn('autoActivityDenied')}</Text>}
      </View>

      <Card title={tn('smartAlarm')} icon="alarm-outline">
        <Text style={styles.label}>{tn('target')}</Text>
        <TouchableOpacity style={styles.timeButton} onPress={() => setPickerOpen(true)} accessibilityRole="button">
          <Text style={styles.time}>{timeText}</Text>
          <Text style={styles.caption}>{tn('tapToChange')}</Text>
        </TouchableOpacity>
        {settings.auto && settings.daysMask !== 0 && (
          <View>
            <Text style={styles.label}>{tn('perDayTitle')}</Text>
            {DAY_KEYS.map((key, i) => {
              if (!isDayOn(settings.daysMask, i)) return null;
              const custom = dayTarget(-1, settings.dayMinutes, i) >= 0;
              const minutes = dayTarget(settings.targetMinutes, settings.dayMinutes, i);
              return (
                <View key={key} style={styles.dayRow}>
                  <TouchableOpacity style={styles.dayRowMain} onPress={() => setDayPicker(i)} accessibilityRole="button">
                    <Text style={styles.dayName}>{tn(`dayName${i}`)}</Text>
                    <Text style={[styles.dayTime, !custom && styles.dayTimeDefault]}>
                      {formatMinuteOfDay(minutes)}
                      {!custom && `  ${tn('perDayDefault')}`}
                    </Text>
                  </TouchableOpacity>
                  {custom ? (
                    <TouchableOpacity
                      style={styles.dayReset}
                      onPress={() => setDayMinutes(i, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={tn('perDayReset')}
                    >
                      <MaterialCommunityIcons name="restore" size={18} color={c.primaryLight} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.dayReset} />
                  )}
                </View>
              );
            })}
          </View>
        )}
        <ValueStepper
          label={tn('window')}
          value={tn('minutesValue', { min: settings.windowMinutes })}
          onMinus={() => updateSettings({ windowMinutes: stepChoice(WINDOW_CHOICES, settings.windowMinutes, -1) })}
          onPlus={() => updateSettings({ windowMinutes: stepChoice(WINDOW_CHOICES, settings.windowMinutes, 1) })}
          canMinus={settings.windowMinutes > WINDOW_CHOICES[0]}
          canPlus={settings.windowMinutes < WINDOW_CHOICES[WINDOW_CHOICES.length - 1]}
        />
        <Text style={styles.windowLine}>{tn('windowLine', { from: hm(windowStartMs), to: hm(targetMs) })}</Text>
      </Card>

      <Card title={tn('wakeStyleTitle')} icon="musical-notes-outline">
        <Text style={styles.label}>{tn('soundLabel')}</Text>
        <Text style={styles.captionTop}>{tn('previewHint')}</Text>
        <View style={styles.tileGrid}>
          {SOUND_CHOICES.map(choice => {
            const active = wake.sound === choice.id;
            return (
              <TouchableOpacity key={choice.id} style={[styles.tile, active && styles.tileActive]} onPress={() => onPickSound(choice.id)}>
                <MaterialCommunityIcons name={choice.icon} size={26} color={active ? c.onPrimary : c.primaryLight} />
                <Text style={[styles.tileText, active && styles.tileTextActive]}>{tn(choice.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ValueStepper
          label={tn('rampLabel')}
          value={tn('secondsValue', { s: wake.rampSeconds })}
          onMinus={() => updateWake({ rampSeconds: stepChoice(RAMP_CHOICES, wake.rampSeconds, -1) })}
          onPlus={() => updateWake({ rampSeconds: stepChoice(RAMP_CHOICES, wake.rampSeconds, 1) })}
          canMinus={wake.rampSeconds > RAMP_CHOICES[0]}
          canPlus={wake.rampSeconds < RAMP_CHOICES[RAMP_CHOICES.length - 1]}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{tn('dawnLabel')}</Text>
          <Switch value={wake.dawnEnabled} onValueChange={v => updateWake({ dawnEnabled: v })} trackColor={trackColor} thumbColor={c.text} />
        </View>
        {wake.dawnEnabled && (
          <ValueStepper
            label={tn('dawnDuration')}
            value={tn('minutesValue', { min: wake.dawnMinutes })}
            onMinus={() => updateWake({ dawnMinutes: stepChoice(DAWN_CHOICES, wake.dawnMinutes, -1) })}
            onPlus={() => updateWake({ dawnMinutes: stepChoice(DAWN_CHOICES, wake.dawnMinutes, 1) })}
            canMinus={wake.dawnMinutes > DAWN_CHOICES[0]}
            canPlus={wake.dawnMinutes < DAWN_CHOICES[DAWN_CHOICES.length - 1]}
          />
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{tn('torchLabel')}</Text>
          <Switch value={wake.torch} onValueChange={v => updateWake({ torch: v })} trackColor={trackColor} thumbColor={c.text} />
        </View>
        <Text style={styles.caption}>{tn('torchCaption')}</Text>
      </Card>

      <TouchableOpacity style={styles.testButton} onPress={onTestRing}>
        <Ionicons name="notifications-outline" size={20} color={c.primaryLight} />
        <Text style={styles.testText}>{tn('testRing')}</Text>
      </TouchableOpacity>

      <TimeWheelModal
        visible={pickerOpen}
        minutes={settings.targetMinutes}
        onCancel={() => setPickerOpen(false)}
        onConfirm={m => {
          setPickerOpen(false);
          updateSettings({ targetMinutes: m });
        }}
      />
      <TimeWheelModal
        visible={dayPicker !== null}
        minutes={dayPicker === null ? settings.targetMinutes : dayTarget(settings.targetMinutes, settings.dayMinutes, dayPicker)}
        onCancel={() => setDayPicker(null)}
        onConfirm={m => {
          const day = dayPicker;
          setDayPicker(null);
          if (day !== null) setDayMinutes(day, m);
        }}
      />
    </Screen>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    card: { backgroundColor: c.bgCard + 'e6', borderRadius: 24, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: c.border },
    cardHeaderInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    cardTitle: { ...T.label, color: c.text },
    label: { ...T.caption, marginTop: Spacing.md, marginBottom: Spacing.xs },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.md },
    switchLabel: { ...T.bodySmall, color: c.text, flex: 1 },
    hint: { ...T.caption, color: c.warning, marginTop: Spacing.md },
    caption: { ...T.caption, color: c.textMuted, marginTop: Spacing.sm },
    captionTop: { ...T.caption, color: c.textMuted, marginBottom: Spacing.sm },
    timeButton: { alignItems: 'center', paddingVertical: Spacing.sm },
    time: { fontSize: 56, fontWeight: '300', color: c.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
    dayRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.borderLight },
    dayRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    dayName: { ...T.bodySmall, color: c.text },
    dayTime: { ...T.bodySmall, color: c.primaryLight, fontWeight: '600', fontVariant: ['tabular-nums'] },
    dayTimeDefault: { color: c.textMuted, fontWeight: '400' },
    dayReset: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    windowLine: { ...T.body, color: c.primaryLight, marginTop: Spacing.lg, textAlign: 'center', fontWeight: '500' },
    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tile: {
      flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md,
      borderRadius: 16, borderWidth: 1, borderColor: c.borderLight,
    },
    tileActive: { backgroundColor: c.primary, borderColor: c.primary },
    tileText: { ...T.bodySmall, color: c.textSecondary },
    tileTextActive: { color: c.onPrimary, fontWeight: '600' },
    testButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 16,
      borderRadius: Radius.xl, borderWidth: 1, borderColor: c.primary, marginBottom: Spacing.lg,
    },
    testText: { ...T.body, color: c.primaryLight, fontWeight: '600' },
  });
};
