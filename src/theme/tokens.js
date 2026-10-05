// Colour tokens copied from the prototype.
// Light/dark app tokens come from "CalcMaster Menu"; calculator display and
// keypad colours come from "Scientific Calculator".

const ACCENT_LIGHT = '#2a7093';
const ACCENT_DARK = '#7cbfe4';

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
};

// Keypad colours are the same in both themes (the keypad is always dark).
export const pad = {
  bg: '#1e2228',
  handle: '#4c5563',
  key: { bg: '#3b4450', ink: '#f2f6f9' },
  op: { bg: '#333b45', ink: '#cdd6df' },
  eq: { bg: '#a9d6ae', ink: '#1c2a1e' },
  shiftOn: { bg: '#2f5b45', ink: '#c8ecd6' },
  alphaOn: { bg: '#2c4763', ink: '#cfe4f6' },
  shiftLabel: '#8fd0a8',
  alphaLabel: '#7fb4e0',
  shiftBtn: { off: '#2f7d4f', offInk: '#eafaee', on: '#a9d6ae', onInk: '#1c2a1e' },
  alphaBtn: { off: '#2f5f9e', offInk: '#eaf3fb', on: '#9ec9ef', onInk: '#12283d' },
  scanBg: '#2a2f37',
  scanInk: '#c3ccd6',
  dotOn: '#a9d6ae',
  dotOff: '#3d4650',
  pageLabel: '#66707c',
  arrowBorder: '#2c323a',
  shadow: 'rgba(0,0,0,.35)',
};

export const BLUE = '#378ADD'; // pin / workings accent
export const TOAST_BG = 'rgba(10,24,40,.94)';
