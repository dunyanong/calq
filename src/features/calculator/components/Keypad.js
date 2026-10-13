// Dark keypad: drag handle, SHIFT/ALPHA bar with cursor keys, two swipeable
// pages of keys, and the page footer. Casio layout in the app's colours:
// greys plus the sky-blue accent for =, SHIFT and DEL/AC.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import KeyButton, { tick } from './KeyButton';
import { CameraIcon, ChevronLeft, ChevronRight } from '@/components/Icons';
import { NUMERIC_ROWS, SCIENTIFIC_ROWS, faceSize, isLetterMode, resolveKey } from '@/features/calculator/math/keys';
import { F } from '@/theme/fonts';
import { pad } from '@/theme/tokens';

const MODE_COLORS = { shift: pad.shiftOn, alpha: pad.alphaOn, sto: pad.alphaOn, rcl: pad.alphaOn, hyp: pad.hypOn };
const MODE_LABELS = { shift: 'SHIFT ON', alpha: 'ALPHA ON', sto: 'STO', rcl: 'RCL', hyp: 'HYP' };

function KeyRows({ rows, cols, mode, output, onKey }) {
  const gap = cols === 5 ? 7 : 6;
  const radius = cols === 5 ? 10 : 9;
  const minH = rows.length > 4 ? 30 : 34; // the 5-row page must fit small phones
  const labelSize = cols === 5 ? 10.5 : 10;
  return (
    <View style={[styles.page, { gap: rows.length > 4 ? 6 : 8 }]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.rowWrap}>
          {/* hidden (not removed) while a mode is on: the faces already show it, and the keys must not jump */}
          <View style={[styles.labelRow, { gap, opacity: mode ? 0 : 1 }]}>
            {row.map((key, i) => (
              <View key={i} style={styles.labelCell}>
                <Text style={[styles.subLabel, { fontSize: labelSize, color: pad.shiftLabel }]} numberOfLines={1}>
                  {key.shift ? key.shift.label : ''}
                </Text>
                <Text style={[styles.subLabel, styles.alphaLabel, { fontSize: labelSize - 1.5 }]} numberOfLines={1}>
                  {key.alpha || ''}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.keyRow, { gap, minHeight: minH }]}>
            {row.map((key, i) => {
              const { face, active, dim } = resolveKey(key, mode, output);
              const c = active ? MODE_COLORS[active] : pad[key.kind];
              return (
                <KeyButton
                  key={i}
                  face={face}
                  size={faceSize(face, active ? 'fn' : key.kind)}
                  bg={c.bg}
                  ink={c.ink}
                  silent={!active && !dim && key.kind === 'eq'} // = answers with its own haptic (result or error)
                  dim={dim}
                  radius={radius}
                  minHeight={minH}
                  onPress={() => onKey(key)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Small square toolbar button (cursor keys, scan). */
function ToolButton({ onPress, onLongPress, label, children }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      onLongPress={
        onLongPress &&
        (() => {
          tick();
          onLongPress();
        })
      }
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tool, pressed && { transform: [{ translateY: 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * @param {object} p
 * @param {'shift'|'alpha'|'sto'|'rcl'|'hyp'|null} p.mode
 * @param {'dec'|'frac'} p.output   result format (the a/b key shows the other one)
 * @param {(key) => void} p.onKey
 * @param {(dir: -1|1, jump: boolean) => void} p.onCursor   ◀ ▶ (long-press jumps to the start / end)
 * @param {boolean} p.hidden          keypad collapsed to its handle
 * @param {(hidden: boolean) => void} p.onHiddenChange
 * @param {number} p.bottomInset     safe-area space below the footer
 */
export default function Keypad({
  mode,
  output,
  onKey,
  onCursor,
  onToggleShift,
  onToggleAlpha,
  onScan,
  hidden,
  onHiddenChange,
  bottomInset = 0,
}) {
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const scroller = useRef(null);
  const [drag] = useState(() => new Animated.Value(0));

  // Swipe the handle down to hide the keypad, up (or tap) to show it again.
  // Rebuilt when `hidden` changes, which only happens between gestures.
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => {
          if (!hidden && g.dy > 0) drag.setValue(Math.min(g.dy, 90));
        },
        onPanResponderRelease: (_, g) => {
          const tapped = Math.abs(g.dy) <= 4;
          if (!hidden && g.dy > 46) onHiddenChange(true);
          else if (hidden && (g.dy < -20 || tapped)) onHiddenChange(false);
          Animated.timing(drag, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [hidden, onHiddenChange, drag],
  );

  // The variable letters are on the numeric page: ALPHA, STO and RCL bring it into view.
  const letters = isLetterMode(mode);
  useEffect(() => {
    if (!letters) return;
    setPage(0);
    scroller.current?.scrollTo({ x: 0, animated: true });
  }, [letters]);

  const goTo = (p) => {
    if (p < 0 || p > 1) return;
    setPage(p);
    scroller.current?.scrollTo({ x: p * width, animated: true });
  };

  // Keep the current page in view when the pager width changes.
  const onPagerLayout = (e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth(w);
    scroller.current?.scrollTo({ x: page * w, animated: false });
  };

  const modeLabel = MODE_LABELS[mode] || '';
  const modeInk = mode === 'shift' ? pad.shiftLabel : mode === 'hyp' ? pad.hypOn.ink : pad.alphaLabel;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: drag }] }]}>
      <View {...handlePan.panHandlers} style={[styles.handleZone, hidden && styles.handleZoneHidden]}>
        <View style={styles.handle} />
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={onToggleShift}
          style={({ pressed }) => [
            styles.modeBtn,
            { backgroundColor: mode === 'shift' ? pad.shiftBtn.on : pad.shiftBtn.off, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.modeText, { color: mode === 'shift' ? pad.shiftBtn.onInk : pad.shiftBtn.offInk }]}>SHIFT</Text>
        </Pressable>
        <Pressable
          onPress={onToggleAlpha}
          style={({ pressed }) => [
            styles.modeBtn,
            { backgroundColor: mode === 'alpha' ? pad.alphaBtn.on : pad.alphaBtn.off, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.modeText, { color: mode === 'alpha' ? pad.alphaBtn.onInk : pad.alphaBtn.offInk }]}>ALPHA</Text>
        </Pressable>
        <Text style={[styles.modeLabel, { color: modeInk }]} numberOfLines={1}>
          {modeLabel}
        </Text>
        <ToolButton label="Cursor left" onPress={() => onCursor(-1, false)} onLongPress={() => onCursor(-1, true)}>
          <ChevronLeft color={pad.scanInk} />
        </ToolButton>
        <ToolButton label="Cursor right" onPress={() => onCursor(1, false)} onLongPress={() => onCursor(1, true)}>
          <ChevronRight color={pad.scanInk} />
        </ToolButton>
        <ToolButton label="Scan a calculation" onPress={onScan}>
          <CameraIcon color={pad.scanInk} />
        </ToolButton>
      </View>

      <View style={styles.pager} onLayout={onPagerLayout}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          contentContainerStyle={{ width: width * 2 }}
        >
          <View style={{ width }}>
            <KeyRows rows={NUMERIC_ROWS} cols={5} mode={mode} output={output} onKey={onKey} />
          </View>
          <View style={{ width }}>
            <KeyRows rows={SCIENTIFIC_ROWS} cols={6} mode={mode} output={output} onKey={onKey} />
          </View>
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: 2 + bottomInset }]}>
        <Pressable
          onPress={() => goTo(page - 1)}
          disabled={page === 0}
          accessibilityLabel="Previous page"
          style={({ pressed }) => [styles.arrow, { opacity: page === 0 ? 0.3 : pressed ? 0.6 : 1 }]}
        >
          <ChevronLeft color={pad.scanInk} />
        </Pressable>
        <View style={styles.dots}>
          {[0, 1].map((p) => (
            <Pressable key={p} onPress={() => goTo(p)} hitSlop={8}>
              <View style={[styles.dot, { width: page === p ? 18 : 6, backgroundColor: page === p ? pad.dotOn : pad.dotOff }]} />
            </Pressable>
          ))}
          <Text style={styles.pageLabel}>{page === 0 ? 'NUMERIC' : 'SCIENTIFIC'}</Text>
        </View>
        <Pressable
          onPress={() => goTo(page + 1)}
          disabled={page === 1}
          accessibilityLabel="Next page"
          style={({ pressed }) => [styles.arrow, { opacity: page === 1 ? 0.3 : pressed ? 0.6 : 1 }]}
        >
          <ChevronRight color={pad.scanInk} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: pad.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 6,
    paddingHorizontal: 14,
  },
  handleZone: { paddingTop: 9, paddingBottom: 11, alignItems: 'center' },
  handleZoneHidden: { paddingTop: 22, paddingBottom: 24 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: pad.handle },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingBottom: 10 },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 13, borderRadius: 8 },
  modeText: { fontSize: 11, fontFamily: F.bodyHeavy },
  modeLabel: { flex: 1, textAlign: 'right', fontSize: 10.5, fontFamily: F.bodyHeavy, letterSpacing: 0.7 },
  tool: { width: 32, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pad.scanBg },
  pager: { flex: 1, minHeight: 0 },
  page: { flex: 1, paddingHorizontal: 2 },
  rowWrap: { flex: 1, minHeight: 0, gap: 3 },
  labelRow: { flexDirection: 'row', paddingHorizontal: 1 },
  labelCell: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 5, overflow: 'hidden' },
  subLabel: { fontFamily: F.labelBold, letterSpacing: 0.2 },
  alphaLabel: { color: pad.alphaLabel, opacity: 0.7 }, // quieter than SHIFT
  keyRow: { flex: 1, flexDirection: 'row' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 4 },
  arrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: pad.arrowBorder },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { height: 6, borderRadius: 3 },
  pageLabel: { fontSize: 10, fontFamily: F.bodyBold, letterSpacing: 0.6, color: pad.pageLabel, marginLeft: 5 },
});
