Build Vet Doctor Mobile App (V1) — Screens + Theme

You are working in an Expo React Native app (TypeScript). Build the V1 screens and navigation for a vet doctor app. Doctor is already onboarded and signed-in (assume auth session exists). Focus on UI + navigation + theme only. Keep code clean, typed, and production-ready.

## Tech constraints
- Expo + React Native + TypeScript
- Use React Navigation (native stack + bottom tabs)
- Use a single theme file and a small set of shared UI components
- No backend integration yet (use local mock data + placeholder actions)
- Keep styling consistent and readable outdoors (Pakistan field usage)

## Theme (Medical Green + Earth Accent)
Create `src/theme/colors.ts` and `src/theme/theme.ts` and apply globally.

Colors:
- primary: #1E7F5C
- primaryDark: #145A41
- accent: #F4A261
- background: #F7F9F8
- surface: #FFFFFF
- textPrimary: #1F2933
- textSecondary: #6B7280
- border: #E5E7EB
- danger: #DC2626
- warning: #F59E0B
- success: #16A34A

Rules:
- Background uses `background`
- Cards use `surface` with subtle shadow
- Text uses `textPrimary` and `textSecondary`
- Buttons: primary filled; secondary outlined (border=primary)
- Avoid pure white full-screen glare; use `background` for screens
- Minimum touch target: 44px height

## Shared UI components (create in `src/components/ui/`)
Implement:
1) `AppButton` (primary/secondary, loading state)
2) `AppInput` (label, error text)
3) `AppCard` (surface card)
4) `SectionHeader` (title + optional action button)
5) `Chip` (status badges: planned/ongoing/completed + suspected/confirmed)
6) `ListRow` (title, subtitle, right chevron)

All components must be typed, reusable, and use the theme.

## Navigation structure
- Root Stack:
  - `DashboardTabs`
  - `CreateAnimal`
  - `CreateVisit`
  - `VisitDetail`
  - `AddDiagnosis`
  - `AddTreatment`
  - `AddNote`
  - `MediaUpload`
- Bottom Tabs (`DashboardTabs`):
  1) Dashboard
  2) Animal Search
  3) Visit History

Use params typing for all routes (no `any`).

## Screens to build (V1)
Build these screens with consistent layout, header titles, and placeholders:

1) **DashboardScreen**
- Doctor header card (name + location)
- Quick actions: "New Visit", "Search Animal"
- Recent visits list (mock: last 5)
- Tapping visit -> VisitDetail
- Tapping New Visit -> AnimalSearch (or CreateVisit flow)

2) **AnimalSearchScreen**
- Search input + segmented filters: Tag ID / Owner Name / Owner Phone
- Mock results list; tapping item -> AnimalProfileScreen (create this screen)
- "Create New Animal" CTA -> CreateAnimalScreen

3) **AnimalProfileScreen**
- Animal summary card (species, breed, tag, owner, location)
- Visit history list for that animal (mock)
- CTA: "Create Visit" -> CreateVisitScreen (prefill animal_id)

4) **CreateAnimalScreen**
- Form fields:
  - owner_name, owner_phone
  - species (picker or simple input)
  - breed, sex, age_months, color, weight_kg, tag_id
  - location_name
  - GPS fields: latitude/longitude (auto-filled mock; allow editing)
- Save creates mock animal and navigates to AnimalProfile

5) **CreateVisitScreen**
- Fields: visit_datetime (use simple text input for now), chief_complaint, notes
- Save -> VisitDetail

6) **VisitDetailScreen** (main working screen)
Show stacked sections (cards) with add buttons:
- Diagnoses section: list + "Add"
- Treatments section: list + "Add" (treatments optional, list can be empty)
- Notes section: list + "Add"
- Media section: grid/list of files + "Upload"

7) **AddDiagnosisScreen**
- diagnosis_text + status (suspected/confirmed)
- Save -> return to VisitDetail

8) **AddTreatmentScreen**
- treatment_type (medication/procedure/advice; allow blank initially)
- treatment_status (planned/ongoing/completed/stopped)
- medicine selection:
  - dropdown mock from `medicines` list
  - OR free text fallback
- dose, route, frequency, duration_days, instructions
- Save -> VisitDetail

9) **AddNoteScreen**
- note_type (TEXT only for now) + note_text
- Save -> VisitDetail

10) **MediaUploadScreen**
- For now: choose file type (image/video/audio/doc) + enter URL text
- Save creates mock media entry tied to visit

11) **VisitHistoryScreen** (tab)
- List of visits (mock) with filters (date range quick chips: 7d/30d/all)
- Tap -> VisitDetail

## Data model (TypeScript types)
Create `src/types/models.ts` with these types (match DB concepts):
- Doctor, Animal, Visit, Medicine, VisitDiagnosis, VisitTreatment, MediaFile, VisitNote
Include enums as union types:
- TreatmentType = 'MEDICATION'|'PROCEDURE'|'ADVICE'
- TreatmentStatus = 'PLANNED'|'ONGOING'|'COMPLETED'|'STOPPED'
- DiagnosisStatus = 'SUSPECTED'|'CONFIRMED'
- MediaFileType = 'AUDIO'|'IMAGE'|'VIDEO'|'DOC'
- NoteType = 'TEXT'|'VOICE_TRANSCRIPT'

## Mock store
Create `src/store/mockDb.ts`:
- in-memory arrays for doctors, animals (3), visits (6), medicines (2), diagnoses/treatments/notes/media (seed some)
- helper functions:
  - getAnimals(query)
  - getAnimalById
  - getVisitsByAnimalId
  - getRecentVisits
  - createAnimal
  - createVisit
  - addDiagnosis
  - addTreatment
  - addNote
  - addMedia

Use React Context or simple module state; keep it simple but typed.

## UX details
- Use `SafeAreaView`
- Use scroll views for forms
- Inputs show validation errors (basic: required fields)
- Buttons disabled when invalid
- Lists are performant (FlatList)
- Empty states: show friendly message + CTA

## Deliverables
- Working navigation
- All screens wired with mock store
- Theme applied consistently
- No TS errors, no `any`
- Clean folder structure:
  - `src/screens/*`
  - `src/navigation/*`
  - `src/components/ui/*`
  - `src/theme/*`
  - `src/types/*`
  - `src/store/*`

Start by creating the theme + UI components, then navigation, then screens in the order listed.
