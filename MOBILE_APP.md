# StudyFlow mobile app

StudyFlow's existing React app can be packaged as an Android app with Capacitor. The web app remains the source of truth; mobile packaging does not replace the dashboard, Study Lab, music player, Toolkit, Boost Lab, or Supabase account data.

## Android debug build

Requirements: Node.js 24, Java 21, Android SDK, and an internet connection for dependency installation.

From the repository root:

```bash
cd frontend
npm ci
npm install --no-save --package-lock=false --legacy-peer-deps @capacitor/core@8.0.0 @capacitor/cli@8.0.0 @capacitor/android@8.0.0
npm test -- --watchAll=false
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, run the app on an emulator or connected Android device. To create a local debug APK after the Android project has been generated:

```bash
cd android
./gradlew assembleDebug
```

The APK is at `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

## Continuous integration

The **StudyFlow Android App** GitHub Actions workflow runs unit tests, builds the React production bundle, generates a Capacitor Android project, compiles a debug APK, and uploads the APK as a workflow artifact. Run it manually from Actions or let it run on relevant pushes and pull requests to `main`.

The generated APK is a **debug build for testing**, not a signed Play Store release. A production release needs a protected signing key, versioning/release policy, and device testing. Never commit signing keys, service-role credentials, or private production secrets.

## Future updates and architecture

- Keep product features and shared business logic in the existing React source.
- Keep the Capacitor app ID stable after release: `com.sflow.studyflow`. Changing it later creates a different Android app identity.
- After changing web code, rebuild the web bundle and run `npx cap sync android` before building the APK.
- Keep Capacitor core, CLI, and platform packages on the same pinned version. Upgrade them together in a reviewed change, then run CI and test on real devices.
- Use Supabase Auth and Row Level Security for account-scoped cloud data. Browser/local storage and IndexedDB are not substitutes for cross-device cloud persistence.
- CI uses dummy Supabase values. Passing CI proves the code builds and tests against its configured test environment; it does not prove production credentials, real account sync, audio-provider behavior, push notifications, or every device-specific behavior.

## Current scope

This first packaging path targets Android. It does not yet create a signed release APK/AAB, publish to Google Play, or add iOS. Native features such as push notifications, background audio guarantees, and deep links need their own implementation and device-level tests before being advertised as supported.
