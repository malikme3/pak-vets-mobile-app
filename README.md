# Pak Vets Mobile App

Expo + React Native mobile app for veterinary case management.

## Stack

- Expo SDK 54
- React Native 0.81
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

- `/` dashboard
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

## Setup

1. Install dependencies:

```bash
npm install
```

2. Optional environment overrides:

- `EXPO_PUBLIC_API_URL` (default dev API in code)
- `EXPO_PUBLIC_SHARED_SERVICES_API_URL` (optional explicit shared-services URL)
- `EXPO_PUBLIC_STAGE` (fallback stage when URL cannot be inferred)

API pagination currently follows backend `limit`/`offset` query params (for endpoints that support pagination).

3. Run app:

```bash
npm run start
```

## Quality Checks

```bash
npm run check
```

(`check` currently runs TypeScript typecheck.)

## Build

```bash
npm run build:android
npm run build:ios
```

EAS profiles are defined in `eas.json`.
