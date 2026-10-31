import { router } from "expo-router";
import { Text, View } from "react-native";
import { Brand, Button, Icon, Screen } from "@/components/kit";
import { C, ui } from "@/theme/tokens";
export default function Capture() {
  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 48, gap: 24 }}>
        <Brand size={78} />
        <Text style={ui.eyebrow}>FOLLOW YOUR TRAIN OF THOUGHT</Text>
        <Text style={[ui.title, { textAlign: "center", fontSize: 38 }]}>
          Good ideas don’t{"\n"}wait for a keyboard.
        </Text>
        <Text style={[ui.body, { textAlign: "center", maxWidth: 280 }]}>
          A lecture, a fleeting idea, a note to your future self. Give it a
          place to land.
        </Text>
        <View style={{ width: "100%", marginVertical: 22 }}>
          <Button
            label="Start a recording"
            icon="mic"
            onPress={() => router.push("/record")}
          />
        </View>
        <View style={ui.row}>
          <Icon name="shield" color={C.mint} />
          <Text style={ui.body}>On this device. In your control.</Text>
        </View>
        <Text style={[ui.caption, { textAlign: "center" }]}>
          Keep SpiderNote open while recording. You can pause, resume, and save
          when you’re ready.
        </Text>
      </View>
    </Screen>
  );
}
