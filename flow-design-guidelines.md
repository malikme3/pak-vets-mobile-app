# Vet Doctor Mobile App – Coding Guidelines (STABLE VERSION)

**Expo + React Native + TypeScript**  
**Purpose:** Build Vet Doctor mobile app using existing backend APIs  
**Audience:** Cursor AI + developers  
**Priority:** Stability > cleverness

---

## 🚨 CRITICAL WARNING (READ FIRST)

The following runtime error MUST NEVER happen again:

TypeError: expected dynamic type 'boolean', but had type 'string'


**Root cause (100% of the time):**
- Passing `"true"` / `"false"` (strings) to props that expect booleans
- Over-engineered theme logic returning mixed types
- Spreading unknown props into React Native components

This README exists to PREVENT that.

---

## 🎯 Objective

Build a Vet Doctor mobile app that allows doctors to:

- Search / register animals
- Create visits
- Add diagnoses
- Add treatments (OPTIONAL per visit)
- Add notes
- Upload media (AUDIO / IMAGE / VIDEO / DOC)

👉 **Backend APIs already exist**
👉 **DO NOT change backend contracts**
👉 **DO NOT invent new fields**

---

## ✅ Non-Negotiable Rules

- ✅ STRICT TypeScript (`noImplicitAny`, no `any`)
- ✅ React Query for ALL server state
- ✅ Treatments are OPTIONAL (visit can have zero treatments)
- ✅ Simple theme (NO dynamic generators)
- ✅ Light + Dark mode supported
- ❌ NO string booleans
- ❌ NO prop spreading
- ❌ NO API calls inside screens

---

## 🛠 Tech Stack (MANDATORY)

- Expo (stable)
- React Native
- TypeScript (strict)
- Expo Router
- Axios
- @tanstack/react-query
- Zustand (auth/session only)
- React Hook Form + Zod

---

## 🎨 UI Framework

Choose ONE (do not mix):

- NativeWind  
OR  
- React Native Paper  

Use whatever already exists in the repo.

---

## 🎨 THEME (SAFE + SIMPLE)

### RULES
- Theme values are **ONLY strings or numbers**
- Theme NEVER decides booleans
- No `useMemo` theme factories
- No env-based theme toggles
- Dark mode ONLY from `useColorScheme()`

---

### `src/theme/colors.ts`

```ts
export const lightColors = {
  primary: '#1E7F5C',
  accent: '#F4A261',
  background: '#F7F9F8',
  surface: '#FFFFFF',
  text: '#1F2933',
  muted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
};

export const darkColors = {
  primary: '#1E7F5C',
  accent: '#F4A261',
  background: '#0B1411',
  surface: '#121C18',
  text: '#E7F3EE',
  muted: '#A7B6AF',
  border: '#23312B',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
};
src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
}
✔ isDark is ALWAYS boolean
✔ colors are ALWAYS strings
✔ ZERO chance of boolean/string mismatch

🧱 COMPONENT RULES (MANDATORY)
❌ NEVER DO THIS
<View {...props} />
<Button disabled={"false"} />
✅ ALWAYS DO THIS
<Button disabled={false} />
<View style={props.style} />
Component prop rules
disabled?: boolean

loading?: boolean

visible?: boolean

NEVER accept string versions.

If unsure:

const disabled = Boolean(value);
📁 Folder Structure (MANDATORY)
src/
├── app/                  # expo-router routes
├── components/
│   └── ui/
├── features/
│   ├── animals/
│   ├── visits/
│   ├── diagnoses/
│   ├── treatments/
│   ├── notes/
│   └── media/
├── services/
│   ├── apiClient.ts
│   └── vetApi.ts
├── store/
│   └── authStore.ts
├── theme/
│   ├── colors.ts
│   └── useTheme.ts
├── types/
│   ├── api.ts
│   └── domain.ts
└── utils/
🔁 DOMAIN → SCREEN → API MAPPING
Domain	Screens	API	React Query Key
Doctor	Dashboard	getCurrentDoctor()	['doctor','me']
Animal	Search / Profile / Create	searchAnimals, getAnimal, createAnimal	['animal',id]
Visit	Create / Detail / History	createVisit, getVisit, listVisits	['visit',id]
Diagnosis	Add / List	addDiagnosis	invalidate ['visit',id]
Treatment	Add / List	addTreatment	invalidate ['visit',id]
Notes	Add / List	addNote	invalidate ['visit',id]
Media	Upload / List	addMedia	invalidate ['visit',id]
🏗 ARCHITECTURE RULES
Screens
Screens MAY:

read route params

call hooks

render UI

Screens MUST NOT:

call axios

mutate server state directly

contain business logic

Services
Services:

call backend APIs

match payloads exactly

return typed data

Services MUST NOT:

navigate

touch UI

store global state

Hooks
Hooks:

own React Query usage

own invalidation logic

return clean data

🚫 HARD STOPS
❌ Do NOT change backend APIs

❌ Do NOT invent fields

❌ Do NOT bypass React Query

❌ Do NOT mix UI libraries

❌ Do NOT pass "true" / "false" anywhere

🚀 EXECUTION ORDER
Inspect existing API/auth code

Define strict types

Implement apiClient

Implement vetApi (typed)

Build hooks per feature

Implement theme (exactly as above)

Build shared UI components

Build navigation

Build screens

Test on iOS + Android

🇵🇰 Field UX Rules (Pakistan)
Avoid pure white backgrounds

Touch targets ≥ 44px

Dense but readable layouts

Fast flows, minimal typing

Treatments optional → show clean empty state

📤 Media Rules
Allowed types: AUDIO | IMAGE | VIDEO | DOC

Show upload progress

Allow retry

Never block entire app on upload

🧾 FINAL CHECKLIST (MANDATORY)
Before shipping, SEARCH THE CODEBASE for:

"true" or "false"

disabled={ with strings

enabled={ with strings

scrollEnabled={ with strings

{...props} on RN components

If found → FIX IMMEDIATELY.

✅ SUCCESS CRITERIA
App runs on iOS without runtime errors

No dynamic type crashes

All screens wired to real APIs

Visits work with zero treatments

Light + Dark mode both stable