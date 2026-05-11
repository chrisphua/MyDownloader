import { Drawer } from "expo-router/drawer";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Pressable, Text } from "react-native";
import { DrawerActions } from "@react-navigation/native";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: "#f8f8fa" },
        headerTitleStyle: { fontWeight: "600" },
        drawerStyle: { backgroundColor: "#1c1c1e", width: 220 },
        drawerLabelStyle: { color: "#fff", fontSize: 14, fontWeight: "500" },
        drawerActiveTintColor: "#fff",
        drawerInactiveTintColor: "rgba(255,255,255,0.5)",
        drawerActiveBackgroundColor: "rgba(255,255,255,0.12)",
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="index"
        options={{ title: "Todos", drawerLabel: "Todos", drawerIcon: () => <DrawerIcon label="✓" /> }}
      />
    </Drawer>
  );
}

function DrawerIcon({ label }: { label: string }) {
  return <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, width: 20, textAlign: "center" }}>{label}</Text>;
}

function CustomDrawerContent({ state, descriptors, navigation: drawerNav }: DrawerContentComponentProps) {
  const { setIsSignedIn } = useAuth();

  return (
    <Pressable style={{ flex: 1 }} onPress={() => drawerNav.dispatch(DrawerActions.closeDrawer())}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", padding: 24, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        ◈  Todo App
      </Text>

      {state.routes.map((route, i) => {
        const options = descriptors[route.key]?.options;
        const rawLabel = options?.drawerLabel ?? options?.title ?? route.name;
        const label = typeof rawLabel === "function"
          ? rawLabel({ color: "rgba(255,255,255,0.55)", focused: isFocused })
          : rawLabel;
        const isFocused = state.index === i;
        return (
          <Pressable
            key={route.key}
            onPress={() => drawerNav.navigate(route.name)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              margin: 8,
              padding: 12,
              borderRadius: 8,
              backgroundColor: isFocused ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            {options?.drawerIcon?.({ color: "rgba(255,255,255,0.7)", size: 16, focused: isFocused })}
            <Text style={{ color: isFocused ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "500" }}>
              {label}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => { signOut(); setIsSignedIn(false); }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          margin: 8,
          padding: 12,
          borderRadius: 8,
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, width: 20, textAlign: "center" }}>⎋</Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sign out</Text>
      </Pressable>
    </Pressable>
  );
}
