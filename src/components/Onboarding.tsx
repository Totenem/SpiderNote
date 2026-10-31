import { useCallback, useState } from "react";
import { Alert, Modal, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getSetting, setSetting } from "@/db/repository";
import { Brand, Button, Icon, Screen } from "./kit";
import { C, ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";
export function Onboarding() {
  const db = useSQLiteContext();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSetting(db, "onboarded")
        .then((value) => {
          if (active) setVisible(value !== "yes");
        })
        .catch((error) =>
          Alert.alert("Could not load preferences", errorMessage(error)),
        );
      return () => {
        active = false;
      };
    }, [db]),
  );
  const finish = async () => {
    setBusy(true);
    try {
      await setSetting(db, "onboarded", "yes");
      setVisible(false);
    } catch (error) {
      Alert.alert("Could not save preference", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <Screen>
        <View style={{ paddingTop: 32, gap: 24 }}>
          <Brand size={70} />
          <Text style={ui.eyebrow}>WELCOME TO SPIDERNOTE</Text>
          <Text style={[ui.title, { fontSize: 40 }]}>
            A little space for{"\n"}your big thoughts.
          </Text>
          <Text style={ui.body}>Every thought, connected.</Text>
          {(
            [
              {
                icon: "mic",
                title: "Capture it.",
                text: "Record ideas, lectures, or a moment worth remembering.",
              },
              {
                icon: "shield",
                title: "Keep it close.",
                text: "Notes and audio live on this device. No account needed.",
              },
              {
                icon: "folder",
                title: "Find your thread.",
                text: "Add notebooks and tags. Search your words, even offline.",
              },
            ] as const
          ).map((item) => (
            <View key={item.title} style={ui.row}>
              <View
                style={{
                  padding: 14,
                  backgroundColor: C.pale,
                  borderRadius: 18,
                }}
              >
                <Icon name={item.icon} color={C.violet} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.heading}>{item.title}</Text>
                <Text style={ui.body}>{item.text}</Text>
              </View>
            </View>
          ))}
          <Text style={ui.caption}>
            Microphone access is requested only when you start recording. Cloud
            AI is not enabled in this build. Export important notes and audio:
            uninstalling the app or clearing its storage can remove them.
          </Text>
          <Button
            label="Let’s catch a thought"
            icon="arrow"
            onPress={finish}
            busy={busy}
          />
        </View>
      </Screen>
    </Modal>
  );
}
