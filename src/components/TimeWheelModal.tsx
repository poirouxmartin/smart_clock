import React, { useRef, useState } from 'react';
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
  // The body mounts on each opening so both wheels start on the current time.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible && <WheelBody minutes={minutes} onCancel={onCancel} onConfirm={onConfirm} />}
    </Modal>
  );
}

function WheelBody({ minutes, onCancel, onConfirm }: Omit<Props, 'visible'>) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useI18n();
  const tn = (key: string) => t(key, undefined, 'night');
  const [hour, setHour] = useState(() => Math.floor(minutes / 60) % 24);
  const [minuteIdx, setMinuteIdx] = useState(() => Math.min(11, Math.round((minutes % 60) / 5)));

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{tn('setTime')}</Text>
        <View style={styles.wheels}>
          <View style={styles.band} pointerEvents="none" />
          <Wheel values={HOURS} initialIndex={hour} index={hour} onChange={setHour} />
          <Text style={styles.colon}>:</Text>
          <Wheel values={MINUTES} initialIndex={minuteIdx} index={minuteIdx} onChange={setMinuteIdx} />
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
  );
}

function Wheel({ values, initialIndex, index, onChange }: { values: number[]; initialIndex: number; index: number; onChange: (i: number) => void }) {
  const styles = useThemedStyles(makeStyles);
  const ref = useRef<ScrollView>(null);
  // Captured once: the wheel opens on the current value, later scrolls are the user's.
  const startY = useRef(initialIndex * ITEM_H).current;
  const placed = useRef(false);

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
      contentOffset={{ x: 0, y: startY }}
      onContentSizeChange={() => {
        if (placed.current) return;
        placed.current = true;
        ref.current?.scrollTo({ y: startY, animated: false });
      }}
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
