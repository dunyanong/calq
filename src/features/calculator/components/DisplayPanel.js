// Cream display: past calculations (tap one to edit it again, hold it for its panel; while
// selecting, a tap adds or removes it) + entry line.
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';
import AngleBadge, { angleMode } from '@/components/AngleBadge';
import Loader from '@/components/Loader';
import { BOX, boxLabel } from '@/features/calculator/math/entry';

// Memoised: the entry changes on every key press, the cards do not.
const HistoryCard = memo(function HistoryCard({ item, t, held, selecting, selected, onHold, onRecall, onToggle }) {
  // fade + slide up when a card appears
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => (selecting ? onToggle(item.id) : onRecall(item))}
        onLongPress={() => (selecting ? onToggle(item.id) : onHold(item.id))}
        delayLongPress={300}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked: selected } : undefined}
        accessibilityHint={selecting ? 'Tap to select or deselect' : 'Tap to edit it again, hold for more'}
        style={[
          styles.card,
          item.pinned && { backgroundColor: t.pinnedRowBg },
          selected && { backgroundColor: t.selBg },
          (held || selected) && { borderColor: BLUE },
        ]}
      >
        <View style={styles.head}>
          <View style={styles.badges}>
            {selecting && (
              <View style={[styles.check, selected ? styles.checkOn : { borderColor: t.displayRule }]}>
                {selected && <Text style={styles.checkMark}>✓</Text>}
              </View>
            )}
            <AngleBadge angle={item.angle} t={t} />
          </View>
          <Text style={[styles.expr, { color: t.displayInk }]}>{item.expr}</Text>
        </View>
        <Text style={[styles.res, { color: t.displayInk }]}>= {item.result}</Text>
      </Pressable>
    </Animated.View>
  );
});

/**
 * Part of the entry (starting at `offset` in `entry`) with each empty box
 * drawn as its greyed name: ∫( f(x) , from , to ).
 */
function withBoxes(s, offset, entry, color) {
  if (!s.includes(BOX)) return s;
  const out = [];
  let start = 0;
  for (let i = s.indexOf(BOX); i >= 0; i = s.indexOf(BOX, i + 1)) {
    out.push(s.slice(start, i));
    const label = boxLabel(entry, offset + i) || BOX;
    out.push(
      <Text key={i} style={[styles.box, { color }]}>
        {'\u2009' + label + '\u2009'}
      </Text>,
    );
    start = i + 1;
  }
  out.push(s.slice(start));
  return out;
}

/** Shakes its children sideways whenever `trigger` changes (not on mount). */
function Shake({ trigger, children }) {
  const [x] = useState(() => new Animated.Value(0));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const to = (v) => Animated.timing(x, { toValue: v, duration: 45, useNativeDriver: true });
    Animated.sequence([to(9), to(-8), to(6), to(-4), to(0)]).start();
  }, [trigger, x]);
  return <Animated.View style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>;
}

/**
 * @param {object} p
 * @param {Array} p.items          calculations to show (oldest first)
 * @param {string} p.entry         current input
 * @param {number} p.cursor        caret position in entry
 * @param {string|null} p.preview  value of the entry so far, shown dimmed
 * @param {string|null} p.hint     replaces the preview: what the box under the cursor is for,
 *                                 the variable values (ALPHA / STO / RCL) or "Finding a formula…"
 * @param {boolean} p.busy         waiting for the AI: the hint gets the loading dots
 * @param {number} p.shake         changes on a bad expression
 * @param {'deg'|'rad'|'grad'} p.angle  unit for the next calculation
 * @param {() => void} p.onAnglePress  the badge was tapped (opens the angle unit picker)
 * @param {boolean} p.memory       M holds a value (shows the M pill)
 * @param {boolean} p.pinFilter    showing pinned only
 * @param {string|null} p.heldId  the card whose panel is open
 * @param {(id) => void} p.onHold  a card was held
 * @param {(item) => void} p.onRecall  a card was tapped
 * @param {Set<string>|null} p.selected  selected cards; null when not selecting
 * @param {(id) => void} p.onToggle  a card was tapped while selecting
 * @param {() => void} p.onShowAll  SHOW ALL in the pinned-only bar
 * @param {Animated.Value|number} p.height
 */
export default function DisplayPanel({
  items,
  entry,
  cursor = entry.length,
  preview,
  hint,
  busy,
  shake,
  angle,
  onAnglePress,
  memory,
  pinFilter,
  onShowAll,
  heldId,
  onHold,
  onRecall,
  selected = null,
  onToggle,
  height,
  t,
}) {
  const scroller = useRef(null);
  const caret = <View style={[styles.caret, { backgroundColor: t.accent, opacity: entry ? 1 : 0.5 }]} />;
  return (
    <Animated.View style={[styles.panel, { height, backgroundColor: t.displayBg, borderBottomColor: t.displayBorder }]}>
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {pinFilter && (
          <View style={styles.pinnedBar}>
            <Text style={styles.pinnedText}>PINNED ONLY</Text>
            <Text style={[styles.pinnedText, styles.showAll]} onPress={onShowAll} suppressHighlighting>
              SHOW ALL
            </Text>
          </View>
        )}
        {items.map((item) => (
          <View key={item.id}>
            <View style={[styles.rule, { borderTopColor: t.displayRule }]} />
            <HistoryCard
              item={item}
              t={t}
              held={item.id === heldId}
              selecting={selected !== null}
              selected={!!selected?.has(item.id)}
              onHold={onHold}
              onRecall={onRecall}
              onToggle={onToggle}
            />
          </View>
        ))}
        {items.length > 0 && <View style={[styles.rule, { borderTopColor: t.displayRule }]} />}
        <Shake trigger={shake}>
          <View style={styles.entryRow}>
            <View style={styles.badges}>
              <Pressable
                onPress={onAnglePress}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={angleMode(angle).label + '. Tap to change angle unit'}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <AngleBadge angle={angle} t={t} />
              </Pressable>
              {memory && (
                <View accessible accessibilityLabel="Memory M in use" style={[styles.memory, { borderColor: t.accent }]}>
                  <Text style={[styles.memoryText, { color: t.accent }]}>M</Text>
                </View>
              )}
            </View>
            {/* caret drawn inline at the cursor */}
            <Text style={[styles.entry, { color: t.displayInk }]}>
              {entry ? withBoxes(entry.slice(0, cursor), 0, entry, t.accent) : ''}
              {caret}
              {entry ? withBoxes(entry.slice(cursor), cursor, entry, t.accent) : <Text style={styles.zero}>0</Text>}
            </Text>
          </View>
          {/* always laid out, so the line does not jump as the preview comes and goes */}
          {busy ? (
            <View style={styles.busy}>
              <Loader color={t.accent} size={4} label={hint} />
              <Text style={[styles.hint, styles.busyText, { color: t.accent }]} numberOfLines={1}>
                {hint}
              </Text>
            </View>
          ) : hint ? (
            <Text style={[styles.hint, { color: t.accent }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : (
            <Text style={[styles.preview, { color: t.displayInk, opacity: preview ? 0.45 : 0 }]} numberOfLines={1}>
              {'= ' + (preview || '')}
            </Text>
          )}
        </Shake>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { borderBottomWidth: 1, overflow: 'hidden' },
  content: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 11 },
  pinnedBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  pinnedText: { fontFamily: F.labelBold, fontSize: 10.5, letterSpacing: 0.6, color: BLUE },
  showAll: { textDecorationLine: 'underline' },
  rule: { height: 0, borderTopWidth: 1 },
  card: {
    alignItems: 'flex-end',
    gap: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    marginTop: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  // badge pinned top-left, expression top-right
  head: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  expr: { fontFamily: F.mono, fontSize: 12.5, opacity: 0.55, textAlign: 'right', flexShrink: 1 },
  res: { fontFamily: F.monoBold, fontSize: 16 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 24 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // same shape as AngleBadge
  memory: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  memoryText: { fontFamily: F.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  entry: { fontFamily: F.monoBold, fontSize: 18, textAlign: 'right', flexShrink: 1 },
  zero: { opacity: 0.35 },
  caret: { width: 2, height: 19, borderRadius: 1 },
  preview: { fontFamily: F.mono, fontSize: 14, textAlign: 'right', marginTop: 2 },
  hint: { fontFamily: F.label, fontSize: 12.5, textAlign: 'right', marginTop: 3, opacity: 0.9 },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 3 },
  busyText: { marginTop: 0, flexShrink: 1 },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: BLUE, borderColor: BLUE },
  checkMark: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: F.bodyHeavy },
  box: { opacity: 0.5, fontFamily: F.label, fontSize: 15 }, // a placeholder, not typed text
});
