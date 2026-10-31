import { Tabs } from "expo-router";
import { Icon } from "@/components/kit";
import { C } from "@/theme/tokens";
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.violet,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.line,
          paddingTop: 10,
          height: 82,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) => <Icon name="notes" color={color} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Record",
          tabBarIcon: ({ color }) => <Icon name="mic" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Icon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
