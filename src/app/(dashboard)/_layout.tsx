import React from "react";
import { Tabs, useRouter } from "expo-router";
import { useColorScheme, TouchableOpacity, Text, StyleSheet } from "react-native";
import {
  LayoutDashboard,
  Users,
  Wifi,
  ScrollText,
  LogOut,
} from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";

export default function DashboardLayout() {
  const router = useRouter();
  const { activeRouter, disconnectRouter } = useGateway();

  const handleDisconnect = async () => {
    await disconnectRouter();
    router.replace("/");
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#1e1e1e",
          borderBottomWidth: 1,
          borderBottomColor: "#2a2a2a",
        },
        headerTitleStyle: {
          color: "#fff",
          fontSize: 16,
          fontWeight: "bold",
        },
        headerTitle: activeRouter ? `${activeRouter.sessionName.toUpperCase()}` : "DASHBOARD",
        headerRight: () => (
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <LogOut size={16} color="#ef5350" />
            <Text style={styles.disconnectText}>Exit</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: "#1a1a1a",
          borderTopWidth: 1,
          borderTopColor: "#2a2a2a",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#f5a623",
        tabBarInactiveTintColor: "#888",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: "Sessions",
          tabBarIcon: ({ color, size }) => <Wifi size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: "Profiles",
          tabBarIcon: ({ color, size }) => <ScrollText size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  disconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d1e20",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 16,
    gap: 4,
  },
  disconnectText: {
    color: "#ef5350",
    fontSize: 12,
    fontWeight: "bold",
  },
});
