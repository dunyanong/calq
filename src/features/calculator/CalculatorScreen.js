// Calculator screen (prototype "Scientific Calculator").
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import CalcHeader from './components/CalcHeader';
import DisplayPanel from './components/DisplayPanel';
import Keypad from './components/Keypad';
import HoldPanel from './components/HoldPanel';
import ScanSheet from '@/features/scan/ScanSheet';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { useHistory } from '@/features/history/HistoryContext';
import { shareExport } from '@/features/history/exportHistory';
import { closeParens, evaluate, freezeRandom } from './math/engine';
import { asOperand, formatNumber } from './math/format';
import { deleteLast, resolveKey } from './math/keys';

const MAX_ENTRY = 120; // Firestore rule allows 200; keep the display readable
const HIDDEN_PAD = 54; // keypad height when collapsed to its handle
const DISPLAY_SHARE = 0.47; // display height / body height (330px of ~700 in the prototype)

export default function Calculator() {
  const { theme: t, angle, output, update } = useSettings();
  const history = useHistory();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [entry, setEntry] = useState('');
  const [mode, setMode] = useState(null); // 'shift' | 'alpha' | 'hyp' | null
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const [pinFilter, setPinFilter] = useState(false);
  // held calculation panel; session remounts the panel body on each open
  const [held, setHeld] = useState({ id: null, open: false, session: 0 });
  const [scan, setScan] = useState({ open: false, session: 0 });
  const [kbHidden, setKbHidden] = useState(false);
  const [bodyH, setBodyH] = useState(0);
  const [displayH] = useState(() => new Animated.Value(0));
  const laidOut = useRef(false);

  const pinned = history.items.filter((it) => it.pinned);
  const filterOn = pinFilter && pinned.length > 0; // off again once nothing is pinned
  const shown = filterOn ? pinned : history.items;
  const heldItem = history.items.find((it) => it.id === held.id) || null;
  const lastItem = history.items[history.items.length - 1];

  // Display grows when the keypad is hidden (prototype dispH transition).
  useEffect(() => {
    if (!bodyH) return;
    const target = kbHidden ? bodyH - HIDDEN_PAD - insets.bottom : Math.round(bodyH * DISPLAY_SHARE);
    if (!laidOut.current) {
      // first layout: no animation
      laidOut.current = true;
      displayH.setValue(target);
      return;
    }
    Animated.timing(displayH, { toValue: target, duration: 340, useNativeDriver: false }).start();
  }, [kbHidden, bodyH, displayH, insets.bottom]);

  const insert = (text) => {
    setEntry((e) => (e + text).slice(0, MAX_ENTRY));
    setMode(null);
  };

  const submit = () => {
    const raw = entry.trim();
    if (!raw) return;
    const expr = freezeRandom(closeParens(raw), angle);
    const v = evaluate(expr, angle);
    if (v === null) {
      toast('Check the expression');
      return;
    }
    history.add({ expr, result: formatNumber(v, output), angle });
    setEntry('');
    setAns(v);
    setMode(null);
  };

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
    toast('Result copied');
  };

  const addToMemory = (sign) => {
    const v = entry.trim() ? evaluate(entry, angle) : ans;
    if (v === null) {
      toast('Check the expression');
      return;
    }
    const next = memory + sign * v;
    setMemory(next);
    toast('M = ' + formatNumber(next, output));
  };

  const ACTIONS = {
    del: () => setEntry((e) => deleteLast(e)),
    clear: () => setEntry(''),
    equals: submit,
    ans: () => insert(asOperand(ans)),
    ran: () => insert(Math.random().toFixed(3)),
    copy: () => (lastItem ? copy(lastItem.result) : toast('Nothing to copy yet')),
    history: () => router.navigate('/history'),
    hyp: () => setMode((m) => (m === 'hyp' ? null : 'hyp')),
    rcl: () => insert(asOperand(memory)),
    mplus: () => addToMemory(1),
    mminus: () => addToMemory(-1),
    sd: () => {
      const next = output === 'dec' ? 'frac' : 'dec';
      update({ output: next });
      toast(next === 'frac' ? 'Fraction output' : 'Decimal output');
    },
  };

  const onKey = (key) => {
    const { face, act } = resolveKey(key, mode);
    if (act.alphaVar) {
      toast('Variables (A–Z) coming soon');
    } else if (act.soon) {
      toast(face + ' — coming soon');
    } else if (act.token !== undefined) {
      insert(act.token);
      return;
    } else if (ACTIONS[act.action]) {
      ACTIONS[act.action]();
      if (act.action === 'hyp') return; // hyp toggles its own mode
    }
    setMode(null);
  };

  const openHold = (id) => setHeld((h) => ({ id, open: true, session: h.session + 1 }));
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
      />
      <View style={styles.body} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
        <DisplayPanel
          items={shown}
          entry={entry}
          pinFilter={filterOn}
          onShowAll={() => setPinFilter(false)}
          heldId={held.open ? held.id : null}
          onHold={openHold}
          height={displayH}
          t={t}
        />
        <Keypad
          mode={mode}
          onKey={onKey}
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
          setEntry(expr.slice(0, MAX_ENTRY)); // a scan is a whole calculation: replace the entry
          setMode(null);
          closeScan();
        }}
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
          shareExport([item], format).catch((e) => toast(e.message || 'Export failed'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, minHeight: 0, gap: 5 },
});
