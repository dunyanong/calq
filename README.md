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
  components/               shared UI: Drawer, Toast, ScreenHeader, Logo, Icons, Switch, Segmented
  features/
    calculator/
      CalculatorScreen.js
      components/           CalcHeader, DisplayPanel, Keypad, KeyButton, HoldPanel
      math/                 engine, format, steps, keys
      __tests__/
    history/
      HistoryContext.js     history state: device storage for guests, Firestore when signed in
      HistoryScreen.js      Recent / Starred list
      historyStore.js       AsyncStorage
      historyCloud.js       Firestore reads/writes, merge on sign-in
      exportHistory.js      CSV / text / Markdown + share sheet
      __tests__/
    auth/                   AuthContext (Google sign-in -> Firebase Auth)
    settings/               SettingsScreen, SettingsContext, settingsStore
  services/firebase.js      Firebase app, Auth, Firestore
  theme/                    colours, fonts
firestore.rules             security rules (publish in the Firebase console)
firestore-tests/            rules tests (npm run test:rules)
```

- Import across folders with `@/` (maps to `src/`), e.g. `import { F } from '@/theme/fonts'`.
- New feature: add a folder in `src/features/`, add a one-line route in `src/app/`.
- `math/engine.js` translates display symbols (`×`, `÷`, `√(`, `sin⁻¹(`) to math.js syntax. Unknown input fails. No `eval`.
- `math/keys.js` defines every key as data. Add or change keys there.
- Firestore data: `users/{uid}/history/{calcId}` = `{ expr, result, angle, pinned, createdAt, updatedAt }`. `calcId` is the item's UUID, so merging guest history on sign-in never duplicates items. Changing these fields means changing `firestore.rules` too.
