import { useEffect, type PropsWithChildren } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import { NavigationBar } from "expo-navigation-bar";
export function AppNavigationBar({ children }: PropsWithChildren) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const restore = () => NavigationBar.setHidden(true);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") restore();
    });
    const keyboard = Keyboard.addListener("keyboardDidHide", restore);
    return () => {
      app.remove();
      keyboard.remove();
    };
  }, []);
  return (
    <>
      {Platform.OS === "android" && <NavigationBar hidden style="light" />}
      {children}
    </>
  );
}
