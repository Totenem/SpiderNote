import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePreventRemove } from "expo-router";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useKeepAwake } from "expo-keep-awake";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";
import { beginRecording, checkpoint, finishRecording } from "@/db/repository";
import { localFiles, recordingPath, relativeAudioPath } from "@/services/files";
import { deleteNote } from "@/services/recovery";
import { Button, Icon, IconButton, Notice, Screen } from "@/components/kit";
import { C, ui } from "@/theme/tokens";
import { clock, errorMessage } from "@/utils/format";

type Phase = "idle" | "recording" | "paused" | "interrupted";
export default function RecorderScreen() {
  useKeepAwake();
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const lock = useRef(false);
  const stopping = useRef(false);
  const stopped = useRef(false);
  const duration = useRef(0);
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      directory: "document",
      isMeteringEnabled: true,
    },
    (status) => {
      if (status.hasError || (status.isFinished && !stopping.current)) {
        stopped.current = status.isFinished;
        setPhase("interrupted");
        setError(
          status.error ||
            "The recording was interrupted. Save to review any audio that reached the file.",
        );
      }
    },
  );
  const state = useAudioRecorderState(recorder, 200);
  const disablePrevention = usePreventRemove(!!session || busy, () => {
    if (busy) return;
    Alert.alert(
      "A thought is still recording.",
      "Save it before leaving, or stay here to keep recording.",
      [
        { text: "Stay here", style: "cancel" },
        { text: "Save & leave", onPress: () => save(false) },
      ],
    );
  });
  const start = async () => {
    if (lock.current || session) return;
    if (Platform.OS === "web") {
      setError("Recording is available in the Android app.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    let id: string | null = null;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionBlocked(!permission.canAskAgain);
        throw Error(
          "Microphone access is needed to record. You can still write notes without it.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: false,
        shouldPlayInBackground: false,
      });
      id = randomUUID();
      await beginRecording(db, id, recordingPath(id));
      setSession(id);
      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        directory: "document",
        fileName: id,
        isMeteringEnabled: true,
      });
      stopped.current = false;
      stopping.current = false;
      duration.current = 0;
      recorder.record();
      setPhase("recording");
    } catch (error) {
      setError(errorMessage(error));
      if (id) setPhase("interrupted");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  async function save(interrupted: boolean) {
    if (lock.current || !session) return;
    lock.current = true;
    setBusy(true);
    stopping.current = true;
    try {
      duration.current = Math.max(
        duration.current,
        state.durationMillis,
        recorder.getStatus().durationMillis,
      );
      let wasInterrupted = interrupted || phase === "interrupted";
      if (!stopped.current && recorder.getStatus().canRecord) {
        try {
          await recorder.stop();
        } catch (stopError) {
          // MediaRecorder may fail to finalize a very short or interrupted file.
          // Retain whatever reached disk and expose it for review in the library.
          if (recorder.getStatus().isRecording) throw stopError;
          wasInterrupted = true;
        }
      } else if (!stopped.current) wasInterrupted = true;
      stopped.current = true;
      const path = recorder.uri
        ? relativeAudioPath(recorder.uri)
        : recordingPath(session);
      const hasAudio = localFiles.size(path) > 0;
      await finishRecording(
        db,
        session,
        duration.current,
        path,
        !hasAudio ? "missing" : wasInterrupted ? "interrupted" : "saved",
      );
      setSession(null);
      disablePrevention();
      router.replace({ pathname: "/note/[id]", params: { id: session } });
    } catch (error) {
      setError(errorMessage(error));
      setPhase("interrupted");
    } finally {
      stopping.current = false;
      lock.current = false;
      setBusy(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      duration.current = Math.max(duration.current, status.durationMillis);
      checkpoint(db, session, duration.current).catch((error) =>
        setError(
          `Could not save a checkpoint: ${errorMessage(error)}. Save the recording now.`,
        ),
      );
    }, 2000);
    return () => clearInterval(timer);
  }, [db, recorder, session]);
  const saveOnBackground = useEffectEvent(() => {
    if (session) save(true);
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") saveOnBackground();
    });
    return () => subscription.remove();
  }, []);
  const pauseResume = () => {
    if (lock.current) return;
    try {
      if (phase === "recording") {
        recorder.pause();
        duration.current = Math.max(
          duration.current,
          recorder.getStatus().durationMillis,
        );
        setPhase("paused");
      } else {
        recorder.record();
        setPhase("recording");
      }
    } catch (error) {
      setError(errorMessage(error));
      setPhase("interrupted");
    }
  };
  const discard = () =>
    Alert.alert(
      "Discard this recording?",
      "This permanently deletes the current draft and its audio.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            if (!session || lock.current) return;
            lock.current = true;
            setBusy(true);
            stopping.current = true;
            try {
              if (!stopped.current && recorder.getStatus().canRecord) {
                await recorder.stop();
                stopped.current = true;
              }
              const pending = await deleteNote(db, localFiles, session);
              if (pending)
                Alert.alert(
                  "Cleanup pending",
                  "The recording is hidden. File cleanup will retry when you reopen the app.",
                );
              setSession(null);
              disablePrevention();
              router.replace("/");
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              stopping.current = false;
              lock.current = false;
              setBusy(false);
              await setAudioModeAsync({ allowsRecording: false }).catch(
                () => {},
              );
            }
          },
        },
      ],
    );
  const active = phase === "recording";
  const level = active
    ? Math.max(0, Math.min(1, ((state.metering ?? -60) + 60) / 60))
    : 0;
  return (
    <Screen>
      <View style={[ui.between, { paddingTop: 8 }]}>
        <IconButton
          name="close"
          label="Close recorder"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <Text style={ui.eyebrow}>A THOUGHT IN THE MAKING</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.center}>
        <Text style={[ui.title, { textAlign: "center" }]}>
          {phase === "idle"
            ? "What’s on your mind?"
            : phase === "paused"
              ? "Take your time."
              : phase === "interrupted"
                ? "Let’s keep what we can."
                : "We’re listening."}
        </Text>
        <Text style={[ui.body, { textAlign: "center" }]}>
          {phase === "idle"
            ? "No perfect words needed. Just start."
            : phase === "paused"
              ? "Your thought is on hold. Resume when you’re ready."
              : "Keep the app open. Your recording stays on this device."}
        </Text>
        <View
          style={[
            styles.status,
            { backgroundColor: active ? C.coralPale : C.pale },
          ]}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: active ? C.coral : C.violet,
            }}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: active ? C.coral : C.violet,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {busy
              ? "Please wait…"
              : phase === "idle"
                ? "READY WHEN YOU ARE"
                : phase.toUpperCase()}
          </Text>
        </View>
        <Text
          accessibilityLabel={`Elapsed ${clock(state.durationMillis)}`}
          style={styles.timer}
        >
          {clock(state.durationMillis)}
        </Text>
        <View
          accessibilityLabel={active ? "Microphone level" : "Microphone idle"}
          style={styles.meter}
        >
          {Array.from({ length: 37 }, (_, index) => (
            <View
              key={index}
              style={{
                width: 4,
                borderRadius: 3,
                height: 6 + level * (16 + (index % 5) * 10),
                backgroundColor:
                  active && index / 37 < level ? C.violet : "#DDD6EE",
              }}
            />
          ))}
        </View>
        {!session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start recording"
            disabled={busy}
            onPress={start}
            style={({ pressed }) => [
              styles.recordButton,
              { opacity: busy || pressed ? 0.6 : 1 },
            ]}
          >
            <Icon name="mic" size={42} color={C.white} />
          </Pressable>
        ) : (
          <View style={[ui.row, { marginTop: 20 }]}>
            {phase !== "interrupted" && (
              <Button
                label={active ? "Pause" : "Resume"}
                icon={active ? "pause" : "mic"}
                secondary
                onPress={pauseResume}
                disabled={busy}
              />
            )}
            <Button
              label="Stop & save"
              icon="stop"
              onPress={() => save(false)}
              busy={busy}
            />
          </View>
        )}
        <Text style={ui.caption}>
          {session
            ? "Every pause is part of the process."
            : "Tap the microphone to catch a thought."}
        </Text>
      </View>
      {error && <Notice error>{error}</Notice>}
      {permissionBlocked && (
        <Button
          label="Open microphone settings"
          secondary
          onPress={() => Linking.openSettings()}
        />
      )}
      {session && (
        <Button
          label="Discard recording"
          icon="trash"
          secondary
          onPress={discard}
          disabled={busy}
        />
      )}
      <View style={[ui.row, { justifyContent: "center", paddingBottom: 24 }]}>
        <Icon name="shield" color={C.mint} size={16} />
        <Text style={ui.caption}>Stored locally. No uploads.</Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  center: { alignItems: "center", paddingTop: 30, gap: 20 },
  status: {
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  timer: {
    fontSize: 68,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    color: C.midnight,
    letterSpacing: -3,
  },
  meter: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: "100%",
  },
  recordButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: C.violet,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#E5DDF8",
    marginTop: 8,
    marginBottom: 10,
  },
});
