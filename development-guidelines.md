
---

## 🔁 Mapping Rule (VERY IMPORTANT)

| Domain Concept | Screen(s) | API Service | React Query Key |
|---|---|---|---|
| Doctor | Dashboard | `getCurrentDoctor()` | `['doctor','me']` |
| Farmer | Create Animal (link), future list | (future: `getFarmers`, `getFarmer`, `createFarmer`) | `['farmers']` |
| Animal | Search / Profile / Create | `searchAnimals`, `getAnimal`, `createAnimal` | `['animals', query]`, `['animal', id]` |
| Case | Create / Detail / History | `createCase`, `getCase`, `listCases` | `['case', id]`, `['cases', filters]` |
| Diagnosis | Add / List | `addDiagnosis`, `listDiagnoses` | `['case', id]` invalidate |
| Treatment | Add / List | `addTreatment`, `listTreatments` | `['case', id]` invalidate |
| Notes | Add / List | `addNote`, `listNotes` | `['case', id]` invalidate |
| Media | Upload / List | `addMedia`, `listMedia` | `['case', id]` invalidate |

---

## 🚫 Hard Rules

- ❌ Do NOT change backend APIs or payload shapes
- ❌ Do NOT invent fields or enums not supported by backend
- ❌ Do NOT bypass React Query for server state
- ❌ Do NOT use `any`
- ❌ Do NOT mix UI frameworks
- ❌ Do NOT hardcode colors (must be theme-aware)

---

## 🚀 Execution Order (Mandatory)

1) Inspect repo for existing API/auth patterns
2) Define types in `types/api.ts` and `types/domain.ts`
3) Implement `services/apiClient.ts` (axios + token + errors)
4) Implement `services/vetApi.ts` (typed endpoint functions)
5) Implement React Query hooks in each `features/*/hooks.ts`
6) Build theme + UI components
7) Build navigation
8) Build screens and wire to hooks
9) Validate against backend responses (happy + error paths)

---

## ✅ Completion Criteria

- ✅ All screens compile with zero TS errors
- ✅ All server state via React Query
- ✅ Mutations invalidate correct queries
- ✅ Loading/empty/error states everywhere
- ✅ Light + dark theme supported across UI components
- ✅ “Case has no treatment” flow works cleanly (empty state shown)

---

## 🇵🇰 Pakistan Field UX Rules (IMPORTANT)

- Screens must be readable outdoors:
  - avoid pure white backgrounds (use `#F7F9F8`)
  - strong contrast text (`#1F2933`)
- Touch targets >= 44px
- Dense layout, minimal padding, quick actions prominent
- Prefer bottom sheets/modals for “Add” actions
- Show friendly Urdu-ready layout later (don’t bake English-only assumptions into data types)

---

## 🎨 Theme (Recommended)

**Medical Green + Earth Accent** (light/dark supported)

Light tokens:
- primary `#1E7F5C`
- primaryDark `#145A41`
- accent `#F4A261`
- background `#F7F9F8`
- surface `#FFFFFF`
- textPrimary `#1F2933`
- textSecondary `#6B7280`
- border `#E5E7EB`
- danger `#DC2626`
- warning `#F59E0B`
- success `#16A34A`

Dark mode:
- background `#0B1411`
- surface `#121C18`
- textPrimary `#E7F3EE`
- textSecondary `#A7B6AF`
- border `#23312B`
- keep primary/accent same

> All UI components must read from theme.

---

## 📤 Uploads + Media Rules

- Media types: `AUDIO | IMAGE | VIDEO | DOC`
- Always:
  - show upload progress
  - handle cancellation
  - show user-friendly failure with retry
- If presigned S3 upload exists:
  - Step 1: request presign
  - Step 2: upload file
  - Step 3: call backend to create `media_files` record
- Never block the entire app on uploads; keep it per-screen/per-item.

---

## 🧾 Logging + Error Handling

### Error normalization
- Convert backend errors into:
  - `message` (string)
  - `fieldErrors` (Record<string,string> optional)
  - `status` (number)
- Map `fieldErrors` to React Hook Form errors

### Logging
- Dev mode: log request/response summary (no secrets)
- Never log tokens or PII in production builds

---

## ScrollView Button Handling (IMPORTANT)
Buttons inside ScrollViews can have `onPress` canceled. Always use:

```ts
const handlePressIn = useCallback(() => {
  setTimeout(() => onAction(), 50);
}, [onAction]);
