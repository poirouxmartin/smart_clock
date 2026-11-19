import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useI18n } from '@/modules/i18n';
import { fromWheel } from '@/modules/night/wakeChoices';
import { makeTypography, Spacing, Radius, useThemedStyles, type Palette } from '@/theme';

const ITEM_H = 44;
const VISIBLE = 5;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  visible: boolean;
  minutes: number;
  onCancel: () => void;
  onConfirm: (minutes: number) => void;
}

export function TimeWheelModal({ visible, minutes, onCancel, onConfirm }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useI18n();
  const tn = (key: string) => t(key, undefined, 'night');

  const [hour, setHour] = useState(0);
  const [minuteIdx, setMinuteIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setHour(Math.floor(minutes / 60));
    setMinuteIdx(Math.min(11, Math.round((minutes % 60) / 5)));
  }, [visible, minutes]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{tn('setTime')}</Text>
          <View style={styles.wheels}>
            <View style={styles.band} pointerEvents="none" />
            <Wheel visible={visible} values={HOURS} index={hour} onChange={setHour} />
            <Text style={styles.colon}>:</Text>
            <Wheel visible={visible} values={MINUTES} index={minuteIdx} onChange={setMinuteIdx} />
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={styles.cancelText}>{tn('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => onConfirm(fromWheel(hour, MINUTES[minuteIdx]))}>
              <Text style={styles.okText}>{tn('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Wheel({ visible, values, index, onChange }: { visible: boolean; values: number[]; index: number; onChange: (i: number) => void }) {
  const styles = useThemedStyles(makeStyles);
  const ref = useRef<ScrollView>(null);

  // Position the wheel on the selected value each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM_H, animated: false }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    onChange(i);
  };

  const select = (i: number) => {
    onChange(i);
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      contentContainerStyle={styles.wheelContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {values.map((v, i) => (
        <TouchableOpacity key={v} style={styles.item} onPress={() => select(i)} activeOpacity={0.7}>
          <Text style={i === index ? styles.itemSelected : styles.itemText}>{pad(v)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    card: { width: '100%', maxWidth: 360, backgroundColor: c.bgCard, borderRadius: 24, padding: Spacing.xl, borderWidth: 1, borderColor: c.border },
    title: { ...T.label, color: c.text, textAlign: 'center', marginBottom: Spacing.md },
    wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    band: { position: 'absolute', left: 0, right: 0, top: ITEM_H * 2, height: ITEM_H, borderRadius: Radius.md, backgroundColor: c.bgSurface },
    wheel: { height: ITEM_H * VISIBLE, width: 80, flexGrow: 0 },
    wheelContent: { paddingVertical: ITEM_H * 2 },
    item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
    itemText: { fontSize: 22, color: c.textMuted, fontVariant: ['tabular-nums'] },
    itemSelected: { fontSize: 30, fontWeight: '500', color: c.text, fontVariant: ['tabular-nums'] },
    colon: { fontSize: 30, fontWeight: '300', color: c.textMuted },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.lg },
    button: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    cancelText: { ...T.body, color: c.textMuted },
    okText: { ...T.body, color: c.primaryLight, fontWeight: '700' },
  });
};
