import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";
type Density = "compact" | "normal" | "comfortable";
type FontSize = "small" | "normal" | "large";

interface AppState {
  theme: Theme;
  sidebarCollapsed: boolean;
  density: Density;
  fontSize: FontSize;
  accent: string;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setDensity: (density: Density) => void;
  setFontSize: (fontSize: FontSize) => void;
  setAccent: (accent: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      density: "normal",
      fontSize: "normal",
      accent: "#0f766e",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
      setFontSize: (fontSize) => set({ fontSize }),
      setAccent: (accent) => set({ accent }),
    }),
    { name: "sigdaf-preferences" },
  ),
);
