// Calculator screen: header, display, keypad, and the scan / angle / hold modals.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CalcHeader from './components/CalcHeader';
import DisplayPanel from './components/DisplayPanel';
import Keypad from './components/Keypad';
import HoldPanel from './components/HoldPanel';
import AnglePicker from './components/AnglePicker';
import { tick } from './components/KeyButton';
import ScanSheet from '@/features/scan/ScanSheet';
import { angleMode } from '@/components/AngleBadge';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { DEFAULT_SETTINGS } from '@/features/settings/settingsStore';
import { useHistory } from '@/features/history/HistoryContext';
import { useExport } from '@/features/export/ExportContext';
import { integrateFormula } from '@/services/ai';
import { closeParens, evaluate, freezeRandom, hasCalculus, hasTrig } from './math/engine';
import { BOX, boxHint, closeBox, completeEntry, deleteBefore, freezeVars, insertAt, moveCursor as move, templateText } from './math/entry';
import { formatNumber, operandIn } from './math/format';
import { VARIABLES, isLetterMode, resolveKey } from './math/keys';
import { findAntiderivative, indefiniteIntegrand, symbolicDerivative } from './math/symbolic';

const MAX_ENTRY = 120; // Firestore rule allows 200; keep the display readable
const MAX_SAVED = 200; // Firestore rule for history expressions and results (a formula can be long)
const MAX_CARDS = 100; // past calculations on the display; History has them all
const HIDDEN_PAD = 54; // keypad height when collapsed to its handle
const DISPLAY_SHARE = 0.47; // display height / body height (about 330px of 700)
const KEYPAD_MIN = 360; // the 5-row numeric page needs this much (plus the safe area) on small phones
// The live "= …" preview is shown once the entry has something to work out
// (an operator, a function, or one of the variables A–D, F, M).
const WORTH_PREVIEW = /[+−×÷^!²³⁻√∛(%EABCDFM]/;
// Actions that switch on a mode of their own (the key must not switch it off again).
const MODE_ACTIONS = new Set(['hyp', 'rcl', 'sto']);

export default function Calculator() {
  const { theme: t, angle, output, ans, vars, sessionStart, update } = useSettings();
  const history = useHistory();
  const { user } = useAuth();
  const toast = useToast();
  const exporter = useExport();
  const router = useRouter();
  const { recall } = useLocalSearchParams(); // a calculation picked on the History screen
  const insets = useSafeAreaInsets();

  const [entry, setEntry] = useState({ text: '', at: 0 }); // at: cursor position in text
  const [shake, setShake] = useState(0); // bumped on a bad expression
  const [busy, setBusy] = useState(false); // waiting for the AI's ∫ formula
  const [mode, setMode] = useState(null); // 'shift' | 'alpha' | 'sto' | 'rcl' | 'hyp' | null
  const [pinFilter, setPinFilter] = useState(false);
  // held calculation panel; session remounts the panel body on each open
  const [held, setHeld] = useState({ id: null, open: false, session: 0 });
  const [scan, setScan] = useState({ open: false, session: 0 });
  const [anglePicker, setAnglePicker] = useState({ open: false, session: 0 });
  const [kbHidden, setKbHidden] = useState(false);
  const [bodyH, setBodyH] = useState(0);
  const [displayH] = useState(() => new Animated.Value(0));
  const laidOut = useRef(false);

  const pinned = history.items.filter((it) => it.pinned);
  const filterOn = pinFilter && pinned.length > 0; // off again once nothing is pinned
  // since the last New session (+); pinned ones stay reachable through the pin pill
  const sessionItems = history.items.filter((it) => it.createdAt > sessionStart);
  const shown = (filterOn ? pinned : sessionItems).slice(-MAX_CARDS);
  const heldItem = history.items.find((it) => it.id === held.id) || null;
  const lastItem = sessionItems[sessionItems.length - 1];

  // Display grows when the keypad is hidden.
  useEffect(() => {
    if (!bodyH) return;
    const target = kbHidden
      ? bodyH - HIDDEN_PAD - insets.bottom
      : Math.min(Math.round(bodyH * DISPLAY_SHARE), bodyH - KEYPAD_MIN - insets.bottom);
    if (!laidOut.current) {
      // first layout: no animation
      laidOut.current = true;
      displayH.setValue(target);
      return;
    }
    Animated.timing(displayH, { toValue: target, duration: 340, useNativeDriver: false }).start();
  }, [kbHidden, bodyH, displayH, insets.bottom]);

  /** Types at the cursor (into the box under it, see math/entry.js); a full entry ignores the key. */
  const insert = (s) => {
    setEntry((e) => insertAt(e, s, MAX_ENTRY) || e);
    setMode(null);
  };

  /** Ans, RCL and Rand: the value goes in at the cursor without merging with a digit next to it. */
  const insertValue = (v) => {
    setEntry((e) => {
      const end = e.text[e.at] === BOX ? e.at + 1 : e.at; // typing into a box replaces it
      return insertAt(e, operandIn(e.text, e.at, end, v), MAX_ENTRY) || e;
    });
    setMode(null);
  };

  /** Puts a past calculation back in the entry to edit and work out again. */
  const recallItem = useCallback((item) => {
    setEntry({ text: item.expr, at: item.expr.length });
    setMode(null);
  }, []);

  // Tapping a row on the History screen comes back here with ?recall=<id>.
  useEffect(() => {
    if (!recall) return;
    const item = history.items.find((it) => it.id === recall);
    if (item) recallItem(item);
    router.setParams({ recall: undefined });
  }, [recall, history.items, recallItem, router]);

  /** ◀ ▶ move one key press ("sin(" at once, hopping over boxes); a long press jumps to the start / end. */
  const moveCursor = (dir, jump) => setEntry((e) => move(e, dir, jump));

  const fail = (message) => {
    tick('error');
    setShake((n) => n + 1);
    toast(message);
  };

  // Value of the entry so far, shown dimmed under it. ∫, d/dx, Σ and Π are
  // skipped: they can take a moment and the preview runs on every key press.
  const preview = useMemo(() => {
    const s = entry.text;
    if (!WORTH_PREVIEW.test(s) || hasCalculus(s) || s.includes('RanInt')) return null;
    const v = evaluate(freezeVars(s, vars), angle);
    return v === null ? null : formatNumber(v, output);
  }, [entry.text, vars, angle, output]);

  /** Saves a result and clears the entry. value: the number for Ans (a formula leaves Ans alone). */
  const addResult = (expr, result, value) => {
    if (result.length > MAX_SAVED) {
      fail('That formula is too long to show');
      return;
    }
    tick('impact');
    history.add({ expr, result, angle });
    // a Casio does this too, but textbooks assume radians
    if (angle !== 'rad' && hasCalculus(expr) && hasTrig(expr)) {
      toast(`Trig in ∫/d/dx uses ${angleMode(angle).label.toLowerCase()} — switch to Radians for textbook answers`);
    }
    setEntry({ text: '', at: 0 });
    if (value !== undefined) update({ ans: value });
    setMode(null);
  };

  /** ∫ without limits: the AI proposes F, math/symbolic.js checks F′ = f before it is shown. */
  const solveIntegral = async (expr, f) => {
    if (!user) {
      fail('Sign in to get a formula for ∫ without limits');
      return;
    }
    setBusy(true);
    try {
      const res = await findAntiderivative(f, angle, (opts) => integrateFormula(f, angle, opts));
      if (res.error) fail(res.error);
      else addResult(expr, res.text);
    } catch (e) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!entry.text.trim()) return;
    // = inside a box closes it first, like ▶ (d/dx(sin(x|,□) -> d/dx(sin(x),□)).
    // Variables are saved as their values, so history and its steps stay right when they change.
    const done = completeEntry(freezeVars(closeBox(entry).text.trim(), vars)); // empty limits / point mean "a formula, please"
    if (done.error) {
      fail(done.error);
      return;
    }
    const expr = freezeRandom(closeParens(done.expr), angle);
    if (expr.length > MAX_SAVED) {
      fail('Too long to save');
      return;
    }

    const integral = indefiniteIntegrand(expr, angle);
    if (integral) {
      if (integral.error) fail(integral.error);
      else solveIntegral(expr, integral.f);
      return;
    }
    const formula = symbolicDerivative(expr, angle);
    if (formula?.error) {
      fail(formula.error);
      return;
    }
    if (formula?.text) {
      addResult(expr, formula.text);
      return;
    }
    const v = formula ? formula.value : evaluate(expr, angle);
    if (v === null) {
      fail(expr.includes('x') && !hasCalculus(expr) ? 'Use x inside ∫, d/dx, Σ or Π' : 'Check the expression');
      return;
    }
    addResult(expr, formatNumber(v, output), v);
  };

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
    toast('Result copied');
  };

  /** Value of the entry (Ans when it is empty) for M+, M− and STO; null after showing the error. */
  const entryValue = () => {
    if (!entry.text.trim()) return ans;
    const v = evaluate(freezeRandom(freezeVars(entry.text, vars), angle), angle);
    if (v === null) fail('Check the expression');
    return v;
  };

  /** Stores a value in a variable (STO, M+, M−). */
  const setVar = (name, v) => {
    update({ vars: { ...vars, [name]: v } });
    toast(name + ' = ' + formatNumber(v, output));
  };

  /** M+ / M− add the entry (or Ans) to M. */
  const addToM = (sign) => {
    const v = entryValue();
    if (v !== null) setVar('M', vars.M + sign * v);
  };

  /** STO then a letter: the entry (or Ans) goes into that variable. */
  const store = (name) => {
    const v = entryValue();
    if (v !== null) setVar(name, v);
  };

  const openAnglePicker = () => setAnglePicker((p) => ({ open: true, session: p.session + 1 }));
  const closeAnglePicker = () => setAnglePicker((p) => ({ ...p, open: false }));
  /** OK in the angle picker. */
  const chooseAngle = (unit) => {
    closeAnglePicker();
    if (unit === angle) return;
    update({ angle: unit });
    toast(angleMode(unit).label);
  };

  const ACTIONS = {
    del: () => setEntry(deleteBefore),
    clear: () => setEntry({ text: '', at: 0 }),
    equals: submit,
    ans: () => insertValue(ans),
    ran: () => insertValue(Number(Math.random().toFixed(3))),
    copy: () => (lastItem ? copy(lastItem.result) : toast('Nothing to copy yet')),
    history: () => router.navigate('/history'),
    hyp: () => setMode((m) => (m === 'hyp' ? null : 'hyp')),
    rcl: () => setMode('rcl'), // then a letter inserts its value
    sto: () => setMode('sto'), // then a letter stores the entry in it
    mplus: () => addToM(1),
    mminus: () => addToM(-1),
    sd: () => {
      const next = output === 'dec' ? 'frac' : 'dec';
      update({ output: next });
      toast(next === 'frac' ? 'Fraction output' : 'Decimal output');
    },
  };

  const onKey = (key) => {
    if (busy) return; // the ∫ formula is on its way and will clear the entry
    const { act } = resolveKey(key, mode, output);
    if (act.variable) {
      if (mode === 'sto') store(act.variable);
      else if (mode === 'rcl') insertValue(vars[act.variable]);
      else insert(act.variable); // ALPHA: the letter itself, worked out at =
    } else if (act.token !== undefined) {
      insert(act.template ? templateText(act.token) : act.token);
      return;
    } else if (ACTIONS[act.action]) {
      ACTIONS[act.action]();
      if (MODE_ACTIONS.has(act.action)) return;
    }
    // act.cancel: a key without a letter in ALPHA / STO / RCL just leaves the mode
    setMode(null);
  };

  // While the next key picks a variable, the line under the entry lists their values.
  const varsHint = isLetterMode(mode) ? VARIABLES.map((n) => n + '=' + formatNumber(vars[n], output)).join('  ') : null;

  /** + (top right): a clean screen. Earlier calculations stay in Recent; Ans and the variables go back to 0. */
  const newSession = () => {
    const before = { ans, vars, sessionStart };
    const typed = entry;
    update({ ans: DEFAULT_SETTINGS.ans, vars: DEFAULT_SETTINGS.vars, sessionStart: Date.now() });
    setEntry({ text: '', at: 0 });
    setMode(null);
    setPinFilter(false);
    const undo = () => {
      update(before);
      setEntry(typed);
    };
    toast('New session · history is in Recent', { action: { label: 'Undo', onPress: undo } });
  };

  const openHold = useCallback((id) => setHeld((h) => ({ id, open: true, session: h.session + 1 })), []);
  const closeHold = () => setHeld((h) => ({ ...h, open: false }));

  const openScan = () => {
    if (!user) {
      toast('Sign in from Settings to scan');
      return;
    }
    setScan((s) => ({ open: true, session: s.session + 1 }));
  };
  const closeScan = () => setScan((s) => ({ ...s, open: false }));

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <CalcHeader
        t={t}
        pinCount={pinned.length}
        pinFilter={filterOn}
        onPinPill={() => setPinFilter(!filterOn)}
        onNewSession={newSession}
      />
      <View style={styles.body} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
        <DisplayPanel
          items={shown}
          entry={entry.text}
          cursor={entry.at}
          preview={preview}
          hint={busy ? 'Finding a formula…' : varsHint || boxHint(entry)}
          busy={busy}
          shake={shake}
          angle={angle}
          onAnglePress={openAnglePicker}
          memory={vars.M !== 0}
          pinFilter={filterOn}
          onShowAll={() => setPinFilter(false)}
          heldId={held.open ? held.id : null}
          onHold={openHold}
          onRecall={recallItem}
          height={displayH}
          t={t}
        />
        <Keypad
          mode={mode}
          output={output}
          angle={angle}
          onAnglePress={openAnglePicker}
          onKey={onKey}
          onCursor={moveCursor}
          onToggleShift={() => setMode((m) => (m === 'shift' ? null : 'shift'))}
          onToggleAlpha={() => setMode((m) => (m === 'alpha' ? null : 'alpha'))}
          onScan={openScan}
          hidden={kbHidden}
          onHiddenChange={setKbHidden}
          bottomInset={insets.bottom}
        />
      </View>

      <ScanSheet
        visible={scan.open}
        session={scan.session}
        t={t}
        angle={angle}
        output={output}
        onClose={closeScan}
        onInsert={(expr) => {
          const text = expr.slice(0, MAX_ENTRY); // a scan is a whole calculation: replace the entry
          setEntry({ text, at: text.length });
          setMode(null);
          closeScan();
        }}
      />

      <AnglePicker
        visible={anglePicker.open}
        session={anglePicker.session}
        angle={angle}
        t={t}
        onClose={closeAnglePicker}
        onChoose={chooseAngle}
      />

      <HoldPanel
        item={heldItem}
        visible={held.open && !!heldItem}
        session={held.session}
        t={t}
        onClose={closeHold}
        onPin={() => {
          history.togglePin(heldItem.id);
          if (heldItem.pinned && pinned.length === 1) setPinFilter(false); // last pin removed
          toast(heldItem.pinned ? 'Unpinned' : 'Pinned');
          closeHold();
        }}
        onCopy={() => {
          copy(heldItem.result);
          closeHold();
        }}
        onDuplicate={() => {
          history.duplicate(heldItem);
          toast('Duplicated');
          closeHold();
        }}
        onExport={(format) => {
          const item = heldItem;
          closeHold();
          exporter.run([item], format); // AI notes / Drive per Settings and the export row
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, minHeight: 0, gap: 5 },
});
