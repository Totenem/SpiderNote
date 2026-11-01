import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { MODEL_CATALOG } from "@/features/ai/catalog";
import {
  deleteModel,
  downloadModel,
  isModelInstalled,
  modelFile,
} from "@/features/ai/models";
import { useAiStatus } from "@/features/ai/status";
import { AiProgress } from "@/components/AiProgress";
import { Button, Header, Screen } from "@/components/kit";
import { C, ui } from "@/theme/tokens";
import { bytesLabel, errorMessage } from "@/utils/format";
import { reportAiIssue } from "@/services/feedback";
export default function OfflineAi() {
  useKeepAwake();
  const status = useAiStatus();
  return (
    <Screen>
      <Header title="Offline transcription" />
      <Text style={ui.title}>Speech to text, on your phone.</Text>
      <Text style={ui.body}>
        Download a speech model once to transcribe recordings offline.
      </Text>
      <Text style={ui.caption}>
        Keep SpiderNote open while transcribing. Review the transcript for
        accuracy.
      </Text>
      <AiProgress />
      {modelFile("qwen3-06b-q8").exists && (
        <Button
          label="Clear unused download · 610 MB"
          secondary
          disabled={status.busy}
          onPress={() =>
            Alert.alert(
              "Clear unused download?",
              "This removes the retired note-generation model. Your recordings, transcripts and notes stay on this device.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear download",
                  onPress: () => {
                    try {
                      deleteModel("qwen3-06b-q8");
                      router.replace("/offline-ai");
                    } catch (error) {
                      Alert.alert(
                        "Could not clear download",
                        errorMessage(error),
                      );
                    }
                  },
                },
              ],
            )
          }
        />
      )}
      {MODEL_CATALOG.filter((model) => model.kind === "speech").map((model) => {
        const installed = isModelInstalled(model.id);
        return (
          <View key={model.id} style={ui.card}>
            <Text style={ui.heading}>{model.name}</Text>
            <Text style={[ui.caption, { color: installed ? C.mint : C.muted }]}>
              {installed
                ? "Downloaded · verified before use"
                : `${bytesLabel(model.bytes)} download`}{" "}
              · {model.license}
            </Text>
            <Text style={ui.body}>{model.description}</Text>
            {installed ? (
              <Button
                secondary
                label="Remove model"
                disabled={status.busy}
                onPress={() =>
                  Alert.alert(
                    "Remove this model?",
                    "Your notes, transcripts and recordings will stay on the device. You can download the model again later.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => {
                          try {
                            deleteModel(model.id);
                            router.replace("/offline-ai");
                          } catch (error) {
                            Alert.alert(
                              "Could not remove model",
                              errorMessage(error),
                            );
                          }
                        },
                      },
                    ],
                  )
                }
              />
            ) : (
              <Button
                label={`Download · ${bytesLabel(model.bytes)}`}
                disabled={status.busy}
                onPress={() =>
                  Alert.alert(
                    "Download offline model?",
                    `${bytesLabel(model.bytes)} will be downloaded from Hugging Face. Use Wi-Fi if you prefer. No recordings or note content are uploaded.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Download",
                        onPress: () => {
                          downloadModel(model.id).catch((error) =>
                            Alert.alert(
                              "Model download stopped",
                              errorMessage(error),
                            ),
                          );
                        },
                      },
                    ],
                  )
                }
              />
            )}
          </View>
        );
      })}

      <Button label="Report an AI issue" secondary onPress={reportAiIssue} />
      <Text style={ui.caption}>
        Opens your Google Form in the browser. No data is attached
        automatically.
      </Text>
    </Screen>
  );
}
