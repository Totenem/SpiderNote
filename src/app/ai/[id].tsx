import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useKeepAwake } from "expo-keep-awake";
import { getNote } from "@/db/repository";
import { FORMATS, type NoteFormat } from "@/features/ai/grounding";
import {
  acceptDraft,
  getDrafts,
  getJobs,
  getTranscript,
  restoreDescription,
  saveTranscript,
  type Draft,
  type Job,
  type Transcript,
} from "@/features/ai/repository";
import { runNoteAi } from "@/features/ai/engine";
import { useAiStatus } from "@/features/ai/status";
import { type ModelId } from "@/features/ai/catalog";
import { AiProgress } from "@/components/AiProgress";
import { Button, Chip, Header, Notice, Screen } from "@/components/kit";
import { reportAiIssue } from "@/services/feedback";
import { C, ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";

export default function AiNote() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const status = useAiStatus();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [format, setFormat] = useState<NoteFormat>("recording_summary");
  const [speechModel, setSpeechModel] = useState<ModelId>("whisper-base-q8");
  const [language, setLanguage] = useState<"auto" | "en" | "tl">("auto");
  const load = useCallback(async () => {
    const [value, results, history] = await Promise.all([
      getTranscript(db, id),
      getDrafts(db, id),
      getJobs(db, id),
    ]);
    setTranscript(value);
    setText(value?.content ?? "");
    setDrafts(results);
    setJobs(history);
    setDirty(false);
  }, [db, id]);
  useFocusEffect(
    useCallback(() => {
      load().catch((error) => setError(errorMessage(error)));
    }, [load]),
  );
  usePreventRemove(dirty, ({ repeat }) =>
    Alert.alert(
      "Keep transcript edits?",
      "Save your corrections before leaving.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard edits",
          style: "destructive",
          onPress: () => {
            setDirty(false);
            repeat();
          },
        },
        {
          text: "Save & leave",
          onPress: () => {
            saveText().then((saved) => {
              if (saved) repeat();
            });
          },
        },
      ],
    ),
  );
  const run = async (transcribe: boolean, generate: boolean) => {
    if (dirty) {
      setError("Save or cancel transcript edits before processing.");
      return;
    }
    setError("");
    try {
      await runNoteAi(db, id, {
        transcribe,
        generate,
        format,
        speechModel,
        language,
      });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      await load().catch((error) => setError(errorMessage(error)));
    }
  };
  const start = (generate: boolean) => {
    if (transcript)
      Alert.alert(
        "Replace the transcript?",
        "A fresh transcription will replace the saved transcript. Older drafts will remain visible but cannot be accepted against a newer transcript.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Transcribe again", onPress: () => run(true, generate) },
        ],
      );
    else run(true, generate);
  };
  async function saveText() {
    try {
      await saveTranscript(
        db,
        id,
        text,
        transcript?.model_id ?? "edited",
        language,
        [],
        transcript?.revision ?? 0,
      );
      await load();
      setError("");
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    }
  }
  const accept = async (draft: Draft) => {
    const note = await getNote(db, id);
    Alert.alert(
      "Use this draft as your description?",
      note?.body
        ? "Your existing description will be saved as a previous revision before replacement. Your title and recording will not change."
        : "This saves the draft into your note description. Please review it first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use draft",
          onPress: async () => {
            try {
              await acceptDraft(db, draft.id);
              router.back();
            } catch (error) {
              setError(errorMessage(error));
            }
          },
        },
      ],
    );
  };
  return (
    <Screen>
      <Header title="Turn voice into notes" />
      <Text style={ui.title}>Keep the useful threads.</Text>
      <Text style={ui.body}>
        Offline AI extracts passages from the transcript and organizes them into
        a draft. It can omit details or classify passages incorrectly. Review
        the text against the recording.
      </Text>
      <Button
        label="Manage offline models"
        secondary
        onPress={() => router.push("/offline-ai")}
        disabled={status.busy || dirty}
      />
      <AiProgress />
      {error && <Notice error>{error}</Notice>}
      <Text style={ui.heading}>Note format</Text>
      <View style={{ gap: 8 }}>
        {FORMATS.map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            selected={format === item.id}
            onPress={() => {
              if (!status.busy) setFormat(item.id);
            }}
          />
        ))}
      </View>
      <Text style={ui.heading}>Transcription model</Text>
      <View style={ui.row}>
        <Chip
          label="Base · recommended"
          selected={speechModel === "whisper-base-q8"}
          onPress={() => setSpeechModel("whisper-base-q8")}
        />
        <Chip
          label="Tiny · faster"
          selected={speechModel === "whisper-tiny-q8"}
          onPress={() => setSpeechModel("whisper-tiny-q8")}
        />
      </View>
      <Text style={ui.heading}>Spoken language</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        <Chip
          label="Auto / Taglish"
          selected={language === "auto"}
          onPress={() => setLanguage("auto")}
        />
        <Chip
          label="English"
          selected={language === "en"}
          onPress={() => setLanguage("en")}
        />
        <Chip
          label="Filipino"
          selected={language === "tl"}
          onPress={() => setLanguage("tl")}
        />
      </ScrollView>
      <Button
        label="Transcribe & generate draft"
        icon="notes"
        onPress={() => start(true)}
        disabled={status.busy || dirty}
      />
      <Button
        label="Transcribe only"
        secondary
        onPress={() => start(false)}
        disabled={status.busy || dirty}
      />
      <Text style={ui.heading}>
        Transcript {transcript ? `· revision ${transcript.revision}` : ""}
      </Text>
      <TextInput
        accessibilityLabel="Editable transcript"
        multiline
        textAlignVertical="top"
        editable={!status.busy}
        value={text}
        maxLength={100000}
        onChangeText={(value) => {
          setText(value);
          setDirty(true);
        }}
        placeholder="Your transcript will appear here. You can correct it before generating a draft."
        placeholderTextColor={C.muted}
        style={[ui.input, { minHeight: 220, lineHeight: 24 }]}
      />
      {dirty && (
        <View style={ui.row}>
          <Button
            label="Save transcript"
            onPress={saveText}
            disabled={status.busy}
          />
          <Button
            label="Cancel edits"
            secondary
            onPress={() => {
              setText(transcript?.content ?? "");
              setDirty(false);
            }}
          />
        </View>
      )}
      <Button
        label="Generate from saved transcript"
        onPress={() => run(false, true)}
        disabled={status.busy || dirty || !transcript?.content.trim()}
      />
      <Text style={ui.heading}>Drafts to review</Text>
      {!drafts.length && (
        <Text style={ui.body}>
          Generated drafts appear here. Your written description is never
          replaced automatically.
        </Text>
      )}
      {drafts.map((draft) => (
        <View key={draft.id} style={ui.card}>
          <Text style={ui.heading}>
            {FORMATS.find((item) => item.id === draft.format)?.name}
          </Text>
          <Text style={ui.caption}>
            AI-generated · transcript revision {draft.source_revision}
            {draft.source_revision !== transcript?.revision
              ? " · outdated"
              : ""}
          </Text>
          <Text selectable style={ui.body}>
            {draft.content}
          </Text>
          <Button
            label="Use draft as description"
            onPress={() =>
              accept(draft).catch((error) => setError(errorMessage(error)))
            }
            disabled={
              status.busy ||
              dirty ||
              draft.source_revision !== transcript?.revision
            }
          />
        </View>
      ))}
      <Button
        label="Restore previous description"
        secondary
        disabled={status.busy}
        onPress={() =>
          Alert.alert(
            "Restore the previous description?",
            "This restores the last description saved before accepting an AI draft.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Restore",
                onPress: () =>
                  restoreDescription(db, id)
                    .then(() => router.back())
                    .catch((error) => setError(errorMessage(error))),
              },
            ],
          )
        }
      />
      <Text style={ui.heading}>Recent processing</Text>
      {jobs.map((job) => (
        <View key={job.id} style={ui.card}>
          <Text style={ui.body}>
            {job.kind} · {job.status}
          </Text>
          {job.error_message && (
            <Text style={[ui.caption, { color: C.coral }]}>
              {job.error_message}
            </Text>
          )}
        </View>
      ))}
      <Button label="Report an AI issue" secondary onPress={reportAiIssue} />
      <Text style={ui.caption}>
        Opens the Google Form. No note content is attached.
      </Text>
    </Screen>
  );
}
