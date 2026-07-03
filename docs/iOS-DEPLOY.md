# iOS build & App Store deployment

This project is wrapped for iOS with [Capacitor](https://capacitorjs.com). The
web app in `src/` is the source of truth; `ios/App` is a generated native
shell that loads the built `dist/` output. Capacitor 8 uses Swift Package
Manager (not CocoaPods) for its native dependencies, so there is no
`Podfile`/`.xcworkspace` — open `ios/App/App.xcodeproj` directly.

## Prerequisites (one-time, on this Mac)

1. Install **Xcode** from the App Store (full app, not just Command Line
   Tools) and open it once to accept the licence and let it finish
   component installs.
2. Sign in to Xcode with the Apple ID tied to your Apple Developer Program
   membership: **Xcode → Settings → Accounts**.
3. `xcode-select -p` should point at `/Applications/Xcode.app/...` — if it
   still shows the Command Line Tools path, run:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

CocoaPods is already installed on this machine (not required for this
project, but harmless to have).

## Every time you change the web app (src/)

```bash
npm run build       # vite build → dist/
npx cap sync ios     # copies dist/ into ios/App/App/public, updates plugins
```

## First-time Xcode configuration

1. Open `ios/App/App.xcodeproj` in Xcode.
2. Select the **App** target → **Signing & Capabilities**:
   - Team: choose your Apple Developer team.
   - Bundle Identifier: currently set to the placeholder
     `com.myyardage.app` — change it to whatever you've registered (or
     register that exact one) in App Store Connect, under
     **Certificates, Identifiers & Profiles**.
   - "Automatically manage signing" is the easiest option for a solo dev.
3. Set the version/build number under the **General** tab
   (`Marketing Version` / `Current Project Version`).
4. Confirm the app icon (Assets.xcassets → AppIcon) and launch screen
   (Assets.xcassets → Splash) look right in the Xcode preview — both were
   generated to match the in-app brand palette (pine/gold).

## Create the App Store Connect record

Before you can upload a build, the app needs to exist in App Store Connect:

1. https://appstoreconnect.apple.com → **My Apps → +** → New App.
2. Platform: iOS. Name: "My Yardage" (or your chosen fallback if the
   trademark search in the plan turns up a conflict). Bundle ID: the same
   one set in Xcode above. SKU: anything unique (e.g. `my-yardage-001`).
3. Fill in the required metadata: category (Sports), age rating,
   **privacy policy URL** (required — the plan notes all data stays
   on-device, so this can be a short static page saying exactly that),
   and the location-usage justification text (already wired into
   `Info.plist` as `NSLocationWhenInUseUsageDescription`).
4. You'll need App Store screenshots — see "Screenshots" below.

## Archive and upload

1. In Xcode, select the **Any iOS Device (arm64)** run destination (not a
   simulator — archiving requires a real device or generic destination).
2. **Product → Archive**. Wait for the build to finish; the Organizer
   window opens automatically.
3. In the Organizer, select the archive → **Distribute App** →
   **App Store Connect** → **Upload**. Use automatic signing options
   unless you manage certificates manually.
4. Once uploaded, the build appears in App Store Connect under
   **TestFlight** within ~5–15 minutes (after Apple's automated processing).
5. For a first release, add internal testers in TestFlight to sanity-check
   on a real device before submitting for App Store review.
6. When ready, attach the build to a version in **App Store Connect →
   App Store tab**, fill remaining metadata, and **Submit for Review**.

## Screenshots

App Store submission requires screenshots for at least one 6.7" device
size. The fastest path: run the app in the iOS Simulator
(`npx cap open ios`, pick an iPhone 15 Pro Max simulator, `Cmd+R`) and use
**Cmd+S** in the Simulator to save full-resolution screenshots of the Home,
Round, Games, and Bag screens.

## Known gaps to close before public launch (from the product plan)

- Trademark clearance for "My Yardage" not yet completed — do this before
  submitting (fallback names are shortlisted in the plan: TrueCarry,
  DialedIn).
- Privacy policy page needs to be hosted somewhere (GitHub Pages off this
  repo works fine) and linked in App Store Connect.
- MapTiler / satellite imagery is Phase 3+ and irrelevant to this build —
  no API keys are configured or needed yet.
