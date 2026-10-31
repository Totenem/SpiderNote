import { Alert, Linking } from "react-native";
import { REPORT_URL } from "@/features/ai/catalog";
import { errorMessage } from "@/utils/format";
export function reportAiIssue() {
  Alert.alert(
    "Open the report form?",
    "This opens your browser and a Google Form. SpiderNote will not attach recordings, transcripts, or other note content. Only submit details you choose to share.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open form",
        onPress: () => {
          Linking.openURL(REPORT_URL).catch((error) =>
            Alert.alert("Could not open the form", errorMessage(error)),
          );
        },
      },
    ],
  );
}
