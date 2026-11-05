import { useState } from "react";
import { Alert, Modal, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { listNotebooks, type Notebook } from "@/db/repository";
import { Button, Header, IconButton, Screen } from "./kit";
import { ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";
export function NotebookManager({ onChanged }: { onChanged: () => void }) {
  const db = useSQLiteContext();
  const [visible, setVisible] = useState(false),
    [books, setBooks] = useState<Notebook[]>([]),
    [name, setName] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const load = async () => setBooks(await listNotebooks(db));
  const save = async () => {
    if (busy || !name.trim()) return;
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
          "INSERT INTO notebooks VALUES(?,?,?)",
          randomUUID(),
          name.trim(),
          new Date().toISOString(),
        );
      setEditing(null);
      setName("");
      await load();
      onChanged();
    } catch (e) {
      Alert.alert("Could not save notebook", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        label="Manage notebooks"
        secondary
        icon="folder"
        onPress={() => {
          load()
            .then(() => setVisible(true))
            .catch((e) =>
              Alert.alert("Could not open notebooks", errorMessage(e)),
            );
        }}
      />
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Screen>
          <Header
            title="Notebooks"
            onBack={() => setVisible(false)}
            right={
              <IconButton
                name="close"
                label="Close notebooks"
                onPress={() => setVisible(false)}
              />
            }
          />
          {books.map((book) => (
            <View key={book.id} style={ui.between}>
              <Text style={[ui.heading, { flex: 1 }]}>
                {book.name} · {book.count}
              </Text>
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
                onPress={() =>
                  Alert.alert(
                    "Delete notebook?",
                    "Notes and audio stay in your library as unfiled notes.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          db
                            .runAsync(
                              "DELETE FROM notebooks WHERE id=?",
                              book.id,
                            )
                            .then(async () => {
                              await load();
                              onChanged();
                            })
                            .catch((e) =>
                              Alert.alert("Could not delete", errorMessage(e)),
                            ),
                      },
                    ],
                  )
                }
              />
            </View>
          ))}
          <Text style={ui.heading}>
            {editing ? "Rename notebook" : "Create notebook"}
          </Text>
          <TextInput
            accessibilityLabel="Notebook name"
            value={name}
            onChangeText={setName}
            maxLength={60}
            style={ui.input}
          />
          <Button
            label="Save notebook"
            onPress={save}
            busy={busy}
            disabled={!name.trim()}
          />
          {editing && (
            <Button
              label="Cancel rename"
              secondary
              onPress={() => {
                setEditing(null);
                setName("");
              }}
            />
          )}
        </Screen>
      </Modal>
    </>
  );
}
