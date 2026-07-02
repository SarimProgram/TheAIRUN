Firebase Analytics is now wired in code, but native setup still requires your Firebase project files.

Files you need to add:
- `app/google-services.json`
- `app/GoogleService-Info.plist`

Firebase console steps:
1. Create or open your Firebase project.
2. Add Android app package: `au.com.msarim.theaicoach`
3. Add iOS app bundle id: `au.com.msarim.theaicoach`
4. Download both service files.
5. Place them in the app root at the paths above.

Install packages:
1. Run `npm install`

Build requirement:
- Firebase Analytics requires a native build.
- Use a dev build or EAS build. Expo Go is not enough.

What is already tracked:
- screen views from route changes
- login success
- register success
- logout
- onboarding started
- onboarding skipped because an existing plan exists
- onboarding completed

Main analytics code:
- `src/analytics/analytics.ts`
- `src/auth/authContext.tsx`
- `app/_layout.tsx`
- `app/(tabs)/Onboarding.tsx`
