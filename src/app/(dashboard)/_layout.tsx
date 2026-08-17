import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Clock,
  TrendingUp,
  Ticket,
  MoreHorizontal,
} from "lucide-react-native";
import { Platform, StyleSheet, Text, Pressable } from "react-native";
import { useGateway } from "../../contexts/gateway-context";
import { ConfirmModal } from "../../components/confirm-modal";

export default function DashboardLayout() {
  const router = useRouter();
  const { activeRouter, isConnected, disconnectRouter } = useGateway();
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Reactively navigate back to router selection when disconnected.
  useEffect(() => {
    if (!isConnected) {
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.push("/");
      }
    }
  }, [isConnected]);

  const doDisconnect = async () => {
    await disconnectRouter();
    if (Platform.OS === "web") {
      window.location.href = "/";
    } else {
      router.push("/");
    }
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectModal(false);
    await doDisconnect();
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleAlign: "left",
          headerTitleContainerStyle: {
            maxWidth: "60%",
          },
          headerRightContainerStyle: {
            paddingRight: 16,
          },
          headerStyle: {
            backgroundColor: "#ffffff",
            borderBottomWidth: 1,
            borderBottomColor: "#e2e8f0",
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            color: "#1e293b",
            fontSize: 16,
            fontWeight: "bold",
          },
          headerTitle: activeRouter ? `${activeRouter.sessionName.toUpperCase()}` : "SMART WIFI",
          headerRight: () => (
            <Pressable 
              style={({ pressed }) => [
                styles.disconnectBtn,
                pressed && { opacity: 0.6 }
              ]}
              onPress={() => setShowDisconnectModal(true)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <LogOut size={16} color="#ef4444" />
              <Text style={styles.disconnectText}>Exit</Text>
            </Pressable>
          ),
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
          },
          tabBarActiveTintColor: "#4A60D6",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="dashboard-main"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="recharge"
          options={{
            title: "Sales",
            tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: "History",
            tabBarIcon: ({ color }) => <Clock size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: "Coupon",
            tabBarIcon: ({ color }) => <Ticket size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profiles"
          options={{
            title: "More",
            tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} />,
          }}
        />
      </Tabs>

      <ConfirmModal
        visible={showDisconnectModal}
        title="Disconnect Device"
        message="Are you sure you want to disconnect from this router?"
        confirmText="Disconnect"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  disconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  disconnectText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "bold",
  },
});
