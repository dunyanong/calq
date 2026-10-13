# Calq

Scientific calculator for Android and iOS: Expo SDK 55 (React Native 0.83), JavaScript, math.js, Firebase (Google sign-in, Firestore, Cloud Functions).

Guests keep history on the device. Signing in with Google syncs history across devices and unlocks the AI features.

## Requirements

- Node 20.19.4+
- Android: Android Studio (SDK, emulator) and JDK 17. Android Studio's bundled JDK (25) fails the build.
- iOS: macOS, Xcode 26.2+, CocoaPods
- Firestore rules tests: Java 21+ (Android Studio's bundled JDK works)

Expo SDK 55 builds with Xcode 26.3, the newest Xcode for macOS 15. SDK 56+ needs Xcode 26.4+ (macOS Tahoe).

Calq runs as a development build (`expo-dev-client`). Expo Go doesn't work.

## Setup

1. Install packages:
   ```sh
   npm install
   ```
2. Copy these into the project root (from a teammate or the Firebase console; git ignores them):
   - `.env`: `EXPO_PUBLIC_FIREBASE_*` (web app config) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `GoogleService-Info.plist` (iOS)
   - `google-services.json` (Android)

### Firebase console (once per project)

1. Authentication → Sign-in method → enable **Google**. The Web client ID under "Web SDK configuration" must match `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. Firestore Database → Create database → production mode.
3. Firestore Database → Rules → paste `firestore.rules` → Publish. Republish after every change to the file.
4. Project settings → Your apps → Android: add the SHA-1 of every debug keystore that builds the app, then download `google-services.json` again. Without it, Android sign-in fails with `DEVELOPER_ERROR`.
   ```sh
   keytool -list -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey | grep SHA1
   ```

### Android

1. Android Studio → Device Manager → create an emulator with a **Google Play** system image (Google sign-in needs it).
2. Install JDK 17:
   ```sh
   brew install openjdk@17
   ```
3. Add to `~/.zshrc`, open a new terminal, and check that `java -version` prints 17:
   ```sh
   export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   ```
4. Start the emulator:
   ```sh
   emulator -list-avds        # e.g. Pixel_8
   emulator -avd Pixel_8
   ```

### iOS

1. Install Xcode from the App Store and open it once.
2. Select it and check the version (26.2+):
   ```sh
   sudo xcode-select -s /Applications/Xcode.app
   xcodebuild -version
   ```
3. Add `export LANG=en_US.UTF-8` to `~/.zshrc`. Without it, `pod install` fails with `Unicode Normalization not appropriate for ASCII-8BIT`.

## Run

Build and install the app (first run, and after any native change):

```sh
npm run android    # emulator or device
npm run ios        # Simulator
```

Otherwise, start the dev server and press `a` (Android) or `i` (iOS):

```sh
npx expo start
```

After adding or removing a native package, regenerate the native projects, then build again:

```sh
npx expo prebuild --clean
cd ios && pod install && cd ..
```

Real iPhone with a free Apple ID (the app expires after 7 days): add the Apple ID in Xcode → Settings → Accounts, turn on Developer Mode on the phone, then run:

```sh
npx expo run:ios --device
```

## Test

```sh
npm test           # Jest: maths engine, screens, history, export, scan
npm run lint       # ESLint: app, Cloud Functions, rules tests
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" npm run test:rules
```

`test:rules` runs `firestore.rules` against the local Firestore emulator (port 8085, no Firebase login). It needs Java 21+, hence the `PATH` prefix. To try a single rule by hand, use Firebase console → Firestore Database → Rules → Rules Playground.

## AI features

Signed-in users only. The Cloud Functions in `functions/` call open-weights Qwen models through an OpenAI-compatible API (OpenRouter by default). The app checks every answer before showing it.

| Feature | Trigger | Function | Check in the app |
|---|---|---|---|
| Scan | camera key on the keypad | `scanEquation` (vision) | User reviews and edits the text, which then replaces the entry |
| Steps | hold a calculation with 2+ operations or big numbers (489×73) | `explainSteps` | math.js recomputes every step (`math/aiSteps.js`); a failing plan shows "Couldn't explain this one" + Retry |
| ∫ formulas | ∫ with both limits empty: ∫(x², □, □) | `integrateFormula` | F′ must equal f at sample points (`math/symbolic.js`); one retry, then an error |

d/dx with the point left empty needs no AI: math.js differentiates on the device. Simple sums (5+3) and ∫, d/dx, Σ, Π calculations show no steps.

Setup (once per Firebase project):

1. Upgrade the project to the **Blaze** plan (Cloud Functions requires it; small usage stays free).
2. Log in and select the project:
   ```sh
   npx firebase login
   npx firebase use <project-id>
   ```
3. Create an API key at the provider (e.g. openrouter.ai → Keys) and store it as a secret:
   ```sh
   npx firebase functions:secrets:set LLM_API_KEY
   ```
4. Deploy (add `--dry-run` to validate without deploying):
   ```sh
   cd functions && npm install && cd ..
   npx firebase deploy --only functions
   ```
   The first deploy asks for the params below (Enter keeps the default) and saves them to `functions/.env.<project-id>` (git-ignored). A deploy without a terminal (script, CI) can't ask, so that file must exist first.

| Param | Default | Notes |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible API: Together, Groq, DeepInfra, vLLM, Ollama |
| `OCR_MODEL` | `qwen/qwen3-vl-235b-a22b-instruct` | Must accept images |
| `STEPS_MODEL` | `qwen/qwen3-235b-a22b-2507` | Steps and ∫ formulas |
| `SCANS_PER_DAY` / `STEPS_PER_DAY` / `INTEGRALS_PER_DAY` | `30` / `200` / `50` | Per user, counted in `usage/{uid}`, reset at 00:00 UTC |

Logs: `npx firebase functions:log`. Prompts: `functions/prompts.js`.