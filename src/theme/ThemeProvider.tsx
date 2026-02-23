import { createContext, useContext, useMemo, useState } from "react";

export type ThemeVariant = "classic" | "neonMenagerieOrbit" | "ecoOrganic";

interface ThemePreferenceContextValue {
  variant: ThemeVariant;
  isAltTheme: boolean;
  toggleThemeVariant: () => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  variant: "classic",
  isAltTheme: false,
  toggleThemeVariant: () => {},
});

export function ThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [variant, setVariant] = useState<ThemeVariant>("classic");

  const value = useMemo(
    () => ({
      variant,
      isAltTheme: variant !== "classic",
      toggleThemeVariant: () => {
        setVariant((current) => {
          if (current === "classic") return "neonMenagerieOrbit";
          if (current === "neonMenagerieOrbit") return "ecoOrganic";
          return "classic";
        });
      },
    }),
    [variant],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
