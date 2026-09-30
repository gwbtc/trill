import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeName =
  | "light"
  | "dark"
  | "sepia"
  | "noir"
  | "ocean"
  | "forest"
  | "gruvbox"
  | "christmas";

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  accentHover: string;
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  link: string;
  linkHover: string;
  shadow: string;
  overlay: string;
}
export type ThemeColorsType = keyof ThemeColors;

export interface ThemeTypography {
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontWeightNormal: string;
  fontWeightMedium: string;
  fontWeightSemibold: string;
  fontWeightBold: string;
}

export interface ThemeSpacing {
  spacingXs: string;
  spacingSm: string;
  spacingMd: string;
  spacingLg: string;
  spacingXl: string;
}

export interface ThemeRadius {
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusFull: string;
}

export interface ThemeTransitions {
  transitionFast: string;
  transitionNormal: string;
  transitionSlow: string;
}

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  transitions: ThemeTransitions;
}

// Common theme properties
const commonTypography: ThemeTypography = {
  fontSizeXs: "0.75rem",
  fontSizeSm: "0.875rem",
  fontSizeMd: "1rem",
  fontSizeLg: "1.125rem",
  fontSizeXl: "1.25rem",
  fontWeightNormal: "400",
  fontWeightMedium: "500",
  fontWeightSemibold: "600",
  fontWeightBold: "700",
};

const commonSpacing: ThemeSpacing = {
  spacingXs: "0.25rem",
  spacingSm: "0.5rem",
  spacingMd: "1rem",
  spacingLg: "1.5rem",
  spacingXl: "2rem",
};

const commonRadius: ThemeRadius = {
  radiusSm: "0.25rem",
  radiusMd: "0.5rem",
  radiusLg: "0.75rem",
  radiusFull: "9999px",
};

const commonTransitions: ThemeTransitions = {
  transitionFast: "150ms ease",
  transitionNormal: "250ms ease",
  transitionSlow: "350ms ease",
};

const commonThemeParts = {
  typography: commonTypography,
  spacing: commonSpacing,
  radius: commonRadius,
  transitions: commonTransitions,
};

const themes: Record<ThemeName, Theme> = {
  light: {
    name: "light",
    colors: {
      primary: "#543fd7",
      primaryHover: "#4532b8",
      secondary: "#f39c12",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#ffffff",
      surface: "#f8f9fa",
      surfaceHover: "#eef0f2",
      text: "#212529",
      textSecondary: "#566069",
      textMuted: "#8a929b",
      border: "#dee2e6",
      borderLight: "#eaecef",
      success: "#1f9d55",
      warning: "#d98c0b",
      error: "#e0476b",
      info: "#17a2b8",
      link: "#543fd7",
      linkHover: "#4532b8",
      shadow: "rgba(0, 0, 0, 0.1)",
      overlay: "rgba(21,24,28,0.45)",
    },
    ...commonThemeParts,
  },
  dark: {
    name: "dark",
    colors: {
      primary: "#7c6ef7",
      primaryHover: "#9085f9",
      secondary: "#f39c12",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#0d1117",
      surface: "#161b22",
      surfaceHover: "#21262d",
      text: "#c9d1d9",
      textSecondary: "#8b949e",
      textMuted: "#6e7681",
      border: "#30363d",
      borderLight: "#21262d",
      success: "#3fb950",
      warning: "#d29922",
      error: "#f85149",
      info: "#58a6ff",
      link: "#58a6ff",
      linkHover: "#79b8ff",
      shadow: "rgba(0, 0, 0, 0.3)",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
    ...commonThemeParts,
  },
  sepia: {
    name: "sepia",
    colors: {
      primary: "#8b4513",
      primaryHover: "#6b3410",
      secondary: "#d2691e",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#f4e8d0",
      surface: "#ede0c8",
      surfaceHover: "#e6d9c0",
      text: "#3e2723",
      textSecondary: "#5d4037",
      textMuted: "#6d4c41",
      border: "#d7ccc8",
      borderLight: "#e0d5d0",
      success: "#689f38",
      warning: "#ff9800",
      error: "#d32f2f",
      info: "#0288d1",
      link: "#8b4513",
      linkHover: "#6b3410",
      shadow: "rgba(62, 39, 35, 0.1)",
      overlay: "rgba(62, 39, 35, 0.5)",
    },
    ...commonThemeParts,
  },
  noir: {
    name: "noir",
    colors: {
      primary: "#ffffff",
      primaryHover: "#e0e0e0",
      secondary: "#808080",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#000000",
      surface: "#0a0a0a",
      surfaceHover: "#1a1a1a",
      text: "#ffffff",
      textSecondary: "#b0b0b0",
      textMuted: "#808080",
      border: "#333333",
      borderLight: "#1a1a1a",
      success: "#4caf50",
      warning: "#ff9800",
      error: "#f44336",
      info: "#2196f3",
      link: "#b0b0b0",
      linkHover: "#ffffff",
      shadow: "rgba(255, 255, 255, 0.1)",
      overlay: "rgba(0, 0, 0, 0.9)",
    },
    ...commonThemeParts,
  },
  ocean: {
    name: "ocean",
    colors: {
      primary: "#006994",
      primaryHover: "#005577",
      secondary: "#00acc1",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#e1f5fe",
      surface: "#b3e5fc",
      surfaceHover: "#81d4fa",
      text: "#01579b",
      textSecondary: "#0277bd",
      textMuted: "#4fc3f7",
      border: "#81d4fa",
      borderLight: "#b3e5fc",
      success: "#00c853",
      warning: "#ffab00",
      error: "#d50000",
      info: "#00b0ff",
      link: "#0277bd",
      linkHover: "#01579b",
      shadow: "rgba(1, 87, 155, 0.1)",
      overlay: "rgba(1, 87, 155, 0.5)",
    },
    ...commonThemeParts,
  },
  forest: {
    name: "forest",
    colors: {
      primary: "#2e7d32",
      primaryHover: "#1b5e20",
      secondary: "#689f38",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#f1f8e9",
      surface: "#dcedc8",
      surfaceHover: "#c5e1a5",
      text: "#1b5e20",
      textSecondary: "#33691e",
      textMuted: "#558b2f",
      border: "#aed581",
      borderLight: "#c5e1a5",
      success: "#4caf50",
      warning: "#ff9800",
      error: "#f44336",
      info: "#03a9f4",
      link: "#388e3c",
      linkHover: "#2e7d32",
      shadow: "rgba(27, 94, 32, 0.1)",
      overlay: "rgba(27, 94, 32, 0.5)",
    },
    ...commonThemeParts,
  },
  gruvbox: {
    name: "gruvbox",
    colors: {
      primary: "#fe8019",
      primaryHover: "#d65d0e",
      secondary: "#fabd2f",
      accent: "#2a9d8f",
      accentHover: "#238b7f",
      background: "#282828",
      surface: "#3c3836",
      surfaceHover: "#504945",
      text: "#ebdbb2",
      textSecondary: "#d5c4a1",
      textMuted: "#bdae93",
      border: "#665c54",
      borderLight: "#504945",
      success: "#b8bb26",
      warning: "#fabd2f",
      error: "#fb4934",
      info: "#83a598",
      link: "#8ec07c",
      linkHover: "#b8bb26",
      shadow: "rgba(0, 0, 0, 0.3)",
      overlay: "rgba(40, 40, 40, 0.8)",
    },
    ...commonThemeParts,
  },
  christmas: {
    name: "christmas",
    colors: {
      primary: "#D42426",
      primaryHover: "#B81E20",
      secondary: "#146B3A",
      accent: "#F8B229",
      accentHover: "#DDA025",
      background: "#FFFAFA",
      surface: "#F0F5F2",
      surfaceHover: "#E6EFEC",
      text: "#1A1A1A",
      textSecondary: "#2F2F2F",
      textMuted: "#4A4A4A",
      border: "#146B3A",
      borderLight: "#A0CEB6",
      success: "#2E8B57",
      warning: "#DAA520",
      error: "#B22222",
      info: "#20B2AA",
      link: "#146B3A",
      linkHover: "#0F522C",
      shadow: "rgba(20, 107, 58, 0.15)",
      overlay: "rgba(20, 107, 58, 0.2)",
    },
    ...commonThemeParts,
  },
};

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  availableThemes: ThemeName[];
}
export function colorToCSSVar(key: string): string {
  return `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeName;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = "light",
}) => {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const savedTheme = localStorage.getItem("theme") as ThemeName;
    if (savedTheme && themes[savedTheme]) {
      return savedTheme;
    }

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }

    return defaultTheme;
  });

  const theme = themes[themeName];

  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute("data-theme", themeName);

    // Set color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVarName = colorToCSSVar(key);
      root.style.setProperty(cssVarName, value);
    });

    // Set typography variables
    Object.entries(theme.typography).forEach(([key, value]) => {
      const cssVarName = `--${key
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace("size-", "")
        .replace("weight-", "")}`;
      root.style.setProperty(cssVarName, value);
    });

    // Set spacing variables
    Object.entries(theme.spacing).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // Set radius variables
    Object.entries(theme.radius).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // Set transition variables
    Object.entries(theme.transitions).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // Legacy variables for backward compatibility
    root.style.setProperty("--text-color", theme.colors.text);
    root.style.setProperty("--background-color", theme.colors.background);
  }, [themeName, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem("theme");
      if (!savedTheme) {
        setThemeName(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = (name: ThemeName) => {
    if (themes[name]) {
      // only an explicit choice is saved; until then the OS preference applies
      localStorage.setItem("theme", name);
      setThemeName(name);
    }
  };

  const value: ThemeContextType = {
    theme,
    themeName,
    setTheme,
    availableThemes: Object.keys(themes) as ThemeName[],
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
