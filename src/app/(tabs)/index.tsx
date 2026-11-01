import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Brand, Button, Chip, Empty, Notice, Screen } from "@/components/kit";
import { NoteCard } from "@/components/NoteCard";
import { Onboarding } from "@/components/Onboarding";
import { useNotes } from "@/hooks/use-notes";
import { useCreateNote } from "@/hooks/use-create-note";
import { C, ui } from "@/theme/tokens";
export default function Library() {
  const [filter, setFilter] = useState("all");
  const [notebook, setNotebook] = useState<string>();
  const { notes, notebooks, error, loading } = useNotes("", filter, notebook);
  const { create, busy } = useCreateNote();
  return (
    <Screen scroll={false}>
      <Onboarding />
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[ui.content, { gap: 12 }]}
        ListHeaderComponent={
          <View style={{ gap: 24, paddingTop: 14, paddingBottom: 8 }}>
            <View style={ui.between}>
              <View style={ui.row}>
                <Brand size={38} />
                <Text
                  style={{
                    color: C.ink,
                    fontWeight: "800",
                    fontSize: 20,
                    letterSpacing: -0.7,
                  }}
                >
                  spidernote<Text style={{ color: C.violet }}>.</Text>
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: C.pale,
                borderRadius: 20,
                padding: 18,
                gap: 12,
              }}
            >
              <View style={{ gap: 4 }}>
                <Text style={ui.heading}>A thought worth keeping?</Text>
                <Text style={ui.caption}>
                  Record it now. Come back to it later.
                </Text>
              </View>
              <Button
                label="Start recording"
                icon="mic"
                onPress={() => router.push("/record")}
              />
            </View>
            <View style={ui.between}>
              <Text style={ui.heading}>
                Your notes{" "}
                <Text
                  style={{ color: C.muted, fontWeight: "400", fontSize: 14 }}
                >
                  {" "}
                  / {notes.length}
                </Text>
              </Text>
              <Button
                label="New note"
                icon="plus"
                secondary
                onPress={create}
                busy={busy}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Chip
                label="All notes"
                selected={filter === "all"}
                onPress={() => setFilter("all")}
              />
              <Chip
                label="Recordings"
                icon="mic"
                selected={filter === "audio"}
                onPress={() => setFilter("audio")}
              />
              <Chip
                label="Pinned"
                icon="pin"
                selected={filter === "pinned"}
                onPress={() => setFilter("pinned")}
              />
            </ScrollView>
            {notebooks.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                <Chip
                  label="All notebooks"
                  selected={!notebook}
                  onPress={() => setNotebook(undefined)}
                />
                {notebooks.map((book) => (
                  <Chip
                    key={book.id}
                    label={book.name}
                    selected={notebook === book.id}
                    onPress={() => setNotebook(book.id)}
                  />
                ))}
              </ScrollView>
            )}
            {error ? (
              <Notice error>{error}</Notice>
            ) : (
              loading && <ActivityIndicator color={C.violet} />
            )}
          </View>
        }
        renderItem={({ item }) => <NoteCard note={item} />}
        ListEmptyComponent={
          !loading && !error ? (
            <Empty
              title={
                filter === "all" && !notebook
                  ? "Your first thought belongs here."
                  : "No threads here yet."
              }
              body="Record something worth remembering, or start with a few words."
              action={
                <Button
                  label="Write a note"
                  secondary
                  icon="plus"
                  onPress={create}
                  busy={busy}
                />
              }
            />
          ) : undefined
        }
      />
    </Screen>
  );
}
