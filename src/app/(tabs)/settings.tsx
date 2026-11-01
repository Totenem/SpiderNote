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
import { AccountCard } from "@/components/AccountCard";
import { useSQLiteContext } from "expo-sqlite";
import { listNotes, listNotebooks, type Notebook } from "@/db/repository";
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
import { errorMessage } from "@/utils/format";
export default function Settings() {
  const immersive = useImmersiveNavigation();
  const db = useSQLiteContext();
  const [books, setBooks] = useState<Notebook[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>();
  const [name, setName] = useState("");
  const load = useCallback(async () => {
    const [notebooks, notes] = await Promise.all([
      listNotebooks(db),
      listNotes(db),
    ]);
    setBooks(notebooks);
    setCount(notes.length);
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
        <Text style={ui.title}>Settings</Text>
        <Brand size={38} />
      </View>
      {error && <Notice error>{error}</Notice>}
      <AccountCard />
      <Text style={ui.heading}>Preferences</Text>
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
            Swipe up from the bottom edge to reveal phone controls.
          </Text>
        </View>
      )}
      <Button
        label="Offline transcription"
        secondary
        onPress={() => router.push("/offline-ai")}
      />
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
      <Text style={ui.heading}>Your library</Text>
      <Button
        label="Export written notes"
        secondary
        icon="export"
        onPress={exportAll}
        busy={busy}
      />
      <Button
        label="Delete local notes & audio"
        icon="trash"
        danger
        onPress={deleteAll}
        disabled={busy}
      />
      <Text style={ui.caption}>
        Export important notes before clearing storage or uninstalling.
      </Text>
      <Text style={ui.heading}>Help</Text>
      <Button label="Report a problem" secondary onPress={reportAiIssue} />
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
