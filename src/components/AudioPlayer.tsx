import { useEffect, useRef, useState } from "react";
import { Text, View, Alert } from "react-native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import Slider from "@react-native-community/slider";
import { useSQLiteContext } from "expo-sqlite";
import * as Sharing from "expo-sharing";
import type { Note } from "@/db/repository";
import { audioFile } from "@/services/files";
import { Button, Chip, Icon, Notice } from "./kit";
import { C, ui } from "@/theme/tokens";
import { clock, errorMessage } from "@/utils/format";
export function AudioPlayer({
  note,
  onRecovered,
}: {
  note: Note;
  onRecovered: () => void;
}) {
  const db = useSQLiteContext();
  const uri = audioFile(note.file_path!).uri;
  const player = useAudioPlayer(uri, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const restored = useRef(false);
  const lastBucket = useRef(-1);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (status.isLoaded && !restored.current) {
      restored.current = true;
      player
        .seekTo(
          Math.min(
            (note.position_ms ?? 0) / 1000,
            Math.max(0, status.duration - 0.2),
          ),
        )
        .catch((error) => setError(errorMessage(error)));
    }
  }, [status.isLoaded, status.duration, note.position_ms, player]);
  useEffect(() => {
    if (!restored.current || !status.isLoaded) return;
    const bucket = Math.floor(status.currentTime / 2);
    if (bucket !== lastBucket.current || status.didJustFinish) {
      lastBucket.current = bucket;
      db.runAsync(
        "UPDATE recordings SET position_ms=? WHERE id=?",
        status.didJustFinish ? 0 : Math.round(status.currentTime * 1000),
        note.recording_id,
      ).catch((error) => setError(errorMessage(error)));
    }
  }, [
    db,
    note.recording_id,
    status.currentTime,
    status.didJustFinish,
    status.isLoaded,
  ]);
  const toggle = async () => {
    try {
      setError("");
      if (status.playing) {
        player.pause();
        await db.runAsync(
          "UPDATE recordings SET position_ms=? WHERE id=?",
          Math.round(player.currentTime * 1000),
          note.recording_id,
        );
      } else {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
        if (player.currentTime >= status.duration - 0.1) await player.seekTo(0);
        player.play();
      }
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  const recover = async () => {
    try {
      await db.runAsync(
        "UPDATE recordings SET status='saved',duration_ms=? WHERE id=?",
        Math.round(status.duration * 1000),
        note.recording_id,
      );
      onRecovered();
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <View style={[ui.card, { backgroundColor: C.pale, borderColor: C.pale }]}>
      <View style={ui.between}>
        <View style={ui.row}>
          <Icon name="headphones" color={C.violet} />
          <Text style={ui.heading}>Your recording</Text>
        </View>
        <Chip
          label={`${speed}×`}
          onPress={() => {
            const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
            try {
              player.setPlaybackRate(next);
              setSpeed(next);
            } catch (error) {
              setError(errorMessage(error));
            }
          }}
        />
      </View>
      <Slider
        accessibilityLabel="Audio position"
        minimumValue={0}
        maximumValue={Math.max(status.duration, 1)}
        value={status.currentTime}
        disabled={!status.isLoaded}
        minimumTrackTintColor={C.violet}
        maximumTrackTintColor="#D4C9EF"
        thumbTintColor={C.violet}
        onSlidingStart={() => player.pause()}
        onSlidingComplete={(value) => {
          player
            .seekTo(value)
            .then(() =>
              db.runAsync(
                "UPDATE recordings SET position_ms=? WHERE id=?",
                Math.round(value * 1000),
                note.recording_id,
              ),
            )
            .catch((error) => setError(errorMessage(error)));
        }}
      />
      <View style={ui.between}>
        <Text style={ui.caption}>{clock(status.currentTime * 1000)}</Text>
        <Text style={ui.caption}>
          {clock(status.duration * 1000 || note.duration_ms || 0)}
        </Text>
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button
            label={status.playing ? "Pause" : "Play"}
            icon={status.playing ? "pause" : "play"}
            disabled={!status.isLoaded}
            onPress={toggle}
          />
        </View>
        <Button
          secondary
          icon="export"
          label="Audio"
          onPress={() =>
            Sharing.isAvailableAsync()
              .then((available) => {
                if (!available) throw Error("File sharing is unavailable.");
                return Sharing.shareAsync(uri, { mimeType: "audio/mp4" });
              })
              .catch((error) =>
                Alert.alert("Could not export audio", errorMessage(error)),
              )
          }
        />
      </View>
      {(error || status.error) && (
        <Notice error>{error || status.error}</Notice>
      )}
      {note.recording_status === "interrupted" && (
        <>
          <Text style={ui.body}>
            This recording was interrupted. Listen before keeping it. Some audio
            or the final seconds may be unavailable.
          </Text>
          <Button
            label="Keep recovered audio"
            secondary
            disabled={!status.isLoaded}
            onPress={recover}
          />
        </>
      )}
    </View>
  );
}
