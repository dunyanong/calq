# Calq

Scientific calculator for Android and iOS. Expo (React Native), JavaScript, math.js, Firebase (Google sign-in, Firestore).

Works offline as a guest (history saved on the device). Signing in with Google syncs history across devices.

## Requirements

- Node 20+
- Android: Android Studio (SDK, emulator) and JDK 17. Android Studio's bundled JDK (25) fails the build.
- iOS: macOS, Xcode 26.2+, CocoaPods

The project is on Expo SDK 55 (React Native 0.83) so it builds with Xcode 26.3 on macOS 15. SDK 56+ needs Xcode 26.4+, which needs macOS Tahoe.

The app uses a development build (`expo-dev-client`). Expo Go does not work.

## Setup

1. Install packages:
   ```sh
   npm install
   ```
2. Get these from a teammate (or the Firebase console) and place them in the project root:
   - `.env` (Firebase web config, Google web client ID)
   - `GoogleService-Info.plist` (iOS)
   - `google-services.json` (Android)

   Git ignores all three.

### Firebase console (once per Firebase project)

1. Authentication → Sign-in method → enable **Google**. Under "Web SDK configuration", the Web client ID must match `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`.
2. Firestore Database → Create database → production mode.
3. Firestore Database → Rules → paste the contents of `firestore.rules` → Publish.
4. Project settings → Your apps → Android app: add the SHA-1 of every debug keystore that builds the app, then download `google-services.json` again. The debug SHA-1:
   ```sh
   keytool -list -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey | grep SHA1
   ```
   Google sign-in on Android fails with `DEVELOPER_ERROR` when the SHA-1 is missing.

### Android

1. Install Android Studio. Create an emulator: Device Manager → Create device.
2. Install JDK 17:
   ```sh
   brew install openjdk@17
   ```
3. Add to `~/.zshrc`, then open a new terminal:
   ```sh
   export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   ```
   Check: `java -version` prints `17`.
4. Start the emulator:
   ```sh
   emulator -list-avds        # e.g. Pixel_8
   emulator -avd Pixel_8
   ```

### iOS

1. Install Xcode from the App Store. Open Xcode once to finish setup.
2. Select Xcode and check the version:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app
   xcodebuild -version        # must be 26.2 or later
   ```
3. CocoaPods needs a UTF-8 locale. If `pod install` fails with `Unicode Normalization not appropriate for ASCII-8BIT`, add to `~/.zshrc`:
   ```sh
   export LANG=en_US.UTF-8
   ```

## Run

First run, and after any native change (new native package, `app.json` edit):

```sh
npm run android    # build + install on emulator/device
npm run ios        # build + install on Simulator
```

Every other time:

```sh
npx expo start     # start dev server; press a (Android) or i (iOS) to open the installed Calq
```

Real iPhone, free Apple ID (expires after 7 days). First add your Apple ID in Xcode → Settings → Accounts and turn on Developer Mode on the phone:

```sh
npx expo run:ios --device
```

Google sign-in on the Android emulator needs a system image with Google Play (Device Manager shows the Play Store icon).

## AI features (scan, steps, ∫ formulas)

Signed-in users only. Both run through Cloud Functions in `functions/`, which call open-weights models (Qwen) on an OpenAI-compatible API. OpenRouter is the default.

- **Scan** (camera key on the keypad): photo or screenshot → `scanEquation` (vision model) → expression in calculator notation → the user checks or edits it → inserted into the entry.
- **∫ formulas**: ∫dx with both limits left empty (∫(x²,□,□)) asks `integrateFormula` (text model) for an antiderivative F. The app accepts F only if its numeric derivative equals f at many sample points (`math/symbolic.js`), asks once more if not, and otherwise says it couldn't find one; a wrong formula is never shown. d/dx with the point left empty needs no AI: math.js works out the derivative on the device.
- **Steps** (load when you hold a calculation with more than one operation, or big numbers like 489×73): `explainSteps` (text model) says which parts are worked out in each step, in what order, with a short note. It can also rewrite hard arithmetic into an easier equal form (489×73 → 489×70+489×3). The app computes every value with math.js (`math/aiSteps.js`) and checks that each step still equals the result. A plan that fails the check is never shown ("Couldn't explain this one" + Retry). Guests see "Sign in to see steps"; simple calculations like 5+3 show no steps.

Setup (once per Firebase project):

1. Firebase console → upgrade to the **Blaze** plan (Cloud Functions needs it; free tier covers small usage).
2. Create an API key at your provider (e.g. openrouter.ai → Keys) and store it as a secret:
   ```sh
   npx firebase functions:secrets:set LLM_API_KEY
   ```
3. Install and deploy:
   ```sh
   cd functions && npm install && cd ..
   npx firebase deploy --only functions
   ```
   The first deploy asks for the params below; press Enter to keep the defaults. They are saved in `functions/.env.<project-id>` (git ignores it). A deploy without a terminal (script, CI) cannot ask, so that file must exist first.

| Param | Default | |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | any OpenAI-compatible API: Together, Groq, DeepInfra, your own vLLM/Ollama |
| `OCR_MODEL` | `qwen/qwen3-vl-235b-a22b-instruct` | must accept images |
| `STEPS_MODEL` | `qwen/qwen3-235b-a22b-2507` | |
| `SCANS_PER_DAY` / `STEPS_PER_DAY` / `INTEGRALS_PER_DAY` | `30` / `200` / `50` | per user, counted in `usage/{uid}` |

`expo-image-picker` and `expo-print` (PDF export) are native modules, so run `npm run android` / `npm run ios` once after pulling them (on iOS run `pod install` in `ios/` first, with `LANG=en_US.UTF-8`).

Logs: `npx firebase functions:log`. Prompts are in `functions/prompts.js`.

## Check

```sh
npm test           # jest: maths engine, screens, history, export
npm run lint
```

Firestore security rules, tested against the local Firestore emulator (no Firebase login needed). The emulator needs Java 21+, so this uses Android Studio's bundled JDK for this one command:

```sh
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" npm run test:rules
```

To try a rule by hand instead: Firebase console → Firestore Database → Rules → Rules Playground.

## Project layout

```
src/
  app/                      routes only (Expo Router), each re-exports a screen
  components/               shared UI: Drawer, Toast, ScreenHeader, Logo, Icons, Switch, Segmented, AngleBadge
  features/
    calculator/
      CalculatorScreen.js
      components/           CalcHeader, DisplayPanel, Keypad, KeyButton, HoldPanel
      math/                 engine (math.js), entry (cursor, input boxes, variables), keys, format,
                            calculus (numeric ∫ d/dx), symbolic (formulas), aiSteps (checks AI plans), normalize
      __tests__/
    scan/                   ScanSheet (scan a calculation), pickImage (camera/library -> JPEG)
    history/
      HistoryContext.js     history state: device storage for guests, Firestore when signed in
      HistoryScreen.js      Recent / Starred list (tap a row to edit it again, Undo after delete)
      historyStore.js       AsyncStorage
      historyCloud.js       Firestore reads/writes, merge on sign-in
      exportHistory.js      CSV / text / Markdown / LaTeX / PDF + share sheet
      latex.js              calculator notation -> LaTeX
      __tests__/
    auth/                   AuthContext (Google sign-in -> Firebase Auth)
    settings/               SettingsScreen, SettingsContext, settingsStore (also Ans and the variables)
  services/firebase.js      Firebase app, Auth, Firestore, Functions
  services/ai.js            calls the AI Cloud Functions
  theme/                    colours, fonts
functions/                  Cloud Functions: scanEquation, explainSteps, integrateFormula (LLM calls + daily quotas)
firestore.rules             security rules (publish in the Firebase console)
firestore-tests/            rules tests (npm run test:rules)
```

- Import across folders with `@/` (maps to `src/`), e.g. `import { F } from '@/theme/fonts'`.
- New feature: add a folder in `src/features/`, add a one-line route in `src/app/`.
- `math/engine.js` translates display symbols (`×`, `÷`, `√(`, `sin⁻¹(`) to math.js syntax. Unknown input fails. No `eval`.
- `math/keys.js` defines every key as data. Add or change keys there.
- Variables A, B, C, D, F, M (on the numeric page): ALPHA + key types the letter, SHIFT RCL (STO) + key stores the entry (or Ans), RCL + key inserts the value. M+ / M− add to M. Values and Ans are kept on the device. `=` saves the values into the history expression (`2A` → `2(12)`), so a saved calculation never changes. ALPHA + √ types the unknown x for ∫, d/dx, Σ, Π (the same as the x key on the scientific page); it is not a stored variable.
- + (top right of the calculator) starts a new session: the screen starts empty (earlier calculations stay in Recent and behind the pin pill), Ans and the variables go back to 0. Undo in the toast brings it all back, including the line you were typing. Stored as `sessionStart` in settings.
- Firestore data: `users/{uid}/history/{calcId}` = `{ expr, result, angle, pinned, createdAt, updatedAt }`. `calcId` is the item's UUID, so merging guest history on sign-in never duplicates items. Changing these fields means changing `firestore.rules` too.
