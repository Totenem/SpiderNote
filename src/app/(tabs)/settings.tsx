import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listNotes } from "@/db/repository";
import { cancelAndWaitForAi } from "@/features/ai/status";
import { cleanDeletedNotes } from "@/services/recovery";
import { exportNotes, localFiles } from "@/services/files";
import { reportAiIssue } from "@/services/feedback";
import { Brand, Button, Notice, Screen } from "@/components/kit";
import { ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";
export default function Settings() {
  const db = useSQLiteContext(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const exportAll = async (html: boolean) => {
    setBusy(true);
    try {
      await exportNotes(await listNotes(db), html);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const erase = () =>
    Alert.alert(
      "Delete all local notes and audio?",
      "This cannot be undone. Export anything you want to keep first. Bundled models and files exported outside SpiderNote will stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all notes and audio",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await cancelAndWaitForAi();
              await db.runAsync(
                "UPDATE notes SET deleted_at=?",
                new Date().toISOString(),
              );
              const pending = await cleanDeletedNotes(db, localFiles);
              await db.execAsync(
                "DELETE FROM notebooks; DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM note_tags); DELETE FROM ai_jobs WHERE note_id IS NULL; DELETE FROM benchmark_runs;",
              );
              setError(
                pending
                  ? "Some audio cleanup is pending. SpiderNote will retry when reopened."
                  : "",
              );
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  return (
    <Screen>
      <View style={[ui.between, { paddingTop: 24 }]}>
        <Text style={ui.title}>Settings</Text>
        <Brand size={38} />
      </View>
      {error ? <Notice error>{error}</Notice> : null}
      <Text style={ui.heading}>Export written notes</Text>
      <Text style={ui.body}>
        Export raw and structured versions. HTML keeps headings, emphasis and
        lists.
      </Text>
      <Button
        label="Export TXT"
        icon="export"
        secondary
        onPress={() => exportAll(false)}
        disabled={busy}
      />
      <Button
        label="Export formatted HTML"
        icon="export"
        secondary
        onPress={() => exportAll(true)}
        disabled={busy}
      />
      <Text style={ui.heading}>Delete local notes and audio</Text>
      <Button
        label="Delete local notes and audio"
        icon="trash"
        danger
        onPress={erase}
        disabled={busy}
      />
      <Text style={ui.heading}>Help</Text>
      <View style={ui.card}>
        <Text style={ui.heading}>Write or speak</Text>
        <Text style={ui.body}>
          Start from Write note, Record voice, or Import audio in your library.
          Voice notes are transcribed automatically. Saved audio remains
          available in the note options.
        </Text>
        <Text style={ui.heading}>Format your words</Text>
        <Text style={ui.body}>
          Tap Aa for headings, emphasis, lists and alignment. Use the checklist
          button to insert a task. Done saves the note. Undo and Redo work
          during editing.
        </Text>
        <Text style={ui.heading}>Structure offline</Text>
        <Text style={ui.body}>
          Tap Structure note to organize the raw text using Qwen3.5. Review the
          result before saving. Raw and Structured versions stay separate. AI
          may make mistakes.
        </Text>
        <Text style={ui.heading}>Your device, your notes</Text>
        <Text style={ui.body}>
          Whisper base multilingual and the structuring model are included in
          the Android build. No login or model downloads are required. Free
          storage is needed to prepare models and audio. Export before
          uninstalling or clearing app storage.
        </Text>
        <Text style={ui.body}>
          Android phone controls hide automatically. Swipe from the bottom edge
          to reveal them. Other platforms support manual notes; offline AI
          requires the Android native build.
        </Text>
        <Text style={ui.body}>
          Audio import supports M4A/AAC, MP3 and WAV below 512 MB when the phone
          can decode them. If processing fails, your saved audio stays available
          for retry.
        </Text>
      </View>
      <Button label="Report a problem" secondary onPress={reportAiIssue} />
      <Text style={ui.caption}>
        Opens an external form. No note content is attached.
      </Text>
    </Screen>
  );
}
