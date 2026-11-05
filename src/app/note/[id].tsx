import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  getNote,
  getTags,
  listNotebooks,
  type Note,
  type Notebook,
} from "@/db/repository";
import {
  saveRichNote,
  acceptStructuredDraft,
} from "@/features/notes/repository";
import { plainToHtml } from "@/features/notes/content";
import { runLocalTask } from "@/features/ai/engine";
import { cancelAndWaitForAi, useAiStatus } from "@/features/ai/status";
import { type NoteFormat } from "@/features/ai/grounding";
import { audioFile, exportNotes, localFiles } from "@/services/files";
import { deleteNote } from "@/services/recovery";
import { RichNoteEditor, type EditorHandle } from "@/components/RichNoteEditor";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AiProgress } from "@/components/AiProgress";
import {
  Button,
  Chip,
  Header,
  IconButton,
  Notice,
  Screen,
} from "@/components/kit";
import { C, ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";

type Preview = { id: string; rich_html: string };
export default function NoteEditor() {
  const { id, transcribe } = useLocalSearchParams<{
    id: string;
    transcribe?: string;
  }>();
  const db = useSQLiteContext(),
    status = useAiStatus();
  const editor = useRef<EditorHandle>(null),
    lock = useRef(false),
    automatic = useRef(false);
  const [note, setNote] = useState<Note | null>(null),
    [title, setTitle] = useState(""),
    [html, setHtml] = useState(""),
    [tags, setTags] = useState("");
  const [notebook, setNotebook] = useState<string | null>(null),
    [books, setBooks] = useState<Notebook[]>([]);
  const [structured, setStructured] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(0);
  const [formatting, setFormatting] = useState(false),
    [more, setMore] = useState(false),
    [formats, setFormats] = useState(false);
  const [error, setError] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null);
  const [format, setFormat] = useState<NoteFormat>("recording_summary");
  const load = useCallback(
    async (showStructured = false) => {
      const [value, names, notebooks] = await Promise.all([
        getNote(db, id),
        getTags(db, id),
        listNotebooks(db),
      ]);
      if (!value) throw Error("This note is no longer available.");
      setNote(value);
      setTitle(value.title === "Untitled note" ? "" : value.title);
      setTags(names.join(", "));
      setBooks(notebooks);
      setNotebook(value.notebook_id);
      setHtml(
        showStructured
          ? value.structured_html
          : value.raw_html || plainToHtml(value.body),
      );
      setStructured(showStructured);
      setDirty(false);
      setKey((k) => k + 1);
      const pending = await db.getFirstAsync<Preview>(
        "SELECT id,rich_html FROM ai_drafts WHERE note_id=? AND rich_html IS NOT NULL AND reviewed_at IS NULL AND raw_source_revision=? ORDER BY created_at DESC LIMIT 1",
        id,
        value.raw_revision,
      );
      if (pending) setPreview(pending);
    },
    [db, id],
  );
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) return load();
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    if (!note || transcribe !== "1" || automatic.current) return;
    const start = () => {
      if (automatic.current || AppState.currentState !== "active") return;
      automatic.current = true;
      runLocalTask(db, id, "transcription")
        .then(() => load())
        .catch((e) => setError(errorMessage(e)));
    };
    start();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
    });
    return () => app.remove();
  }, [db, id, transcribe, note, load]);
  async function persist() {
    if (!note || lock.current || status.busy) return false;
    lock.current = true;
    setBusy(true);
    try {
      editor.current?.blur();
      Keyboard.dismiss();
      const content = (await editor.current?.getHtml()) ?? html;
      await saveRichNote(
        db,
        id,
        title,
        content,
        structured,
        notebook,
        tags.split(","),
        note.raw_revision,
      );
      const updated = await getNote(db, id);
      setNote(updated);
      setHtml(content);
      setDirty(false);
      setError("");
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const disablePrevention = usePreventRemove(dirty || busy, ({ repeat }) => {
    if (busy) return;
    Alert.alert("Keep your changes?", "Save the note before leaving.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setDirty(false);
          repeat();
        },
      },
      {
        text: "Save & leave",
        onPress: () => {
          persist().then((ok) => {
            if (ok) repeat();
          });
        },
      },
    ]);
  });
  async function switchVersion(next: boolean) {
    if (status.busy || busy) return;
    if (next === structured || !(await persist())) return;
    await load(next).catch((e) => setError(errorMessage(e)));
  }
  async function process(kind: "transcription" | "generation") {
    if (status.busy || busy || !(await persist())) return;
    setFormats(false);
    setMore(false);
    editor.current?.blur();
    Keyboard.dismiss();
    try {
      const draftId = await runLocalTask(db, id, kind, format);
      if (draftId) {
        const draft = await db.getFirstAsync<Preview>(
          "SELECT id,rich_html FROM ai_drafts WHERE id=?",
          draftId,
        );
        setPreview(draft);
      } else await load(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const transcribeAgain = () => {
    if (note?.body.trim())
      Alert.alert(
        "Replace raw text with a new transcript?",
        "The structured version and original audio will stay available.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Transcribe", onPress: () => process("transcription") },
        ],
      );
    else process("transcription");
  };
  const toolbar = (label: string, command: string, value?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || status.busy}
      onPress={() => {
        editor.current?.command(command, value);
        setFormatting(false);
      }}
      style={{ padding: 12, minWidth: 46, alignItems: "center" }}
    >
      <Text style={{ color: C.violet, fontWeight: "700", fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <KeyboardAvoidingView
      style={ui.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen scroll={false}>
        <View style={{ paddingHorizontal: 14, paddingTop: 8, gap: 8 }}>
          <View style={ui.between}>
            <IconButton
              name="back"
              label="Back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            />
            <View style={[ui.row, { gap: 0 }]}>
              {toolbar("Undo", "undo")}
              {toolbar("Redo", "redo")}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More note options"
                disabled={busy || status.busy}
                onPress={() => {
                  Keyboard.dismiss();
                  setMore(true);
                }}
                style={{ padding: 14 }}
              >
                <Text style={{ fontSize: 24, color: C.ink }}>?</Text>
              </Pressable>
              <IconButton
                name="check"
                label="Done, save note"
                color={C.violet}
                onPress={() =>
                  persist().then((ok) => {
                    if (ok) {
                      editor.current?.blur();
                      Keyboard.dismiss();
                      setFormatting(false);
                    }
                  })
                }
              />
            </View>
          </View>
          {error ? <Notice error>{error}</Notice> : null}
          <AiProgress />
          <View style={ui.row}>
            <Chip
              label="Raw"
              selected={!structured}
              onPress={() => switchVersion(false)}
            />
            <Chip
              label="Structured"
              selected={structured}
              onPress={() => switchVersion(true)}
            />
            <Text style={[ui.caption, { flex: 1 }]}>
              {dirty ? "Unsaved changes" : "Saved locally"}
            </Text>
          </View>
          {structured &&
          note?.structured_html &&
          note.structured_source_revision !== note.raw_revision ? (
            <Text style={[ui.caption, { color: C.coral }]}>
              Raw note changed. Regenerate to update this version.
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Note title"
            placeholder="Title"
            placeholderTextColor={C.muted}
            value={title}
            editable={!busy && !status.busy}
            onChangeText={(value) => {
              setTitle(value);
              setDirty(true);
            }}
            style={[ui.title, { paddingHorizontal: 10, paddingVertical: 12 }]}
            maxLength={200}
          />
        </View>
        <View
          style={{ flex: 1 }}
          pointerEvents={busy || status.busy ? "none" : "auto"}
        >
          {note ? (
            <RichNoteEditor
              key={key}
              ref={editor}
              initialHtml={html}
              onChange={(value) => {
                setHtml(value);
                setDirty(true);
              }}
            />
          ) : (
            <Text style={[ui.body, { padding: 24 }]}>Opening note�</Text>
          )}
        </View>
        <View
          style={{
            marginHorizontal: 18,
            marginBottom: 12,
            backgroundColor: C.pale,
            borderRadius: 28,
            flexDirection: "row",
            justifyContent: "space-around",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Formatting"
            disabled={busy || status.busy}
            onPress={() => {
              if (!formatting) {
                editor.current?.blur();
                Keyboard.dismiss();
              }
              setFormatting((v) => !v);
            }}
            style={{ padding: 15 }}
          >
            <Text style={[ui.heading, { color: C.violet }]}>Aa</Text>
          </Pressable>
          {toolbar("?", "checklist")}
          <Pressable
            accessibilityRole="button"
            disabled={busy || status.busy}
            onPress={() => {
              Keyboard.dismiss();
              setFormats(true);
            }}
            style={{ padding: 15 }}
          >
            <Text style={[ui.link]}>Structure note</Text>
          </Pressable>
        </View>
        {formatting && (
          <ScrollView
            style={{ maxHeight: 210, backgroundColor: C.white }}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ padding: 8 }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {["H1", "H2", "H3", "H4", "Body"].map((label, index) =>
                toolbar(
                  label,
                  "formatBlock",
                  index === 4 ? "p" : `h${index + 1}`,
                ),
              )}
              {toolbar("Bold", "bold")}
              {toolbar("Italic", "italic")}
              {toolbar("Underline", "underline")}
              {toolbar("Strike", "strikeThrough")}
              {toolbar("1. List", "insertOrderedList")}
              {toolbar("� List", "insertUnorderedList")}
              {toolbar("Indent", "indent")}
              {toolbar("Outdent", "outdent")}
              {toolbar("Left", "justifyLeft")}
              {toolbar("Center", "justifyCenter")}
              {toolbar("Right", "justifyRight")}
            </View>
          </ScrollView>
        )}
      </Screen>
      <Modal
        visible={formats}
        animationType="slide"
        onRequestClose={() => setFormats(false)}
      >
        <Screen>
          <Header
            title="Structure offline"
            onBack={() => setFormats(false)}
            right={
              <IconButton
                name="close"
                label="Close"
                onPress={() => setFormats(false)}
              />
            }
          />
          <Text style={ui.body}>
            Organize your raw note using the bundled model. Review the result
            before saving; your raw text stays intact.
          </Text>
          {(
            [
              { id: "recording_summary", name: "General structured note" },
              { id: "meeting_minutes", name: "Meeting notes" },
              { id: "study_notes", name: "Study notes" },
              { id: "action_checklist", name: "Action checklist" },
            ] as const
          ).map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              selected={format === item.id}
              onPress={() => setFormat(item.id)}
            />
          ))}
          <Button
            label="Generate structured version"
            onPress={() => process("generation")}
            disabled={busy || status.busy}
          />
        </Screen>
      </Modal>
      <Modal
        visible={!!preview}
        animationType="slide"
        onRequestClose={() => setPreview(null)}
      >
        <Screen scroll={false}>
          <View style={{ padding: 20, gap: 12 }}>
            <Header
              title="Review structured note"
              onBack={() => setPreview(null)}
            />
            <Text style={ui.caption}>
              AI can make mistakes. Check the result against your raw note.
            </Text>
          </View>
          {preview && (
            <RichNoteEditor
              key={preview.id}
              initialHtml={preview.rich_html}
              editable={false}
              onChange={() => {}}
            />
          )}
          <View style={{ padding: 20, gap: 10 }}>
            <Button
              label="Save structured version"
              disabled={busy}
              onPress={async () => {
                if (!preview || lock.current) return;
                lock.current = true;
                setBusy(true);
                try {
                  await acceptStructuredDraft(db, preview.id);
                  setPreview(null);
                  await load(true);
                } catch (e) {
                  Alert.alert("Could not save", errorMessage(e));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            />
            <Button
              label="Retry"
              secondary
              onPress={() => {
                setPreview(null);
                process("generation");
              }}
            />
            <Button
              label="Discard"
              secondary
              onPress={() => {
                const draft = preview;
                setPreview(null);
                if (draft)
                  db.runAsync(
                    "DELETE FROM ai_drafts WHERE id=?",
                    draft.id,
                  ).catch((e) => setError(errorMessage(e)));
              }}
            />
          </View>
        </Screen>
      </Modal>
      <Modal
        visible={more}
        animationType="slide"
        onRequestClose={() => setMore(false)}
      >
        <Screen>
          <Header
            title="Note options"
            onBack={() => setMore(false)}
            right={
              <IconButton
                name="close"
                label="Close"
                onPress={() => setMore(false)}
              />
            }
          />
          {note?.file_path &&
          note.recording_status !== "missing" &&
          audioFile(note.file_path).exists ? (
            <AudioPlayer
              note={note}
              onRecovered={() => {
                getNote(db, id)
                  .then(setNote)
                  .catch((e) => setError(errorMessage(e)));
              }}
            />
          ) : note?.recording_id ? (
            <Notice error>
              Audio is unavailable. Your written note is safe.
            </Notice>
          ) : null}
          {note?.recording_id && (
            <Button
              label="Transcribe audio again"
              secondary
              onPress={transcribeAgain}
              disabled={busy || status.busy}
            />
          )}
          <Text style={ui.heading}>Notebook</Text>
          <ScrollView horizontal>
            {[
              <Chip
                key="none"
                label="Unfiled"
                selected={!notebook}
                onPress={() => {
                  setNotebook(null);
                  setDirty(true);
                }}
              />,
              ...books.map((book) => (
                <Chip
                  key={book.id}
                  label={book.name}
                  selected={notebook === book.id}
                  onPress={() => {
                    setNotebook(book.id);
                    setDirty(true);
                  }}
                />
              )),
            ]}
          </ScrollView>
          <Text style={ui.heading}>Tags</Text>
          <TextInput
            accessibilityLabel="Tags separated by commas"
            value={tags}
            onChangeText={(value) => {
              setTags(value);
              setDirty(true);
            }}
            style={ui.input}
          />
          <Button
            label={note?.is_pinned ? "Unpin note" : "Pin note"}
            secondary
            onPress={async () => {
              await db.runAsync(
                "UPDATE notes SET is_pinned=? WHERE id=?",
                note?.is_pinned ? 0 : 1,
                id,
              );
              setNote(await getNote(db, id));
            }}
          />
          <Button
            label="Export TXT"
            secondary
            onPress={async () => {
              if (await persist()) {
                const current = await getNote(db, id);
                if (current)
                  exportNotes([current], false).catch((e) =>
                    setError(errorMessage(e)),
                  );
              }
            }}
          />
          <Button
            label="Export formatted HTML"
            secondary
            onPress={async () => {
              if (await persist()) {
                const current = await getNote(db, id);
                if (current)
                  exportNotes([current], true).catch((e) =>
                    setError(errorMessage(e)),
                  );
              }
            }}
          />
          {note?.legacy_body && note.legacy_body !== note.body ? (
            <View style={ui.card}>
              <Text style={ui.heading}>Preserved original description</Text>
              <Text selectable style={ui.body}>
                {note.legacy_body}
              </Text>
            </View>
          ) : null}
          <Button
            label="Delete note and audio"
            danger
            onPress={() =>
              Alert.alert(
                "Delete this note?",
                "This permanently removes its saved text and audio.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await cancelAndWaitForAi();
                        await deleteNote(db, localFiles, id);
                        setDirty(false);
                        setMore(false);
                        disablePrevention();
                        router.replace("/");
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    },
                  },
                ],
              )
            }
          />
        </Screen>
      </Modal>
    </KeyboardAvoidingView>
  );
}
