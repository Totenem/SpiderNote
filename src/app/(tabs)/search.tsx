import { useDeferredValue, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { Empty, Icon, IconButton, Notice, Screen } from "@/components/kit";
import { NoteCard } from "@/components/NoteCard";
import { useNotes } from "@/hooks/use-notes";
import { C, ui } from "@/theme/tokens";
export default function Search() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const { notes, error } = useNotes(deferred);
  return (
    <Screen scroll={false}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[ui.content, { gap: 12 }]}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingTop: 24, paddingBottom: 10 }}>
            <Text style={ui.eyebrow}>PICK UP A THREAD</Text>
            <Text style={ui.title}>Find a thought</Text>
            <Text style={ui.body}>
              Search titles, notes, and tags. Right here, offline.
            </Text>
            <View style={[ui.row, ui.input, { paddingVertical: 2 }]}>
              <Icon name="search" color={C.muted} />
              <TextInput
                accessibilityLabel="Search notes"
                value={query}
                onChangeText={setQuery}
                placeholder="A word, an idea, a little reminder…"
                placeholderTextColor={C.muted}
                style={{ flex: 1, minHeight: 48, color: C.ink }}
                returnKeyType="search"
              />
              {query ? (
                <IconButton
                  name="close"
                  label="Clear search"
                  onPress={() => setQuery("")}
                />
              ) : null}
            </View>
            <Text style={ui.caption}>
              {query.trim()
                ? `${notes.length} matching ${notes.length === 1 ? "note" : "notes"}`
                : "ALL YOUR NOTES"}
            </Text>
            {error && <Notice error>{error}</Notice>}
          </View>
        }
        renderItem={({ item }) => <NoteCard note={item} />}
        ListEmptyComponent={
          <Empty
            title="No thoughts found."
            body="Try another word or tag. Audio becomes searchable when you add written notes."
          />
        }
      />
    </Screen>
  );
}
