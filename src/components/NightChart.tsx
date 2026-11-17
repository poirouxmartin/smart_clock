import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useI18n } from '@/modules/i18n';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { buildChartModel, type ChartPoint } from '@/modules/night/nightChart';
import { makeTypography, Spacing, useTheme, useThemedStyles, type Palette } from '@/theme';

const HEIGHT = 190;
const LEFT = 52; // y labels
const RIGHT = 8;
const TOP = 26; // alarm label
const BOTTOM = 24; // hour labels

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Smooth path through the known points; an unknown point breaks the line. */
function linePaths(points: ChartPoint[], x: (t: number) => number, y: (l: number) => number): string[] {
  const runs: ChartPoint[][] = [];
  let run: ChartPoint[] = [];
  for (const p of points) {
    if (p.level === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length) runs.push(run);
  return runs.map(r =>
    r
      .map((p, i) => {
        const px = x(p.t);
        const py = y(p.level as number);
        if (i === 0) return `M${px},${py}`;
        const prev = r[i - 1];
        const mx = (x(prev.t) + px) / 2;
        return `C${mx},${y(prev.level as number)} ${mx},${py} ${px},${py}`;
      })
      .join(' ')
  );
}

export function NightChart({ summary }: { summary: NightSummary }) {
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useI18n();
  const tn = (key: string, o?: Record<string, any>) => t(key, o, 'night');
  const [width, setWidth] = useState(0);
  const model = useMemo(() => buildChartModel(summary), [summary]);

  const plotW = Math.max(1, width - LEFT - RIGHT);
  const plotH = HEIGHT - TOP - BOTTOM;
  const span = Math.max(1, model.endMs - model.startMs);
  const x = (ms: number) => LEFT + ((ms - model.startMs) / span) * plotW;
  const y = (level: number) => TOP + (1 - level / 2) * plotH;
  const lines = width > 0 ? linePaths(model.points, x, y) : [];
  const bottomY = TOP + plotH;
  // "HH:MM" at 11 px is ~26 px wide: pull the last label inside the view, skip any label that would overlap.
  const labelX = (tick: number) => Math.min(x(tick), width - 14);
  const labelled = new Set<number>();
  let lastLabelX = -Infinity;
  for (const tick of model.ticks) {
    if (labelX(tick) - lastLabelX >= 29) {
      labelled.add(tick);
      lastLabelX = labelX(tick);
    }
  }
  const levels = [
    { l: 2, key: 'levelAwake' },
    { l: 1, key: 'levelLight' },
    { l: 0, key: 'levelCalm' },
  ];

  return (
    <View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <SvgGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.primary} stopOpacity={0.35} />
                <Stop offset="1" stopColor={c.primary} stopOpacity={0.02} />
              </SvgGradient>
            </Defs>

            {model.window && (
              <Rect
                x={x(Math.max(model.window.fromMs, model.startMs))}
                y={TOP}
                width={Math.max(0, x(Math.min(model.window.toMs, model.endMs)) - x(Math.max(model.window.fromMs, model.startMs)))}
                height={plotH}
                fill={c.accent}
                opacity={0.25}
              />
            )}

            {levels.map(({ l, key }) => (
              <React.Fragment key={key}>
                <Line x1={LEFT} x2={LEFT + plotW} y1={y(l)} y2={y(l)} stroke={c.border} strokeWidth={1} strokeDasharray="3,5" />
                <SvgText x={LEFT - 6} y={y(l) + 4} fill={c.textMuted} fontSize={11} textAnchor="end">
                  {tn(key)}
                </SvgText>
              </React.Fragment>
            ))}

            {model.ticks.map(tick => (
              <React.Fragment key={tick}>
                <Line x1={x(tick)} x2={x(tick)} y1={TOP} y2={bottomY + 4} stroke={c.border} strokeWidth={1} />
                {labelled.has(tick) && (
                  <SvgText
                    x={labelX(tick)}
                    y={HEIGHT - 6}
                    fill={c.textMuted}
                    fontSize={11}
                    textAnchor="middle"
                  >
                    {hm(tick)}
                  </SvgText>
                )}
              </React.Fragment>
            ))}

            {lines.map((d, i) => {
              const startX = d.slice(1).split(',')[0];
              const endX = d.includes(' ') ? d.slice(d.lastIndexOf(' ') + 1).split(',')[0] : startX;
              return (
                <React.Fragment key={i}>
                  <Path d={`${d} L${endX},${bottomY} L${startX},${bottomY} Z`} fill="url(#fill)" />
                  <Path d={d} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                </React.Fragment>
              );
            })}

            {model.targetMs !== null && model.targetMs <= model.endMs && (
              <Line x1={x(model.targetMs)} x2={x(model.targetMs)} y1={TOP} y2={bottomY} stroke={c.textDim} strokeWidth={1.5} strokeDasharray="4,4" />
            )}

            {model.alarmMs !== null && (
              <>
                <Line x1={x(model.alarmMs)} x2={x(model.alarmMs)} y1={TOP - 4} y2={bottomY} stroke={c.warning} strokeWidth={2} />
                <Circle cx={x(model.alarmMs)} cy={TOP - 4} r={4} fill={c.warning} />
                <SvgText
                  x={Math.min(x(model.alarmMs), LEFT + plotW)}
                  y={TOP - 12}
                  fill={c.warning}
                  fontSize={12}
                  fontWeight="600"
                  textAnchor={x(model.alarmMs) > LEFT + plotW - 40 ? 'end' : 'middle'}
                >
                  {tn('alarmRangAt', { time: hm(model.alarmMs) })}
                </SvgText>
              </>
            )}
          </Svg>
        )}
      </View>

      <View style={styles.legend}>
        {model.alarmMs === null && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c.textDim }]} />
            <Text style={styles.legendText}>{tn('alarmNotRung')}</Text>
          </View>
        )}
        {model.window && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c.accent, opacity: 0.5 }]} />
            <Text style={styles.legendText}>
              {tn('windowLegend', { from: hm(model.window.fromMs), to: hm(model.window.toMs) })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    legendText: { ...T.caption, color: c.textSecondary },
  });
};
