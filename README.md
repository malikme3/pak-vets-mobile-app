# Pak Vets Mobile App

Expo + React Native mobile app for veterinary case management.

## Stack

- Expo SDK 58
- React Native 0.88
- TypeScript (strict)
- Expo Router (file-based navigation)
- TanStack React Query
- Axios

## App Structure

```text
src/
  app/                  # Expo Router screens/routes
  components/           # Shared UI + voice components
  features/             # React Query hooks by domain
  services/             # API clients (pak-vets + shared-services)
  theme/                # Theme tokens + hook
  types/                # API/domain types
  utils/                # Formatting/helpers
```

Main entry is `index.ts` (`expo-router/entry`). Root providers and stack live in `src/app/_layout.tsx`.

## Available Routes

- `/farm-vitals` public Farm Vitals introduction
- `/create-farm` public farm registration
- `/farm-dashboard` public submitted-farm review
- `/add-farm-animal` public animal entry for an open farm
- `/login` existing sign-in flow
- `/` authenticated dashboard
- `/select-animal`
- `/create-animal`
- `/create-case`
- `/animal-details`
- `/case-detail`
- `/add-diagnosis`
- `/add-treatment`
- `/add-note`
- `/add-media`
- `/nearby-cases`

Signed-out users land on Farm Vitals. From there they can register a farm, review submitted farms, and add animals using the active templates. Sign-in continues through the existing Pak Vets flow.

## Setup

1. Select the project’s Node version and install dependencies using Yarn Classic:

```bash
nvm install
nvm use
yarn install --frozen-lockfile
```

Firebase requires Node.js 24.12 or newer; `.nvmrc` pins the version used by EAS builds.

2. Optional environment overrides:

- `EXPO_PUBLIC_API_URL` (default dev API in code)
- `EXPO_PUBLIC_SHARED_SERVICES_API_URL` (optional explicit shared-services URL)
- `EXPO_PUBLIC_STAGE` (fallback stage when URL cannot be inferred)
- `FIREBASE_API_KEY` (required for Firebase auth; loaded via `app.config.js`)

API pagination currently follows backend `limit`/`offset` query params (for endpoints that support pagination).

3. Run app:

```bash
yarn start
```

For iOS on a Mac, install Xcode 27 and its iOS platform support in Xcode Settings → Components. Run `yarn ios` to start Metro and open a simulator in Device Hub, or press `i` after `yarn start`. Use the SDK 58 version of Expo Go; older development builds must be rebuilt after this SDK upgrade.

Voice recording and playback use `expo-audio`. Test microphone permission, recording/transcription, pause/resume, and replay on a device before release.

## Quality Checks

```bash
yarn run check
yarn test
npx expo-doctor@latest
```

`check` runs TypeScript; `test` checks voice-note playback and recording resource lifecycles. Expo Doctor validates SDK dependencies and app configuration.

## Build

```bash
yarn build:android
yarn build:ios
```

EAS profiles are defined in `eas.json`.
