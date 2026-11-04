// Web: the alert as a small dialog drawn in the page, in the toast's colours.
// Escape or a click outside picks the 'cancel' button, like Back on Android.
import { TOAST_BG } from '@/theme/tokens';

// Above react-native-web's Modal (zIndex 9999): an alert can be asked from inside a
// panel, e.g. the AI explanation question from the export panel.
const Z_INDEX = '100000';

const DANGER = '#ff8a80';
const ACCENT = '#7cbfe4'; // ACCENT_DARK

/** @param {{text: string, style?: 'cancel'|'destructive'|'default', onPress?: () => void}[]} [buttons] */
export function showAlert(title, message, buttons = [{ text: 'OK' }]) {
  const scrim = document.createElement('div');
  Object.assign(scrim.style, {
    position: 'fixed', inset: '0', zIndex: Z_INDEX, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', background: 'rgba(14,24,34,.55)',
  });
  const box = document.createElement('div');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  Object.assign(box.style, {
    background: TOAST_BG, color: '#fff', borderRadius: '18px', padding: '20px 20px 14px', maxWidth: '360px',
    width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,.35)', fontFamily: 'Nunito_600SemiBold, system-ui, sans-serif',
  });

  const h = document.createElement('div');
  h.id = 'calq-alert-title';
  h.textContent = title;
  Object.assign(h.style, { fontFamily: 'Nunito_800ExtraBold, system-ui, sans-serif', fontSize: '17px', marginBottom: '8px' });
  box.setAttribute('aria-labelledby', h.id);
  box.appendChild(h);
  if (message) {
    const p = document.createElement('div');
    p.textContent = message;
    Object.assign(p.style, { fontSize: '14px', lineHeight: '1.45', opacity: '.85', marginBottom: '14px' });
    box.appendChild(p);
  }

  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '4px' });
  box.appendChild(row);

  const close = (button) => {
    document.removeEventListener('keydown', onKey, true);
    scrim.remove();
    button?.onPress?.();
  };
  const cancel = buttons.find((b) => b.style === 'cancel');
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(cancel);
    }
  };

  let first = null;
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.text;
    Object.assign(el.style, {
      background: 'transparent', border: '0', borderRadius: '10px', padding: '9px 12px', cursor: 'pointer',
      fontSize: '14px', fontFamily: 'Nunito_800ExtraBold, system-ui, sans-serif',
      color: b.style === 'destructive' ? DANGER : b.style === 'cancel' ? 'rgba(255,255,255,.7)' : ACCENT,
    });
    el.onmouseenter = () => (el.style.background = 'rgba(255,255,255,.08)');
    el.onmouseleave = () => (el.style.background = 'transparent');
    el.onclick = () => close(b);
    row.appendChild(el);
    if (!first && b.style !== 'cancel') first = el;
  }

  scrim.onclick = (e) => e.target === scrim && close(cancel);
  document.addEventListener('keydown', onKey, true);
  scrim.appendChild(box);
  document.body.appendChild(scrim);
  (first || row.firstChild)?.focus();
}
