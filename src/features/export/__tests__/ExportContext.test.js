// Export runs: AI study notes or the plain export, to the share sheet or Google Drive,
// and the "Include AI explanation?" question when AI is on.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/Toast';
import { ExportProvider, useExport } from '@/features/export/ExportContext';
import ExportRow from '@/features/export/ExportRow';
import { SettingsProvider, useSettings } from '@/features/settings/SettingsContext';
import { shareFile, toCSV, writeExportFile } from '@/features/history/exportHistory';
import { DriveError, ensureFolder, upload } from '@/services/drive';
import { studyNotes } from '@/services/ai';
import { light } from '@/theme/tokens';

let mockUser = null;
jest.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('@/services/ai', () => ({ explainSteps: jest.fn(() => Promise.resolve([])), studyNotes: jest.fn() }));
// file system and share sheet stubbed; the content builders are the real ones
jest.mock('@/features/history/exportHistory', () => ({
  ...jest.requireActual('@/features/history/exportHistory'),
  writeExportFile: jest.fn((format, content, name) => Promise.resolve({ name, content, size: content.length })),
  shareFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/drive', () => ({ ...jest.requireActual('@/services/drive'), ensureFolder: jest.fn(), upload: jest.fn() }));

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const ADA = { uid: 'u1', email: 'ada@example.com' };
const DRIVE = { uid: 'u1', email: 'ada@example.com', folderId: 'f1', folderName: 'Calq' };
const at = new Date(2026, 9, 13, 14, 3).getTime();
const items = [
  { id: 'a', expr: '6×7', result: '42', angle: 'deg', pinned: false, createdAt: at, updatedAt: at },
  { id: 'b', expr: 'sin(30)', result: '0.5', angle: 'deg', pinned: false, createdAt: at, updatedAt: at },
];
const REPLY = { title: 'Times tables and sines', sections: [{ n: 1, title: 'Multiplying', explanation: '6 times 7 is the result.' }] };

let api;
let settings;
function Probe() {
  api = useExport();
  settings = useSettings();
  return <ExportRow t={light} onExport={(format) => api.exportItems(items, format)} />;
}

async function setup(saved = {}, user = ADA) {
  mockUser = user;
  await AsyncStorage.setItem('calq.settings', JSON.stringify(saved));
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SettingsProvider>
        <ToastProvider>
          <ExportProvider>
            <Probe />
          </ExportProvider>
        </ToastProvider>
      </SettingsProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {}); // settings load
}

const run = (format) => act(() => api.run(items, format));
const runNotes = (format) => act(() => api.run(items, format, { notes: true }));
const written = () => writeExportFile.mock.calls.map(([format, content, name]) => ({ format, content, name }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('share sheet', () => {
  test('without notes: the plain export, unchanged', async () => {
    await setup();
    await run('csv');
    expect(written()).toEqual([{ format: 'csv', content: toCSV(items), name: 'calq-history' }]);
    expect(shareFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'calq-history' }), 'csv');
    expect(studyNotes).not.toHaveBeenCalled();
  });

  test('with notes: Markdown, LaTeX and PDF become study notes', async () => {
    studyNotes.mockResolvedValue(REPLY);
    await setup();
    await runNotes('markdown');
    const [file] = written();
    expect(file.name).toBe('calq-study-notes');
    expect(file.content).toContain('# Times tables and sines');
    expect(file.content).toContain('## 1. Multiplying\n\n`6×7` = `42` · DEG\n\n6 times 7 is the result.');
    expect(file.content).toContain('## All calculations');
    expect(shareFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'calq-study-notes' }), 'markdown');

    await runNotes('latex');
    expect(written()[1].content).toContain('\\subsection*{1.\\ Multiplying}');
    await runNotes('pdf');
    expect(written()[2].content).toContain('<h2>1. Multiplying</h2>');
  });

  test('with notes: CSV and Text stay as they are', async () => {
    await setup();
    await runNotes('csv');
    expect(written()[0]).toEqual({ format: 'csv', content: toCSV(items), name: 'calq-history' });
    expect(studyNotes).not.toHaveBeenCalled();
  });

  test('when the notes fail, the plain export is one tap away', async () => {
    studyNotes.mockRejectedValue(new Error('AI service unavailable, try again'));
    await setup();
    await runNotes('pdf');
    expect(screen.getByText('Study notes failed: AI service unavailable, try again')).toBeTruthy();
    expect(writeExportFile).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByText('Export plain')));
    expect(written()[0]).toMatchObject({ format: 'pdf', name: 'calq-history' });
    expect(written()[0].content).toContain('<h1>Calq history</h1>');
    expect(shareFile).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a guest', {}, null],
    ['AI off', { ai: false }, ADA],
  ])('%s never gets study notes', async (_, saved, user) => {
    await setup(saved, user);
    await runNotes('latex');
    expect(written()[0].name).toBe('calq-history');
    expect(studyNotes).not.toHaveBeenCalled();
  });

  test('Cancel drops the export, even when the notes arrive later; one export at a time', async () => {
    let finish;
    studyNotes.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await setup();
    let pending;
    act(() => {
      pending = api.run(items, 'pdf', { notes: true });
    });
    expect(await screen.findByText('Writing study notes…')).toBeTruthy();
    act(() => {
      api.run(items, 'csv');
    });
    expect(screen.getByText('An export is already running')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Export cancelled')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Writing study notes…')).toBeNull()); // after the pill fades
    await act(async () => {
      finish(REPLY);
      await pending;
    });
    expect(writeExportFile).not.toHaveBeenCalled();
    expect(shareFile).not.toHaveBeenCalled();
  });
});

describe('Google Drive', () => {
  beforeEach(() => {
    ensureFolder.mockResolvedValue({ id: 'f1', name: 'Calq' });
    upload.mockResolvedValue({ id: 'x1', name: 'n', webViewLink: 'https://drive.google.com/file/d/x1/view' });
  });

  test('saves into the folder and links to the file', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await setup({ exportTo: 'drive', drive: DRIVE });
    await run('markdown');
    expect(ensureFolder).toHaveBeenCalledWith({ id: 'f1', name: 'Calq' });
    expect(upload).toHaveBeenCalledWith({
      file: expect.objectContaining({ name: 'calq-history' }),
      name: expect.stringMatching(/^Calq history \d{4}-\d\d-\d\d \d\d-\d\d\.md$/),
      mimeType: 'text/markdown',
      folderId: 'f1',
    });
    expect(shareFile).not.toHaveBeenCalled();
    expect(screen.getByText('Saved to Google Drive · Calq')).toBeTruthy();
    fireEvent.press(screen.getByText('Open'));
    expect(open).toHaveBeenCalledWith('https://drive.google.com/file/d/x1/view');
  });

  test('study notes go to Drive too, named as notes', async () => {
    studyNotes.mockResolvedValue(REPLY);
    await setup({ exportTo: 'drive', drive: DRIVE });
    await runNotes('pdf');
    expect(upload.mock.calls[0][0]).toMatchObject({ name: expect.stringMatching(/^Calq study notes .*\.pdf$/), mimeType: 'application/pdf' });
  });

  test('a folder that had to be made again is remembered', async () => {
    ensureFolder.mockResolvedValue({ id: 'f9', name: 'Calq' });
    await setup({ exportTo: 'drive', drive: DRIVE });
    await run('csv');
    expect(settings.drive).toEqual({ ...DRIVE, folderId: 'f9' });
    expect(upload.mock.calls[0][0].folderId).toBe('f9');
  });

  test('lost access sends the user to Settings', async () => {
    upload.mockRejectedValue(new DriveError('reconnect'));
    await setup({ exportTo: 'drive', drive: DRIVE });
    await run('csv');
    expect(screen.getByText('Reconnect Google Drive in Settings')).toBeTruthy();
    fireEvent.press(screen.getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  test('a busy or offline Drive can be retried with the same file', async () => {
    upload.mockRejectedValueOnce(new DriveError('offline'));
    await setup({ exportTo: 'drive', drive: DRIVE });
    await run('text');
    expect(screen.getByText('No connection. Check your network')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Retry')));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1][0].file).toBe(upload.mock.calls[0][0].file);
    expect(writeExportFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved to Google Drive · Calq')).toBeTruthy();
  });

  test('Drive connected by another Calq user on this phone is not used', async () => {
    await setup({ exportTo: 'drive', drive: { ...DRIVE, uid: 'someone-else' } });
    await run('csv');
    expect(upload).not.toHaveBeenCalled();
    expect(shareFile).toHaveBeenCalled();
  });
});

describe('export row', () => {
  test('without Drive: only the formats', async () => {
    await setup();
    expect(screen.queryByText('Send to')).toBeNull();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  test('with Drive: pick where to send it; the choice is remembered', async () => {
    await setup({ exportTo: 'drive', drive: DRIVE });
    expect(screen.getByText('Send to')).toBeTruthy();
    expect(screen.getByLabelText('Send to Drive · Calq').props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(screen.getByLabelText('Send to Share'));
    expect(settings.exportTo).toBe('share');
    await act(async () => fireEvent.press(screen.getByLabelText('CSV')));
    expect(shareFile).toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('AI on: ✦ marks the formats that can include an AI explanation', async () => {
    await setup();
    expect(screen.getByLabelText('PDF, can include an AI explanation')).toBeTruthy();
    expect(screen.getByLabelText('CSV')).toBeTruthy();
    expect(screen.getByText('Markdown, LaTeX and PDF can include an AI explanation')).toBeTruthy();
  });

  test('AI off: no ✦ anywhere', async () => {
    await setup({ ai: false });
    expect(screen.getByLabelText('PDF')).toBeTruthy();
    expect(screen.queryByText('Markdown, LaTeX and PDF can include an AI explanation')).toBeNull();
  });
});

describe('Include AI explanation?', () => {
  let alert;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    studyNotes.mockResolvedValue(REPLY);
  });
  afterEach(() => alert.mockRestore());

  /** Taps the alert's button with this text. */
  const answer = (text) => act(async () => alert.mock.calls[0][2].find((b) => b.text === text).onPress?.());

  test('AI on: PDF asks first; With AI explanation makes study notes', async () => {
    const onGo = jest.fn();
    await setup();
    act(() => api.exportItems(items, 'pdf', onGo));
    expect(alert).toHaveBeenCalledWith('Include AI explanation?', expect.any(String), expect.any(Array));
    expect(onGo).not.toHaveBeenCalled(); // the panel stays open under the question
    await answer('With AI explanation');
    expect(onGo).toHaveBeenCalled();
    expect(written()[0].name).toBe('calq-study-notes');
  });

  test('Calculation only exports the plain file; Cancel exports nothing', async () => {
    const onGo = jest.fn();
    await setup();
    act(() => api.exportItems(items, 'markdown', onGo));
    await answer('Cancel');
    expect(onGo).not.toHaveBeenCalled();
    expect(writeExportFile).not.toHaveBeenCalled();

    alert.mockClear();
    act(() => api.exportItems(items, 'markdown', onGo));
    await answer('Calculation only');
    expect(written()[0].name).toBe('calq-history');
    expect(studyNotes).not.toHaveBeenCalled();
  });

  test.each([
    ['CSV, AI on', {}, ADA, 'csv'],
    ['PDF, AI off', { ai: false }, ADA, 'pdf'],
    ['PDF, guest', {}, null, 'pdf'],
  ])('%s: no question, only the calculations', async (_, saved, user, format) => {
    const onGo = jest.fn();
    await setup(saved, user);
    await act(async () => api.exportItems(items, format, onGo));
    expect(alert).not.toHaveBeenCalled();
    expect(onGo).toHaveBeenCalled();
    expect(written()[0]).toMatchObject({ format, name: 'calq-history' });
  });
});
