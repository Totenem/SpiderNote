import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import {
  Brand,
  Button,
  Chip,
  Empty,
  Icon,
  Notice,
  Screen,
} from "@/components/kit";
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
            <View style={{ gap: 6 }}>
              <Text style={ui.eyebrow}>
                YOUR THOUGHTS, A LITTLE MORE CONNECTED
              </Text>
              <Text style={ui.title}>Your web of notes</Text>
              <Text style={ui.body}>A home for everything on your mind.</Text>
            </View>
            <View style={styles.hero}>
              <View style={styles.heroLine} />
              <View style={{ gap: 12 }}>
                <Text style={styles.heroKicker}>MAKE ROOM FOR AN IDEA</Text>
                <Text style={styles.heroTitle}>
                  Think out loud.{"\n"}We’ll keep the thread.
                </Text>
                <Text style={styles.heroText}>
                  One tap. Just you and your thoughts.
                </Text>
              </View>
              <Button
                label="Start recording"
                icon="mic"
                onPress={() => router.push("/record")}
              />
              <View style={ui.row}>
                <Icon name="shield" color={C.lavender} size={14} />
                <Text style={{ color: C.lavender, fontSize: 11 }}>
                  Saved on your device · Works offline
                </Text>
              </View>
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
const styles = StyleSheet.create({
  hero: {
    backgroundColor: C.midnight,
    borderRadius: 28,
    padding: 25,
    gap: 20,
    overflow: "hidden",
  },
  heroKicker: {
    color: C.lavender,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
  },
  heroTitle: {
    color: C.white,
    fontWeight: "700",
    fontSize: 29,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroText: { color: "#C8C2D9", fontSize: 13 },
  heroLine: {
    position: "absolute",
    width: 150,
    height: 150,
    borderWidth: 1,
    borderColor: "#3D315C",
    borderRadius: 75,
    right: -65,
    top: -30,
  },
});
