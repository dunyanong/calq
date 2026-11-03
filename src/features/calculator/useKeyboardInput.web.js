// Web: the computer keyboard and Ctrl+V type into the calculator while its
// screen is showing. Text boxes (the scan sheet) keep their own typing, and
// shortcuts such as Ctrl+C are left to the browser.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// Keys that are calculator actions rather than characters.
const ACTION_KEYS = { Enter: 'equals', '=': 'equals', Backspace: 'del', Escape: 'clear' };
const CURSOR_KEYS = { ArrowLeft: [-1, false], ArrowRight: [1, false], Home: [-1, true], End: [1, true] };

const typingElsewhere = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * @param {object} p
 * @param {boolean} p.enabled            false while a panel is open over the calculator
 * @param {(ch: string) => boolean} p.onChar     a typed character; true if it was used
 * @param {(action: string) => void} p.onAction  'equals' | 'del' | 'clear'
 * @param {(dir: -1|1, jump: boolean) => void} p.onCursor
 * @param {(text: string) => void} p.onPaste
 */
export default function useKeyboardInput(handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useFocusEffect(
    useCallback(() => {
      const onKeyDown = (e) => {
        const h = latest.current;
        if (!h.enabled || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingElsewhere(e.target)) return;
        if (ACTION_KEYS[e.key]) {
          // Enter on a focused button presses that button instead
          if (e.key === 'Enter' && e.target?.closest?.('[role="button"],button')) return;
          e.preventDefault();
          h.onAction(ACTION_KEYS[e.key]);
        } else if (CURSOR_KEYS[e.key]) {
          e.preventDefault();
          h.onCursor(...CURSOR_KEYS[e.key]);
        } else if (e.key.length === 1 && h.onChar(e.key)) {
          e.preventDefault();
        }
      };
      const onPaste = (e) => {
        const h = latest.current;
        if (!h.enabled || typingElsewhere(e.target)) return;
        const text = e.clipboardData?.getData('text');
        if (!text) return;
        e.preventDefault();
        h.onPaste(text);
      };
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('paste', onPaste);
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('paste', onPaste);
      };
    }, []),
  );
}
