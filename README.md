# Calq

Scientific calculator for Android and iOS: Expo SDK 55 (React Native 0.83), JavaScript, math.js, Firebase (Google sign-in, Firestore, Cloud Functions).

Guests keep history on the device. Signing in with Google syncs history across devices and unlocks the AI features and saving exports to Google Drive.

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

## Share on Android phones

Build the APK (no phone or emulator needed):

```sh
cd android && ./gradlew app:assembleRelease && cd ..
```

Send `android/app/build/outputs/apk/release/app-release.apk` to the phone (WhatsApp, Drive, cable). On the phone: tap the file → allow "Install unknown apps" → Install.

After code changes, build again and send the new APK; it installs over the old one.

## Test

```sh
npm test           # Jest: maths engine (incl. advanced keys), screens, history, export, scan
npm run lint       # ESLint: app, Cloud Functions, rules tests
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" npm run test:rules
```

`test:rules` runs `firestore.rules` against the local Firestore emulator (port 8085, no Firebase login). It needs Java 21+, hence the `PATH` prefix. To try a single rule by hand, use Firebase console → Firestore Database → Rules → Rules Playground.

## Advanced maths

Swipe the keypad past SCIENTIFIC to two more pages: **MATRIX · CALCULUS** and **SOLVE · DISCRETE**. Keys with several inputs type boxes, like ∫dx, and the line under the entry says what each box is for. Everything runs on the phone (`src/features/calculator/math/advanced.js` and the modules it imports); none of it uses AI.

| Area | Type it as | Examples |
|---|---|---|
| Matrices | `[1,2;3,4]` (`;` between rows), vectors `[1,2,3]`; `Aᵀ`, `A⁻¹`, `×` | `det([1,2;3,4])` = -2 |
| Linear algebra | `det inv rank trace eig svd LU QR rref null chol posdef Jordan Iₙ`; `solve(A,b)`, `dot`, `cross`, `kron` | `solve([2,1;1,−1],[5,1])` = [2,1] |
| Complex numbers | `i`, `Re Im z̄ arg abs` | `(3+4i)×(1−2i)` = 11−2i |
| Several variables | `∬(f,a,b,c,d)` (dy dx; c, d may use x), `∭`, `∂x ∂y ∂z` (empty point gives the formula), `∇f Jac Hess div curl ∇²`, `Taylor`, `lim` (∞ on SHIFT) | `∬(x×y,0,1,0,x)` = 0.125 |
| Differential equations | `ODE(f(x,y),x₀,y₀,x)`, `ODE2(f(x,y,y′),…)`, `BVP`, `stab(J)` | `ode(y,0,1,1)` = 2.718281828 |
| Optimisation | `min/max(f,a,b)` on an interval, `min/max(f,[start])` in several variables, `minc/maxc(f,[x+y=1,x≥0],[start])` (reports the KKT multipliers λ), `LP/ILP(c,A,b)` (max c·x, Ax ≤ b, x ≥ 0) | `lp([3,5],[1,0;0,2;3,2],[4,12,18])` → x=[2,6], max=36 |
| Equations | `solve` (nsolve, with a guess), `root(f,a,b)`, `roots([coefficients])` | `roots([1,0,1])` = [−i,i] |
| Discrete | `mod prime? factor φ modinv modpow and or not xor ⇒ rec Cat S(n,k) Bell A∪B A∩B A∖B` | `factor(360)` = 2³×3²×5 |
| Graphs | weight / adjacency matrix, vertices from 1: `path mst flow assign χ(G) comps trees λ₂` | `path([0,1,4;1,0,2;4,2,0],1,3)` → d=3, path=[1,2,3] |

- **Complex numbers:** Settings → **Numbers** → Complex makes √(−4) = 2i. An `i` anywhere in a calculation always works with complex numbers.
- **Results with several values:** these print as `x=…, y=…, min=…` and leave Ans alone. A matrix or complex result goes into Ans, so `det(Ans)` works.
- **Slow keys:** ∬, ODE and min show "Working it out…" and skip the live preview.
- **Theory topics:** proofs, P vs NP, measure theory and chaos theory are explained by the AI study notes. They have no keys.

## AI features

Signed-in users only, behind one switch: Settings → AI integration → **AI help** (on by default). With it off, the app shows no AI at all: no scan key, no ✦ shortcuts, and exports never ask. The Cloud Functions in `functions/` call open-weights Qwen models through an OpenAI-compatible API (OpenRouter by default). The app checks every answer before showing it.

| Feature | Trigger | Function | Check in the app |
|---|---|---|---|
| Scan | camera key on the keypad | `scanEquation` (vision) | User reviews and edits the text, which then replaces the entry |
| Shortcuts in steps | **Steps** on hard arithmetic (489×73): the app's own steps show at once, then "Looking for a shortcut…" | `explainSteps` | math.js recomputes every step (`math/aiSteps.js`); a plan that fails the check, or an error, leaves the app's steps as they are |
| ∫ formulas | ∫ with both limits empty: ∫(x², □, □) | `integrateFormula` | F′ must equal f at sample points (`math/symbolic.js`); one retry, then an error |
| Study notes | export Markdown, LaTeX or PDF, then answer **With AI explanation** to "Include AI explanation?" | `studyNotes` (+ `explainSteps` for the workings) | Workings are checked like Steps. A sentence is dropped if it has a number that isn't in its calculation, or claims a value (`sin(30)=0.5`, "`3!` is 6") that math.js disagrees with (`features/export/studyNotes.js`). The app writes all the Markdown / LaTeX / HTML |

**Steps need no AI.** Hold a calculation with 2+ operations or big numbers and tap **Steps** (top left of the panel). The app works the steps out itself, instantly and for everyone, guests too: brackets and functions first, then powers, × ÷ and + −, each step checked with math.js (`localSteps` in `math/aiSteps.js`). With AI on, only hard arithmetic such as 489×73 also asks the AI for a shortcut (489×70+489×3). The study-notes export uses the same steps, so its only AI call is the notes themselves.

Every AI wait shows how long it should take: "Reading… ~8 s left" when scanning, then a countdown, then "Taking longer than usual…" once it runs over. The same appears for the shortcut, ∫ formulas and the study-notes export pill. The estimates start from typical times and learn from each finished call on this phone (`features/ai/aiEta.js`).

Scan also reads matrices, determinants, linear systems, double integrals, partial derivatives, complex numbers, optimisation problems, ODEs and equations. It writes them in the notation of [Advanced maths](#advanced-maths).

d/dx with the point left empty needs no AI: math.js differentiates on the device. Simple sums (5+3) and ∫, d/dx, Σ, Π calculations show no steps. **ODE, ODE2 and solve** show the solver's own workings instead: the problem, the method (Runge–Kutta RK45, or Newton–Raphson), the first and last steps with their values, and the result. They are recorded while the calculation is worked out again on the phone, never by the AI (`math/numericSteps.js`).

Study notes cover the 20 most recent calculations of an export and end with the plain table of all of them. If the notes fail, the toast offers **Export plain**. CSV and Text never ask, and neither does any format with the switch off: they export only the calculations.

Exports come from the hold panel (one calculation), from the History screen (the whole list), or from a selection: hold a calculation → **Select**, tap others to add or remove them, then **Export** in the header.

The menu shows **AI credits · N% left today**: what is left of all the daily limits below added together, from the `aiCredits` function (it uses no quota). The bar stays hidden until that function is deployed.

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
   The first deploy asks for the params below (Enter keeps the default) and saves them to `functions/.env.<project-id>` (git-ignored). A deploy without a terminal (script, CI) can't ask, so that file must exist first and list every param, including ones added later (e.g. `NOTES_PER_DAY=20`).

| Param | Default | Notes |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible API: Together, Groq, DeepInfra, vLLM, Ollama |
| `OCR_MODEL` | `qwen/qwen3-vl-235b-a22b-instruct` | Must accept images |
| `STEPS_MODEL` | `qwen/qwen3-235b-a22b-2507` | Steps and ∫ formulas |
| `SCANS_PER_DAY` / `STEPS_PER_DAY` / `INTEGRALS_PER_DAY` | `30` / `200` / `50` | Per user, counted in `usage/{uid}`, reset at 00:00 UTC |
| `NOTES_PER_DAY` | `20` | Study-notes exports per user per day (each makes up to 5 model calls) |

Logs: `npx firebase functions:log`. Prompts: `functions/prompts.js`.

## Google Drive

Signed-in users can connect Google Drive in Settings → Google Drive. Exports then go to a Drive folder instead of the share sheet: the **Send to** switch above the export buttons picks Share or Drive, and Settings → Google Drive → Folder picks the folder (My Drive, a folder Calq made, or a new one).

- Calq asks for the `drive.file` scope only, through the Google sign-in it already uses, and only when the user taps Connect. With it, Calq can see and change only the files and folders it creates.
- Access tokens come from Google Sign-In for each upload. Calq never stores them and never sends them to its server. Settings keep only the folder.
- Disconnect revokes Calq's Google access. Files already saved stay in Drive, and the user stays signed in to Calq.

Setup (once per Firebase project, in the Google Cloud console of the same project):

1. APIs & Services → Library → **Google Drive API** → Enable. Without it, uploads fail with "Google Drive is not set up for Calq yet".
2. Google Auth Platform (OAuth consent screen) → Data access → Add or remove scopes → add `.../auth/drive.file` → Save. While the app's publishing status is Testing, only the test users listed under Audience can connect.

Drive needs no new native module, so there's no prebuild. Code: `src/services/drive.js`.
