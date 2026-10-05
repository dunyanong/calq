// Cream display: past calculations (hold one to see workings) + entry line.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

function HistoryCard({ item, t, held, onHold }) {
  // prototype calqRow: fade + slide up when a card appears
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
        onLongPress={() => onHold(item.id)}
        delayLongPress={300}
        style={[
          styles.card,
          item.pinned && { backgroundColor: t.pinnedRowBg },
          held && { borderColor: BLUE },
        ]}
      >
        <Text style={[styles.expr, { color: t.displayInk }]}>{item.expr}</Text>
        <Text style={[styles.res, { color: t.displayInk }]}>= {item.result}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * @param {object} p
 * @param {Array} p.items          calculations to show (oldest first)
 * @param {string} p.entry         current input
 * @param {boolean} p.pinFilter    showing pinned only
 * @param {Animated.Value|number} p.height
 */
export default function DisplayPanel({ items, entry, pinFilter, onShowAll, heldId, onHold, height, t }) {
  const scroller = useRef(null);
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
            <HistoryCard item={item} t={t} held={item.id === heldId} onHold={onHold} />
          </View>
        ))}
        {items.length > 0 && <View style={[styles.rule, { borderTopColor: t.displayRule }]} />}
        <View style={styles.entryRow}>
          <Text style={[styles.entry, { color: t.displayInk }]}>{entry || '0'}</Text>
          <View style={[styles.caret, { backgroundColor: t.displayInk, opacity: entry ? 1 : 0.35 }]} />
        </View>
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
  expr: { fontFamily: F.mono, fontSize: 12.5, opacity: 0.55, textAlign: 'right' },
  res: { fontFamily: F.monoBold, fontSize: 16 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 22 },
  entry: { fontFamily: F.monoBold, fontSize: 18, textAlign: 'right', flexShrink: 1 },
  caret: { width: 2, height: 19 },
});
