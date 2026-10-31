import { useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { Empty, Icon, IconButton, Notice, Screen } from "@/components/kit";
import { NoteCard } from "@/components/NoteCard";
import { useNotes } from "@/hooks/use-notes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { C, ui } from "@/theme/tokens";
export default function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query);
  const { notes, error, loading } = useNotes(debounced);
  const searching = query !== debounced;
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
                placeholder="Search titles, descriptions, or tags"
                placeholderTextColor={C.muted}
                style={{ flex: 1, minHeight: 48, color: C.ink }}
                returnKeyType="search"
                maxLength={200}
                autoCapitalize="none"
                autoCorrect={false}
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
              {searching || loading
                ? "Searching…"
                : query.trim()
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
            body="Try a title, a word from the description, or a tag. You can combine words, like ‘meeting budget’."
          />
        }
      />
    </Screen>
  );
}
