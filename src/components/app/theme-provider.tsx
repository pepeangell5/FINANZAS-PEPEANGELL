"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type AppTheme = "dark" | "light";

type ThemeContextValue = {
  setTheme: (theme: AppTheme) => void;
  theme: AppTheme;
};

const THEME_STORAGE_KEY = "esp32-tools-finance-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeState(savedTheme);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function setTheme(nextTheme: AppTheme) {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  return (
    <ThemeContext.Provider value={{ setTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside ThemeProvider.");
  }

  return context;
}
