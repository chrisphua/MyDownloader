import { Drawer } from "expo-router/drawer";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Platform, Pressable, Text, View } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

function MenuButton() {
  const nav = useNavigation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => nav.dispatch(DrawerActions.toggleDrawer())}
      style={{ marginLeft: 16 }}
      hitSlop={10}
      accessibilityLabel="Toggle menu"
    >
      <Text style={{ fontSize: 22, color: colors.text }}>☰</Text>
    </Pressable>
  );
}

export default function DrawerLayout() {
  const { colors } = useTheme();
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerTitleStyle: { fontWeight: "600", color: colors.text },
        drawerType: Platform.OS === "web" ? "permanent" : "front",
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
        options={{
          title: "Tasks",
          drawerLabel: "Tasks",
          drawerIcon: () => <DrawerIcon label="✓" />,
          headerLeft: () => <MenuButton />,
        }}
      />
    </Drawer>
  );
}

function DrawerIcon({ label }: { label: string }) {
  return <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, width: 20, textAlign: "center" }}>{label}</Text>;
}

function CustomDrawerContent({ state, descriptors, navigation: drawerNav }: DrawerContentComponentProps) {
  const { setIsSignedIn } = useAuth();
  const { mode, setMode } = useTheme();

  return (
    <Pressable style={{ flex: 1 }} onPress={Platform.OS !== "web" ? () => drawerNav.dispatch(DrawerActions.closeDrawer()) : undefined}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", padding: 24, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        ◈  Todo App
      </Text>

      {state.routes.map((route, i) => {
        const isFocused = state.index === i;
        const options = descriptors[route.key]?.options;
        const rawLabel = options?.drawerLabel ?? options?.title ?? route.name;
        const label = typeof rawLabel === "function"
          ? rawLabel({ color: "rgba(255,255,255,0.55)", focused: isFocused })
          : rawLabel;
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

      {/* Dark mode toggle */}
      <View style={{ margin: 8, padding: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", marginTop: "auto" }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
          Appearance
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["light", "dark", "system"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 6,
                alignItems: "center",
                backgroundColor: mode === m ? "rgba(255,255,255,0.18)" : "transparent",
                borderWidth: 1,
                borderColor: mode === m ? "rgba(255,255,255,0.3)" : "transparent",
              }}
            >
              <Text style={{ fontSize: 14 }}>
                {m === "light" ? "☀️" : m === "dark" ? "🌙" : "⚙️"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => { void signOut(); setIsSignedIn(false); }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          margin: 8,
          padding: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, width: 20, textAlign: "center" }}>⎋</Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sign out</Text>
      </Pressable>
    </Pressable>
  );
}
