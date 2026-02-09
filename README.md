# Pak Vets Mobile App

Mobile application for Pak Vets - Veterinary Management System built with Expo and React Native.

## Technology Stack

- **Expo** (~54.0.33)
- **React Native** (0.81.5)
- **TypeScript** (strict mode)
- **React Navigation** (Native Stack + Bottom Tabs)
- **React Query** (@tanstack/react-query) - Server state management
- **Axios** - HTTP client
- **React Hook Form** - Form management
- **date-fns** - Date formatting

## Project Structure

```
src/
├── components/
│   └── ui/              # Reusable UI components
│       ├── AppButton.tsx
│       ├── AppInput.tsx
│       ├── AppCard.tsx
│       ├── SectionHeader.tsx
│       ├── Chip.tsx
│       └── ListRow.tsx
├── hooks/               # React Query hooks
│   ├── useDoctor.ts
│   ├── useAnimals.ts
│   └── useVisits.ts
├── navigation/          # Navigation configuration
│   ├── RootNavigator.tsx
│   ├── DashboardTabs.tsx
│   └── types.ts
├── screens/             # Screen components
│   ├── DashboardScreen.tsx
│   ├── AnimalSearchScreen.tsx
│   ├── AnimalProfileScreen.tsx
│   ├── VisitHistoryScreen.tsx
│   ├── CreateAnimalScreen.tsx (placeholder)
│   ├── CreateVisitScreen.tsx (placeholder)
│   └── VisitDetailScreen.tsx (placeholder)
├── services/            # API services
│   ├── apiClient.ts
│   └── vetApi.ts
├── theme/               # Theme configuration
│   ├── colors.ts
│   └── theme.ts
└── types/               # TypeScript types
    ├── models.ts
    ├── api.ts
    └── domain.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure API URL (optional):
   - Create `.env` file and set `EXPO_PUBLIC_API_URL` to override the default
   - Default: `https://pak-vets-dev.roundrocktennis.com` (dev custom domain)
   - For local development with serverless-offline, set: `EXPO_PUBLIC_API_URL=http://localhost:3001`

3. Start the app:

```bash
npm start
```

## Screens Implemented (V1 - First 3)

### 1. Dashboard Screen

- Doctor header card with name, location, and phone
- Quick action buttons: "New Visit" and "Search Animal"
- Recent visits list (last 5 visits)
- Pull-to-refresh support
- Navigation to visit details and animal search

### 2. Animal Search Screen

- Search input with filter options:
  - Tag ID
  - Owner Name
  - Owner Phone
- Filterable animal list
- "Create New Animal" button
- Navigation to animal profile

### 3. Animal Profile Screen

- Animal summary card with all details:
  - Species, breed, tag ID
  - Owner information
  - Location and GPS coordinates
  - Age and weight
- "Create Visit" button
- Visit history list for the animal
- Pull-to-refresh support

### Additional Screens (Placeholders)

- Visit History Screen (tab) - List of all visits with date filters
- Create Animal Screen - Placeholder
- Create Visit Screen - Placeholder
- Visit Detail Screen - Placeholder

## API Integration

The app integrates with the Pak Vets API:

- Base URL: Configured via `EXPO_PUBLIC_API_URL` environment variable
- Default: `https://pak-vets-dev.roundrocktennis.com` (dev custom domain)
- Production: `https://pak-vets-prod.roundrocktennis.com` (set via `EXPO_PUBLIC_API_URL`)
- All API calls use React Query for caching and state management
- Error handling with normalized error responses
- Automatic query invalidation on mutations

## Theme

**Medical Green + Earth Accent** theme optimized for outdoor use in Pakistan:

- Primary: `#1E7F5C` (Medical Green)
- Accent: `#F4A261` (Earth tone)
- Background: `#F7F9F8` (Soft green-tinted, reduces glare)
- All components are theme-aware

## Development Guidelines

See `development-guidelines.md` for:

- API integration patterns
- React Query usage
- Error handling
- Form validation
- Pakistan field UX rules

## Flow Design

See `flow-design-guidelines.md` for:

- Complete screen specifications
- Navigation structure
- User flows

## Next Steps

1. Implement remaining screens (CreateAnimal, CreateVisit, VisitDetail, etc.)
2. Add form validation with React Hook Form
3. Implement media upload functionality
4. Add authentication flow
5. Implement offline support

## License

ISC
