import { useEffect } from "react";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrate } from "@/db/repository";
import { cleanDeletedNotes, reconcileRecordings } from "@/services/recovery";
import { localFiles } from "@/services/files";
import { Button } from "@/components/kit";
import { C, ui } from "@/theme/tokens";

async function initialize(db: SQLiteDatabase) {
  await migrate(db);
  await cleanDeletedNotes(db, localFiles);
  await reconcileRecordings(db, localFiles);
}
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={[ui.page, { justifyContent: "center", padding: 28, gap: 20 }]}>
      <Text style={ui.title}>Let’s try that again.</Text>
      <Text style={ui.body}>{error.message}</Text>
      <Text style={ui.body}>Your saved files have not been deleted.</Text>
      <Button label="Retry" onPress={retry} />
    </View>
  );
}
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider databaseName="spidernote.db" onInit={initialize}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.paper },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record" options={{ gestureEnabled: false }} />
          <Stack.Screen name="note/[id]" />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
