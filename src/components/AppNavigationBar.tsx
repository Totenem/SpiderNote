import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Keyboard, Platform } from "react-native";
import { NavigationBar } from "expo-navigation-bar";
import { useSQLiteContext } from "expo-sqlite";
import { getSetting, setSetting } from "@/db/repository";

const ImmersiveContext = createContext({
  hidden: true,
  update: async (_hidden: boolean) => {},
});
export const useImmersiveNavigation = () => useContext(ImmersiveContext);

export function AppNavigationBar({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let active = true;
    getSetting(db, "hide-system-navigation")
      .then((value) => {
        if (active) setHidden(value !== "no");
      })
      .catch(() => {
        /* The in-memory default remains usable if preferences cannot load. */
      });
    return () => {
      active = false;
    };
  }, [db]);
  const update = useCallback(
    async (next: boolean) => {
      await setSetting(db, "hide-system-navigation", next ? "yes" : "no");
      setHidden(next);
    },
    [db],
  );
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const restore = () => NavigationBar.setHidden(hidden);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") restore();
    });
    const keyboard = Keyboard.addListener("keyboardDidHide", restore);
    return () => {
      app.remove();
      keyboard.remove();
    };
  }, [hidden]);
  return (
    <ImmersiveContext.Provider value={{ hidden, update }}>
      {Platform.OS === "android" && (
        <NavigationBar hidden={hidden} style="light" />
      )}
      {children}
    </ImmersiveContext.Provider>
  );
}
