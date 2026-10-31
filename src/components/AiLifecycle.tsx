import { useEffect } from "react";
import { AppState } from "react-native";
import { cancelAiTask, getAiStatus } from "@/features/ai/status";
export function AiLifecycle() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && getAiStatus().busy) cancelAiTask();
    });
    return () => subscription.remove();
  }, []);
  return null;
}
