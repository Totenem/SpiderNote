import { Text, View } from "react-native";
import { cancelAiTask, useAiStatus } from "@/features/ai/status";
import { Button, Notice } from "./kit";
import { C, ui } from "@/theme/tokens";
export function AiProgress() {
  const status = useAiStatus();
  if (!status.busy)
    return status.error ? <Notice error>{status.error}</Notice> : null;
  return (
    <View style={ui.card}>
      <Text accessibilityLiveRegion="polite" style={ui.heading}>
        {status.phase}
      </Text>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.line }}>
        <View
          style={{
            width: `${Math.round(status.progress * 100)}%`,
            height: 5,
            backgroundColor: C.violet,
          }}
        />
      </View>
      <Text style={ui.caption}>
        Keep SpiderNote open. Leaving the app cancels processing safely.
      </Text>
      <Button label="Cancel task" secondary onPress={cancelAiTask} />
    </View>
  );
}
