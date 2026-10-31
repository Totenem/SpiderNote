import { router } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Button, Empty, Icon, Notice, Screen } from "@/components/kit";
import { NoteCard } from "@/components/NoteCard";
import { useNotes } from "@/hooks/use-notes";
import { C, ui } from "@/theme/tokens";

export default function Recordings() {
  const { notes, error, loading } = useNotes("", "audio");
  const record = () => router.push("/record");
  return (
    <Screen scroll={false}>
      <FlatList
        data={notes}
        keyExtractor={(note) => note.id}
        contentContainerStyle={[ui.content, { gap: 12 }]}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingTop: 24, paddingBottom: 12 }}>
            <Text style={ui.eyebrow}>YOUR VOICE, SAVED</Text>
            <Text style={ui.title}>Recordings</Text>
            <Text style={ui.body}>
              Every thought you’ve captured, in one place.
            </Text>
            <Button label="New recording" icon="mic" onPress={record} />
            <View style={ui.row}>
              <Icon name="shield" size={16} color={C.mint} />
              <Text style={ui.caption}>On this device · Available offline</Text>
            </View>
            <Text style={ui.heading}>
              {notes.length} {notes.length === 1 ? "recording" : "recordings"}
            </Text>
            {error ? (
              <Notice error>{error}</Notice>
            ) : loading ? (
              <ActivityIndicator color={C.violet} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <NoteCard note={item} />}
        ListEmptyComponent={
          !loading && !error ? (
            <Empty
              title="Your first recording belongs here."
              body="Capture a thought, then come back here to listen, rename it, or add a note."
            />
          ) : undefined
        }
      />
    </Screen>
  );
}
