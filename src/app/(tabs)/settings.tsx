import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { reportAiIssue } from "@/services/feedback";
import { randomUUID } from "expo-crypto";
import Constants from "expo-constants";
import { useSQLiteContext } from "expo-sqlite";
import {
  listNotes,
  listNotebooks,
  type Notebook,
  type Recording,
} from "@/db/repository";
import { cleanDeletedNotes } from "@/services/recovery";
import { exportText, localFiles } from "@/services/files";
import {
  Brand,
  Button,
  Header,
  Icon,
  IconButton,
  Notice,
  Screen,
} from "@/components/kit";
import { C, ui } from "@/theme/tokens";
import { useImmersiveNavigation } from "@/components/AppNavigationBar";
import { bytesLabel, errorMessage } from "@/utils/format";
export default function Settings() {
  const immersive = useImmersiveNavigation();
  const db = useSQLiteContext();
  const [books, setBooks] = useState<Notebook[]>([]);
  const [count, setCount] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>();
  const [name, setName] = useState("");
  const load = useCallback(async () => {
    const [notebooks, notes, recordings] = await Promise.all([
      listNotebooks(db),
      listNotes(db),
      db.getAllAsync<Recording>("SELECT * FROM recordings"),
    ]);
    setBooks(notebooks);
    setCount(notes.length);
    setBytes(
      recordings.reduce(
        (sum, item) => sum + localFiles.size(item.file_path),
        0,
      ),
    );
  }, [db]);
  useFocusEffect(
    useCallback(() => {
      load().catch((error) => setError(errorMessage(error)));
    }, [load]),
  );
  const saveBook = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (editing)
        await db.runAsync(
          "UPDATE notebooks SET name=? WHERE id=?",
          name.trim(),
          editing,
        );
      else
        await db.runAsync(
          "INSERT INTO notebooks VALUES (?,?,?)",
          randomUUID(),
          name.trim(),
          new Date().toISOString(),
        );
      setEditing(undefined);
      setName("");
      await load();
      setError("");
    } catch (error) {
      Alert.alert("Could not save notebook", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const deleteBook = (book: Notebook) =>
    Alert.alert(
      `Delete “${book.name}”?`,
      "Your notes and recordings will stay in the library as unfiled notes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete notebook",
          style: "destructive",
          onPress: async () => {
            try {
              await db.runAsync("DELETE FROM notebooks WHERE id=?", book.id);
              await load();
            } catch (error) {
              setError(errorMessage(error));
            }
          },
        },
      ],
    );
  const exportAll = async () => {
    setBusy(true);
    try {
      const notes = await listNotes(db);
      if (!notes.length) throw Error("Create a note before exporting.");
      await exportText(
        "all-notes",
        "SpiderNote — all notes",
        notes
          .map((note) => `## ${note.title}\n\n${note.body}\n\n---`)
          .join("\n\n"),
        true,
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const deleteAll = () =>
    Alert.alert(
      "Delete all local notes and audio?",
      "This cannot be undone. Export anything you want to keep first. Exported files outside SpiderNote will not be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Permanently erase your library?",
              `${count} notes and their recordings will be removed from this device.`,
              [
                { text: "Keep my notes", style: "cancel" },
                {
                  text: "Erase library",
                  style: "destructive",
                  onPress: async () => {
                    setBusy(true);
                    try {
                      await db.runAsync(
                        "UPDATE notes SET deleted_at=?",
                        new Date().toISOString(),
                      );
                      const pending = await cleanDeletedNotes(db, localFiles);
                      await db.execAsync(
                        "DELETE FROM notebooks; DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM note_tags);",
                      );
                      await load();
                      if (pending)
                        setError(
                          "Some audio files could not be deleted. Cleanup will retry when you open the app.",
                        );
                      else setError("");
                    } catch (error) {
                      setError(errorMessage(error));
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  return (
    <Screen>
      <View style={[ui.between, { paddingTop: 24 }]}>
        <View style={{ gap: 8 }}>
          <Text style={ui.eyebrow}>MAKE YOURSELF AT HOME</Text>
          <Text style={ui.title}>Your space</Text>
        </View>
        <Brand size={44} />
      </View>
      {error && <Notice error>{error}</Notice>}
      <View
        style={[
          ui.card,
          { backgroundColor: C.midnight, borderColor: C.midnight },
        ]}
      >
        <Icon name="shield" color={C.lavender} size={28} />
        <Text style={[ui.heading, { color: C.white }]}>
          Your thoughts stay close.
        </Text>
        <Text style={[ui.body, { color: "#C8C2D9" }]}>
          Recording, playback, writing, and search work offline. No account is
          needed for your local library. This build does not upload your notes
          or audio.
        </Text>
      </View>
      <View style={ui.between}>
        <Text style={ui.heading}>Notebooks</Text>
        <IconButton
          name="plus"
          label="Create notebook"
          color={C.violet}
          onPress={() => {
            setEditing(null);
            setName("");
          }}
        />
      </View>
      <View style={ui.card}>
        {!books.length && (
          <Text style={ui.body}>
            A little structure for your threads. Create a notebook for work,
            classes, or ideas.
          </Text>
        )}
        {books.map((book) => (
          <View key={book.id} style={ui.between}>
            <View style={[ui.row, { flex: 1 }]}>
              <Icon name="folder" color={C.violet} />
              <View style={{ flex: 1 }}>
                <Text style={ui.heading} numberOfLines={1}>
                  {book.name}
                </Text>
                <Text style={ui.caption}>{book.count} notes</Text>
              </View>
            </View>
            <IconButton
              name="notes"
              label={`Rename ${book.name}`}
              onPress={() => {
                setEditing(book.id);
                setName(book.name);
              }}
            />
            <IconButton
              name="trash"
              label={`Delete ${book.name}`}
              color={C.coral}
              onPress={() => deleteBook(book)}
            />
          </View>
        ))}
      </View>
      {Platform.OS === "android" && (
        <View style={ui.card}>
          <View style={ui.between}>
            <Text style={[ui.heading, { flex: 1 }]}>
              Hide phone navigation bar
            </Text>
            <Switch
              accessibilityLabel="Hide phone navigation bar"
              value={immersive.hidden}
              trackColor={{ true: C.violet, false: C.inputBorder }}
              onValueChange={(value) =>
                immersive
                  .update(value)
                  .catch((error) => setError(errorMessage(error)))
              }
            />
          </View>
          <Text style={ui.body}>
            More room for your notes. Swipe from the bottom edge to reveal the
            phone controls. Android may also show them while the keyboard or a
            system dialog is open.
          </Text>
        </View>
      )}
      <Text style={ui.heading}>On this device</Text>
      <Button
        label="Offline AI models & benchmarks"
        secondary
        onPress={() => router.push("/offline-ai")}
      />
      <Button label="Report an AI issue" secondary onPress={reportAiIssue} />
      <View style={ui.card}>
        <View style={ui.between}>
          <Text style={ui.body}>Notes in your library</Text>
          <Text style={ui.heading}>{count}</Text>
        </View>
        <View style={ui.separator} />
        <View style={ui.between}>
          <Text style={ui.body}>Recording storage</Text>
          <Text style={ui.heading}>{bytesLabel(bytes)}</Text>
        </View>
        <Text style={ui.caption}>
          Audio size includes files waiting for confirmed deletion. Text and
          database overhead are not included.
        </Text>
      </View>
      <Button
        label="Export all written notes"
        icon="export"
        secondary
        onPress={exportAll}
        busy={busy}
      />
      <Notice>
        Keep a copy of important recordings using Audio export on each note. App
        storage is not a backup: uninstalling, clearing storage, or losing your
        device can remove your library. SQLite storage is not encrypted by this
        app.
      </Notice>
      <Text style={ui.heading}>About this build</Text>
      <View style={ui.card}>
        <Text style={ui.body}>
          SpiderNote {Constants.expoConfig?.version ?? "development"} · Android
          beta
        </Text>
        <Text style={ui.body}>
          Keep the app open while recording or processing AI. Offline
          transcription and drafts are experimental; model downloads are
          required. Use the benchmark screen to measure your phone.
        </Text>
        <Text style={ui.caption}>Every thought, connected.</Text>
      </View>
      <Button
        label="Delete all local notes & audio"
        icon="trash"
        danger
        onPress={deleteAll}
        disabled={busy}
      />
      <Modal
        visible={editing !== undefined}
        animationType="slide"
        onRequestClose={() => setEditing(undefined)}
      >
        <Screen>
          <Header
            title={editing ? "Rename notebook" : "New notebook"}
            right={
              <IconButton
                name="close"
                label="Close notebook editor"
                onPress={() => setEditing(undefined)}
              />
            }
          />
          <Text style={ui.body}>Give this thread a place to belong.</Text>
          <TextInput
            accessibilityLabel="Notebook name"
            autoFocus
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="e.g. Little big ideas"
            placeholderTextColor={C.muted}
            style={ui.input}
            onSubmitEditing={saveBook}
          />
          <Button
            label="Save notebook"
            onPress={saveBook}
            busy={busy}
            disabled={!name.trim()}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}
