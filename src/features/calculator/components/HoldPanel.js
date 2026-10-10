// Modal shown when a calculation is held: result, step-by-step workings
// (AI, signed-in users only), and Pin / Copy / Duplicate / Export actions.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CopyIcon, CsvIcon, DuplicateIcon, ExportIcon, MarkdownIcon, PinIcon, TextIcon } from '@/components/Icons';
import { useAuth } from '@/features/auth/AuthContext';
import { stepsFromPlan } from '@/features/calculator/math/aiSteps';
import { explainSteps } from '@/services/ai';
import { F } from '@/theme/fonts';
import { BLUE } from '@/theme/tokens';

function Step({ step, index, t }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 340, delay: 60 + index * 50, useNativeDriver: true }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{ gap: 2, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }}
    >
      <Text style={styles.stepLabel}>{step.label.toUpperCase()}</Text>
      <Text style={[styles.stepExpr, { color: t.panelInk }]}>{step.expr}</Text>
    </Animated.View>
  );
}

function Action({ label, color, dim, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.55 : dim ? 0.38 : 1 }]}>
      {children}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const EXPORT_FORMATS = [
  { key: 'csv', label: 'CSV', color: '#3d9c8b', Icon: CsvIcon },
  { key: 'text', label: 'Text', color: BLUE, Icon: TextIcon },
  { key: 'markdown', label: 'Markdown', color: '#727d8b', Icon: MarkdownIcon },
];

/** Row of export format buttons. */
export function ExportRow({ onExport }) {
  return (
    <View style={styles.exportRow}>
      {EXPORT_FORMATS.map(({ key, label, color, Icon }) => (
        <Pressable key={key} onPress={() => onExport(key)} style={({ pressed }) => [styles.exportBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Icon color={color} />
          <Text style={[styles.exportText, { color }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Steps are shown when there is more than one operation to explain,
// or hard arithmetic such as 489×73 or 7488÷24. "5+3" just shows its result.
const needsSteps = (expr) =>
  (expr.match(/[+−×÷^!²³⁻√∛(]/g) || []).length >= 2 || /\d{2,}[×÷]\d{2,}/.test(expr);

/**
 * Loads the steps when the panel opens: the AI plans the order and writes the
 * notes, aiSteps computes and checks every value. A plan that fails the check
 * is never shown.
 * status: 'simple' | 'guest' | 'loading' | 'done' | 'rejected' | 'error'
 */
function useSteps(it, signedIn) {
  const wanted = needsSteps(it.expr);
  const [state, setState] = useState({ status: 'loading', steps: null, error: '' });

  const load = useCallback(
    async (retry = false) => {
      setState({ status: 'loading', steps: null, error: '' });
      try {
        const plan = await explainSteps(it.expr, it.angle, { retry });
        const steps = stepsFromPlan(it.expr, it.result, it.angle, plan);
        setState(steps ? { status: 'done', steps, error: '' } : { status: 'rejected', steps: null, error: 'Couldn’t explain this one' });
      } catch (e) {
        setState({ status: 'error', steps: null, error: e.message });
      }
    },
    [it.expr, it.result, it.angle],
  );

  useEffect(() => {
    if (wanted && signedIn) load();
  }, [wanted, signedIn, load]);

  if (!wanted) return [{ status: 'simple' }, load];
  if (!signedIn) return [{ status: 'guest' }, load];
  return [state, load];
}

function StepsStatus({ state, onRetry }) {
  if (state.status === 'loading') {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={BLUE} />
        <Text style={styles.statusText}>Working out the steps…</Text>
      </View>
    );
  }
  if (state.status === 'guest') {
    return (
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>Sign in to see steps</Text>
      </View>
    );
  }
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusText}>{state.error}</Text>
      {/* a rejected plan is cached: retrying asks the model for a different one */}
      <Pressable onPress={() => onRetry(state.status === 'rejected')} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.55 }}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}

function PanelBody({ it, t, onPin, onCopy, onDuplicate, onExport }) {
  const { user } = useAuth();
  const [exportOpen, setExportOpen] = useState(false);
  const [anim] = useState(() => new Animated.Value(0));
  const [state, load] = useSteps(it, !!user);

  // prototype calqPanel: scale up from .9 with a slight overshoot
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [anim]);

  const pinColor = it.pinned ? BLUE : t.panelAction;

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          backgroundColor: t.panelBg,
          opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {/* Inner Pressable swallows taps so they don't close the panel */}
      <Pressable onPress={() => {}}>
        <View style={styles.head}>
          <Text style={[styles.expr, { color: t.panelInk }]}>{it.expr}</Text>
          <Text style={[styles.res, { color: t.panelInk }]}>= {it.result}</Text>
          <Text style={styles.angle}>{it.angle === 'deg' ? 'DEGREES' : 'RADIANS'}</Text>
        </View>
        {state.status !== 'simple' && <View style={[styles.rule, { borderTopColor: t.displayRule }]} />}
        {state.status === 'done' ? (
          <ScrollView style={styles.stepsScroll} contentContainerStyle={styles.steps}>
            {state.steps.map((s, i) => (
              <Step key={i} step={s} index={i} t={t} />
            ))}
          </ScrollView>
        ) : (
          state.status !== 'simple' && <StepsStatus state={state} onRetry={load} />
        )}
        <View style={styles.sep} />
        <View style={styles.actions}>
          <Action label={it.pinned ? 'Pinned' : 'Pin'} color={pinColor} dim={exportOpen} onPress={onPin}>
            <PinIcon color={pinColor} filled={it.pinned} />
          </Action>
          <Action label="Copy" color={t.panelAction} dim={exportOpen} onPress={onCopy}>
            <CopyIcon color={t.panelAction} />
          </Action>
          <Action label="Duplicate" color={t.panelAction} dim={exportOpen} onPress={onDuplicate}>
            <DuplicateIcon color={t.panelAction} />
          </Action>
          <Action label="Export" color={exportOpen ? BLUE : t.panelAction} onPress={() => setExportOpen((o) => !o)}>
            <ExportIcon color={exportOpen ? BLUE : t.panelAction} />
          </Action>
        </View>
        {exportOpen && (
          <View style={styles.exportWrap}>
            <ExportRow onExport={onExport} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * @param {object} p
 * @param {object|null} p.item     held calculation (kept while the modal fades out)
 * @param {boolean} p.visible
 * @param {number} p.session       changes on every open, so the body starts fresh
 */
export default function HoldPanel({ item, visible, session, t, onClose, ...actions }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {item && <PanelBody key={session} it={item} t={t} {...actions} />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(14,24,34,.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    paddingTop: 15,
    paddingHorizontal: 16,
    paddingBottom: 13,
    shadowColor: 'rgb(5,14,24)',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 26 },
    elevation: 24,
  },
  head: { alignItems: 'flex-end', gap: 2 },
  expr: { fontFamily: F.mono, fontSize: 12.5, opacity: 0.55, textAlign: 'right' },
  res: { fontFamily: F.monoBold, fontSize: 23, letterSpacing: -0.4, textAlign: 'right' },
  angle: { fontFamily: F.labelBold, fontSize: 9.5, letterSpacing: 0.6, color: '#93958f' },
  rule: { height: 0, borderTopWidth: 1, marginVertical: 12 },
  stepsScroll: { maxHeight: 320, flexGrow: 0 },
  steps: { gap: 9 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  statusText: { fontFamily: F.label, fontSize: 12, color: '#93958f', flexShrink: 1 },
  retry: { fontFamily: F.labelBold, fontSize: 12, color: BLUE },
  stepLabel: { fontFamily: F.labelBold, fontSize: 10.5, letterSpacing: 0.5, color: BLUE },
  stepExpr: { fontFamily: F.mono, fontSize: 13 },
  sep: { height: 1, backgroundColor: 'rgba(29,38,48,.1)', marginTop: 13, marginBottom: 11 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  action: { alignItems: 'center', gap: 4, width: 64 },
  actionText: { fontFamily: F.label, fontSize: 10 },
  exportWrap: { marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: 'rgba(29,38,48,.1)' },
  exportRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  exportBtn: { alignItems: 'center', gap: 4, width: 70 },
  exportText: { fontFamily: F.labelBold, fontSize: 10 },
});
