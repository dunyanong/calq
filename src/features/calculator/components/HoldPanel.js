// Modal shown when a calculation is held: result, step-by-step workings on request
// (the AI button, when AI is on), and Pin / Copy / Duplicate / Select / Export actions.
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { angleMode } from '@/components/AngleBadge';
import { Skeleton, SkeletonGroup } from '@/components/Loader';
import Popup from '@/components/Popup';
import { CopyIcon, DuplicateIcon, ExportIcon, PinIcon, SelectIcon, SparkleIcon } from '@/components/Icons';
import useAiOn from '@/features/ai/useAiOn';
import { needsSteps, stepsFromPlan } from '@/features/calculator/math/aiSteps';
import ExportRow from '@/features/export/ExportRow';
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

/**
 * Loads the steps when the AI button is tapped: the AI plans the order and writes
 * the notes, aiSteps computes and checks every value. A plan that fails the check
 * is never shown.
 * status: 'none' (AI off, or nothing to explain) | 'idle' | 'loading' | 'done' | 'rejected' | 'error'
 */
function useSteps(it, aiOn) {
  const wanted = needsSteps(it.expr);
  const [state, setState] = useState({ status: 'idle', steps: null, error: '' });

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

  if (!wanted || !aiOn) return [{ status: 'none' }, load];
  return [state, load];
}

// Placeholder steps in the shape of Step, so the panel does not jump when they arrive.
const SKELETON_WIDTHS = ['72%', '58%', '84%'];

function StepsSkeleton({ t }) {
  return (
    <View style={styles.steps}>
      <SkeletonGroup style={styles.steps}>
        {SKELETON_WIDTHS.map((w, i) => (
          <View key={i} style={styles.skeletonStep}>
            <Skeleton width={i === 1 ? 44 : 60} height={8} color={t.selBg} />
            <Skeleton width={w} height={12} color={t.displayRule} />
          </View>
        ))}
      </SkeletonGroup>
      <Text style={[styles.statusText, styles.caption]} accessibilityLiveRegion="polite">
        Working out the steps…
      </Text>
    </View>
  );
}

function StepsStatus({ state, t, onRetry }) {
  if (state.status === 'loading') return <StepsSkeleton t={t} />;
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

/** ✦ AI, top left of the panel: asks for the workings. */
function AiButton({ t, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="AI explanation"
      style={({ pressed }) => [styles.aiBtn, { backgroundColor: t.selBg, opacity: pressed ? 0.6 : 1 }]}
    >
      <SparkleIcon color={BLUE} size={11} />
      <Text style={styles.aiText}>AI</Text>
    </Pressable>
  );
}

function PanelBody({ it, t, onPin, onCopy, onDuplicate, onSelect, onExport }) {
  const aiOn = useAiOn();
  const [exportOpen, setExportOpen] = useState(false);
  const [state, load] = useSteps(it, aiOn);
  const shown = state.status !== 'none' && state.status !== 'idle'; // the steps area under the result

  const pinColor = it.pinned ? BLUE : t.panelAction;

  return (
    <>
      <View style={styles.top}>
        <View style={styles.aiSlot}>{state.status === 'idle' && <AiButton t={t} onPress={() => load()} />}</View>
        <View style={styles.head}>
          <Text style={[styles.expr, { color: t.panelInk }]}>{it.expr}</Text>
          <Text style={[styles.res, { color: t.panelInk }]}>= {it.result}</Text>
          <Text style={styles.angle}>{angleMode(it.angle).long}</Text>
        </View>
      </View>
      {shown && <View style={[styles.rule, { borderTopColor: t.displayRule }]} />}
      {state.status === 'done' ? (
        <ScrollView style={styles.stepsScroll} contentContainerStyle={styles.steps}>
          {state.steps.map((s, i) => (
            <Step key={i} step={s} index={i} t={t} />
          ))}
        </ScrollView>
      ) : (
        shown && <StepsStatus state={state} t={t} onRetry={load} />
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
        <Action label="Select" color={t.panelAction} dim={exportOpen} onPress={onSelect}>
          <SelectIcon color={t.panelAction} />
        </Action>
        <Action label="Export" color={exportOpen ? BLUE : t.panelAction} onPress={() => setExportOpen((o) => !o)}>
          <ExportIcon color={exportOpen ? BLUE : t.panelAction} />
        </Action>
      </View>
      {exportOpen && (
        <View style={styles.exportWrap}>
          <ExportRow onExport={onExport} t={t} />
        </View>
      )}
    </>
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
    <Popup visible={visible} session={session} t={t} onClose={onClose} style={styles.panel}>
      {item && <PanelBody it={item} t={t} {...actions} />}
    </Popup>
  );
}

const styles = StyleSheet.create({
  panel: { paddingTop: 15, paddingHorizontal: 16, paddingBottom: 13 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiSlot: { minWidth: 0 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 },
  aiText: { fontFamily: F.labelBold, fontSize: 11.5, color: BLUE, letterSpacing: 0.4 },
  head: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 2 },
  expr: { fontFamily: F.mono, fontSize: 12.5, opacity: 0.55, textAlign: 'right' },
  res: { fontFamily: F.monoBold, fontSize: 23, letterSpacing: -0.4, textAlign: 'right' },
  angle: { fontFamily: F.labelBold, fontSize: 9.5, letterSpacing: 0.6, color: '#93958f' },
  rule: { height: 0, borderTopWidth: 1, marginVertical: 12 },
  stepsScroll: { maxHeight: 320, flexGrow: 0 },
  steps: { gap: 9 },
  skeletonStep: { gap: 6, paddingVertical: 2 },
  caption: { textAlign: 'center', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  statusText: { fontFamily: F.label, fontSize: 12, color: '#93958f', flexShrink: 1 },
  retry: { fontFamily: F.labelBold, fontSize: 12, color: BLUE },
  stepLabel: { fontFamily: F.labelBold, fontSize: 10.5, letterSpacing: 0.5, color: BLUE },
  stepExpr: { fontFamily: F.mono, fontSize: 13 },
  sep: { height: 1, backgroundColor: 'rgba(29,38,48,.1)', marginTop: 13, marginBottom: 11 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  action: { alignItems: 'center', gap: 4, width: 56 }, // five fit the 308px panel
  actionText: { fontFamily: F.label, fontSize: 10 },
  exportWrap: { marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: 'rgba(29,38,48,.1)' },
});
