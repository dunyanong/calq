// Colour tokens copied from the prototype.
// Light/dark app tokens come from "CalcMaster Menu"; calculator display and
// keypad colours come from "Scientific Calculator".

const ACCENT_LIGHT = '#2a7093';
export const ACCENT_DARK = '#7cbfe4';

export const light = {
  dark: false,
  bg: '#faf8f3',
  header: '#a8cfe0',
  headerText: '#12435c',
  headerInk: '#0d2c44', // hamburger + logo on the calculator header
  text: '#1f2c33',
  sub: '#93958f',
  divider: '#e9e5db',
  accent: ACCENT_LIGHT,
  accentText: ACCENT_LIGHT,
  drawerBg: '#fffefb',
  card: '#fffefb',
  switchTrack: '#d5d2c8',
  selBg: 'rgba(43,127,196,.12)',
  navActiveBg: 'rgba(43,127,196,.12)',
  // calculator display
  displayBg: '#f8f5ef',
  displayInk: '#1d2630',
  displayRule: 'rgba(122,108,90,.22)',
  displayBorder: 'rgba(18,67,92,.1)',
  pinnedRowBg: 'rgba(55,138,221,.08)',
  // hold panel
  panelBg: '#FAF7F1',
  panelInk: '#1d2630',
  panelAction: '#3c4551',
  // angle-mode badge: ink for text + outline, bg is the same colour at ~13%
  angleRad: '#4338CA',
  angleRadBg: 'rgba(67,56,202,.13)',
  angleDeg: '#047857',
  angleDegBg: 'rgba(4,120,87,.13)',
};

export const dark = {
  dark: true,
  bg: '#2d3748',
  header: '#232c3b',
  headerText: '#dfe7f2',
  headerInk: '#dfe7f2',
  text: '#eaf0f8',
  sub: '#bac7da',
  divider: '#414d63',
  accent: ACCENT_DARK,
  accentText: 'rgb(190,223,242)',
  drawerBg: '#333e52',
  card: '#354052',
  switchTrack: ACCENT_DARK,
  selBg: 'rgba(55,138,221,.20)',
  navActiveBg: 'rgba(108,182,230,.16)',
  displayBg: '#2d3748',
  displayInk: '#eaf0f8',
  displayRule: 'rgba(186,199,218,.22)',
  displayBorder: 'rgba(0,0,0,.25)',
  pinnedRowBg: 'rgba(55,138,221,.18)',
  panelBg: '#3a465b',
  panelInk: '#eaf0f8',
  panelAction: '#cfd8e4',
  angleRad: '#C084FC',
  angleRadBg: 'rgba(192,132,252,.14)',
  angleDeg: '#2DD4BF',
  angleDegBg: 'rgba(45,212,191,.14)',
};

// Keypad colours are the same in both themes (the keypad is always dark).
// One grey family plus the app's sky-blue accent (=, SHIFT, DEL/AC text);
// digits are the lightest grey, functions the darkest.
export const pad = {
  bg: '#1e2228',
  handle: '#4c5563',
  num: { bg: '#3b4450', ink: '#f2f6f9' },
  op: { bg: '#333b45', ink: '#ffffff' },
  fn: { bg: '#2a3039', ink: '#cdd6df' },
  del: { bg: '#333b45', ink: ACCENT_DARK },
  eq: { bg: ACCENT_DARK, ink: '#12283d' },
  shiftOn: { bg: '#24384a', ink: '#cfe9f8' },
  alphaOn: { bg: '#353c46', ink: '#e6ebf0' },
  hypOn: { bg: '#353c46', ink: '#e6ebf0' },
  shiftLabel: ACCENT_DARK,
  alphaLabel: '#8a96a3',
  shiftBtn: { off: '#24384a', offInk: ACCENT_DARK, on: ACCENT_DARK, onInk: '#12283d' },
  alphaBtn: { off: '#2c323a', offInk: '#aeb8c4', on: '#aeb8c4', onInk: '#1e2228' },
  scanBg: '#2a2f37',
  scanInk: '#c3ccd6',
  dotOn: ACCENT_DARK,
  dotOff: '#3d4650',
  pageLabel: '#66707c',
  arrowBorder: '#2c323a',
  shadow: 'rgba(0,0,0,.35)',
};

export const BLUE = '#378ADD'; // pin / workings accent
export const TOAST_BG = 'rgba(10,24,40,.94)';
