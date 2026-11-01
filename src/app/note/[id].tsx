import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
} from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  getNote,
  getTags,
  listNotebooks,
  saveNote,
  type Note,
  type Notebook,
} from "@/db/repository";
import { audioFile, exportText, localFiles } from "@/services/files";
import { deleteNote } from "@/services/recovery";
import { AudioPlayer } from "@/components/AudioPlayer";
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

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [note, setNote] = useState<Note | null>(null);
  const [books, setBooks] = useState<Notebook[]>([]);
  const [title, setTitle] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [notebook, setNotebook] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const disablePrevention = usePreventRemove(
    dirty || busy || editingTitle,
    ({ repeat }) => {
      if (busy) return;
      Alert.alert(
        "Keep your changes?",
        "Save this note before leaving, or discard your unsaved edits.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard edits",
            style: "destructive",
            onPress: () => {
              setDirty(false);
              setEditingTitle(false);
              repeat();
            },
          },
          {
            text: "Save & leave",
            onPress: () => {
              persist().then((saved) => {
                if (saved) repeat();
              });
            },
          },
        ],
      );
    },
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getNote(db, id), getTags(db, id), listNotebooks(db)])
        .then(([value, names, notebooks]) => {
          if (!active) return;
          if (!value) throw Error("This note is no longer available.");
          setNote(value);
          setTitle(value.title);
          setTitleDraft(value.title);
          setBody(value.body);
          setTags(names.join(", "));
          setNotebook(value.notebook_id);
          setBooks(notebooks);
          setLoaded(true);
        })
        .catch((error) => {
          if (active) {
            setError(errorMessage(error));
            setLoaded(true);
          }
        });
      return () => {
        active = false;
      };
    }, [db, id]),
  );
  async function persist() {
    if (lock.current || !note) return false;
    lock.current = true;
    setBusy(true);
    try {
      const nextTitle =
        (editingTitle ? titleDraft : title).trim() || "Untitled note";
      await saveNote(db, id, nextTitle, body, notebook, tags.split(","));
      setTitle(nextTitle);
      setTitleDraft(nextTitle);
      setEditingTitle(false);
      setDirty(false);
      setError("");
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveTitle() {
    if (lock.current || !note || !titleDraft.trim()) return;
    lock.current = true;
    setBusy(true);
    try {
      const nextTitle = titleDraft.trim();
      await db.runAsync(
        "UPDATE notes SET title=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
        nextTitle,
        new Date().toISOString(),
        id,
      );
      setTitle(nextTitle);
      setTitleDraft(nextTitle);
      setEditingTitle(false);
      setError("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const remove = () =>
    Alert.alert(
      "Delete this note?",
      "The note and its recording will be permanently removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            try {
              const pending = await deleteNote(db, localFiles, id);
              if (pending)
                Alert.alert(
                  "Cleanup pending",
                  "The note is removed from your library. Audio cleanup will retry when the app next opens.",
                );
              setDirty(false);
              setEditingTitle(false);
              disablePrevention();
              router.replace("/");
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          },
        },
      ],
    );
  const exportNote = async (markdown: boolean) => {
    const exportTitle =
      (editingTitle ? titleDraft : title).trim() || "Untitled note";
    if (await persist()) {
      try {
        await exportText(id, exportTitle, body, markdown);
      } catch (error) {
        setError(errorMessage(error));
      }
    }
  };
  const canPlay =
    note?.file_path &&
    note.recording_status !== "missing" &&
    audioFile(note.file_path).exists;
  return (
    <KeyboardAvoidingView
      style={ui.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Header
          title="Your note"
          right={
            <IconButton
              name="trash"
              label="Delete note"
              onPress={remove}
              color={C.coral}
            />
          }
        />
        {error && <Notice error>{error}</Notice>}
        {!loaded && <ActivityIndicator color={C.violet} />}
        {note && (
          <>
            <View style={ui.between}>
              <Text style={ui.eyebrow}>
                {dirty || editingTitle
                  ? "UNSAVED CHANGES"
                  : "SAVED ON THIS DEVICE"}
              </Text>
              <IconButton
                name="pin"
                label={note.is_pinned ? "Unpin note" : "Pin note"}
                color={note.is_pinned ? C.violet : C.muted}
                onPress={async () => {
                  try {
                    await db.runAsync(
                      "UPDATE notes SET is_pinned=? WHERE id=?",
                      note.is_pinned ? 0 : 1,
                      id,
                    );
                    setNote({ ...note, is_pinned: note.is_pinned ? 0 : 1 });
                  } catch (error) {
                    setError(errorMessage(error));
                  }
                }}
              />
            </View>
            <View style={ui.card}>
              <View style={ui.between}>
                <Text style={[ui.heading, { flex: 1 }]}>Note title</Text>
                {!editingTitle && (
                  <Button
                    label="Edit title"
                    secondary
                    icon="notes"
                    disabled={busy}
                    onPress={() => {
                      setTitleDraft(title);
                      setEditingTitle(true);
                    }}
                  />
                )}
              </View>
              {editingTitle ? (
                <>
                  <TextInput
                    accessibilityLabel="Note title"
                    value={titleDraft}
                    onChangeText={setTitleDraft}
                    autoFocus
                    editable={!busy}
                    multiline
                    maxLength={200}
                    placeholder="Give this thought a title"
                    placeholderTextColor={C.muted}
                    style={[
                      ui.input,
                      {
                        borderColor: C.violet,
                        fontSize: 22,
                        fontWeight: "600",
                        minHeight: 80,
                      },
                    ]}
                  />
                  <View style={ui.row}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Save title"
                        icon="check"
                        onPress={saveTitle}
                        busy={busy}
                        disabled={!titleDraft.trim()}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Cancel"
                        secondary
                        onPress={() => {
                          setTitleDraft(title);
                          setEditingTitle(false);
                        }}
                        disabled={busy}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <Text style={[ui.title, { fontSize: 28 }]}>{title}</Text>
              )}
            </View>
            <Text style={ui.caption}>
              Created {new Date(note.created_at).toLocaleString()}
            </Text>
            {canPlay ? (
              <AudioPlayer
                note={note}
                onRecovered={() => {
                  getNote(db, id)
                    .then(setNote)
                    .catch((error) => setError(errorMessage(error)));
                }}
              />
            ) : (
              note.recording_id && (
                <Notice error>
                  The original audio file is unavailable. Your written note is
                  still here. Export any important text before changing app
                  storage.
                </Notice>
              )
            )}
            <View style={{ gap: 12 }}>
              <Button
                label="Transcript & AI notes"
                secondary
                disabled={busy}
                onPress={async () => {
                  if (await persist()) {
                    disablePrevention();
                    router.push({ pathname: "/ai/[id]", params: { id } });
                  }
                }}
              />
              <Text style={ui.heading}>Note description</Text>
              <TextInput
                accessibilityLabel="Note text"
                editable={!busy}
                value={body}
                onChangeText={(value) => {
                  setBody(value);
                  setDirty(true);
                }}
                multiline
                textAlignVertical="top"
                placeholder="Connect the dots. Add your thoughts, key moments, or next steps…"
                placeholderTextColor={C.muted}
                style={[
                  ui.input,
                  { minHeight: 210, lineHeight: 26, fontSize: 16, padding: 18 },
                ]}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={ui.heading}>Notebook</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                <Chip
                  label="Unfiled"
                  selected={!notebook}
                  onPress={() => {
                    setNotebook(null);
                    setDirty(true);
                  }}
                />
                {books.map((book) => (
                  <Chip
                    key={book.id}
                    label={book.name}
                    selected={book.id === notebook}
                    onPress={() => {
                      setNotebook(book.id);
                      setDirty(true);
                    }}
                  />
                ))}
              </ScrollView>
              <Text style={ui.caption}>
                Create and manage notebooks in Settings.
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <Text style={ui.heading}>Tags</Text>
              <TextInput
                accessibilityLabel="Tags, separated by commas"
                editable={!busy}
                value={tags}
                onChangeText={(value) => {
                  setTags(value);
                  setDirty(true);
                }}
                placeholder="ideas, work, little reminders"
                placeholderTextColor={C.muted}
                style={ui.input}
                autoCapitalize="none"
                maxLength={600}
              />
              <Text style={ui.caption}>
                Separate tags with commas. Up to 20 tags per note.
              </Text>
            </View>
            <Button
              label={
                dirty || editingTitle ? "Save note" : "Saved on this device"
              }
              icon="check"
              onPress={persist}
              busy={busy}
            />
            <View style={ui.row}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Export TXT"
                  icon="export"
                  secondary
                  onPress={() => exportNote(false)}
                  disabled={busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Markdown"
                  icon="export"
                  secondary
                  onPress={() => exportNote(true)}
                  disabled={busy}
                />
              </View>
            </View>
            <Text
              style={[ui.caption, { textAlign: "center", paddingBottom: 20 }]}
            >
              Transcription works offline. Pro AI drafts require a connection.
            </Text>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
