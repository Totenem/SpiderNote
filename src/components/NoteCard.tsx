import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Note } from "@/db/repository";
import { C, ui } from "@/theme/tokens";
import { Icon } from "./kit";
import { clock } from "@/utils/format";
export function NoteCard({ note }: { note: Note }) {
  const warning =
    note.recording_status === "interrupted" ||
    note.recording_status === "missing";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${note.title}`}
      onPress={() =>
        router.push({ pathname: "/note/[id]", params: { id: note.id } })
      }
      style={({ pressed }) => [
        ui.card,
        { opacity: pressed ? 0.7 : 1, gap: 14 },
      ]}
    >
      <View style={ui.between}>
        <View style={ui.row}>
          <View
            style={{
              backgroundColor: note.recording_id ? C.pale : "#F4F0E6",
              padding: 10,
              borderRadius: 13,
            }}
          >
            <Icon
              name={note.recording_id ? "mic" : "notes"}
              color={note.recording_id ? C.violet : "#8C6D32"}
              size={19}
            />
          </View>
          <Text style={ui.caption}>
            {note.recording_id ? clock(note.duration_ms ?? 0) : "Written note"}
          </Text>
        </View>
        {note.is_pinned ? (
          <Icon name="pin" size={16} color={C.violet} />
        ) : (
          <Text style={ui.caption}>
            {new Date(note.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        )}
      </View>
      <View style={{ gap: 7 }}>
        <Text style={ui.heading} numberOfLines={2}>
          {note.title}
        </Text>
        <Text style={ui.body} numberOfLines={2}>
          {note.body ||
            (note.recording_id
              ? "A thought captured. Add a few words to connect it."
              : "A little space for your next thought.")}
        </Text>
      </View>
      <View style={ui.between}>
        <Text style={[ui.caption, { color: warning ? C.coral : C.muted }]}>
          {warning
            ? note.recording_status === "missing"
              ? "Audio file unavailable"
              : "Interrupted · review audio"
            : note.notebook_name || "Unfiled"}
        </Text>
        <Icon name="arrow" size={18} color={C.muted} />
      </View>
    </Pressable>
  );
}
