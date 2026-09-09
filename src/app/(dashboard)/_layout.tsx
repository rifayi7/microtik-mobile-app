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
import { Platform, StyleSheet, Text, Pressable, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { ConfirmModal } from "../../components/confirm-modal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DashboardLayout() {
  const router = useRouter();
  const { activeRouter, isConnected, disconnectRouter, gatewayUrl, syncRouters } = useGateway();
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const insets = useSafeAreaInsets();

  // Auth guard: Ensure operator is logged in and valid in database
  useEffect(() => {
    let isMounted = true;

    async function verifyAuthAndSession() {
      try {
        const storedUser = await AsyncStorage.getItem("salesperson_name");
        const storedUserId = await AsyncStorage.getItem("salesperson_id");
        const token = await AsyncStorage.getItem("auth_token");
        const storedGateway = await AsyncStorage.getItem("mikrotik_gateway_url") || gatewayUrl;

        if (!storedUser || storedUser === "Unknown") {
          if (Platform.OS === "web") {
            window.location.href = "/";
          } else {
            router.replace("/");
          }
          return;
        }

        // Live check against /api/mikrotik/auth/profile
        if (storedGateway) {
          const cleanBase = storedGateway.trim().replace(/\/+$/, "");
          let checkUrl = `${cleanBase}/api/mikrotik/auth/profile?`;
          if (storedUserId) checkUrl += `userId=${encodeURIComponent(storedUserId)}`;
          else checkUrl += `username=${encodeURIComponent(storedUser)}`;

          const res = await fetch(checkUrl, {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const errMsg = data.error || "Your account has been suspended or deleted by administrator.";
            if (isMounted) {
              await disconnectRouter();
              if (Platform.OS === "web") {
                alert(errMsg);
                window.location.href = "/";
              } else {
                Alert.alert("Account Suspended", errMsg, [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/");
                    },
                  },
                ]);
              }
            }
            return;
          }

          // Real-time permission sync: update allowed camps, company name, display name, and refresh routers
          const profileData = await res.json().catch(() => ({}));
          if (profileData && profileData.success && profileData.user) {
            const u = profileData.user;
            if (u.displayName) {
              await AsyncStorage.setItem("salesperson_display_name", u.displayName);
            }
            if (u.companyName) {
              await AsyncStorage.setItem("salesperson_company", u.companyName);
            }
            if (u.allowedCamps) {
              await AsyncStorage.setItem("salesperson_allowed_camps", JSON.stringify(u.allowedCamps));
            }
            // Trigger dynamic router list re-sync from server
            if (isMounted) {
              void syncRouters();
            }
          }
        }
      } catch {
        // Fallback network error
      }
    }

    void verifyAuthAndSession();

    // Periodic live session polling every 10 seconds
    const interval = setInterval(() => {
      void verifyAuthAndSession();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [gatewayUrl]);

  // Reactively navigate back to login when disconnected.
  useEffect(() => {
    if (!isConnected) {
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/");
      }
    }
  }, [isConnected]);

  const doDisconnect = async () => {
    await disconnectRouter();
    if (Platform.OS === "web") {
      window.location.href = "/";
    } else {
      router.replace("/");
    }
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectModal(false);
    await doDisconnect();
  };

  // Ensure robust bottom clearance across all mobile device types:
  // - Devices with native gesture bars / home indicator (iOS >= iPhone X, Android 10+ gesture bar)
  // - Devices with 3-button navigation bars or zero insets
  // - Web iframe/browser viewport
  const baseContentHeight = 52;
  const systemBottomInset = Math.max(insets.bottom, 0);

  // When system has gesture bar or 3-button inset, respect it with padding; otherwise provide a safety minimum
  const extraBottomPadding = systemBottomInset > 0
    ? systemBottomInset + (Platform.OS === "android" ? 6 : 4)
    : (Platform.OS === "android" ? 12 : 8);

  const totalTabHeight = baseContentHeight + extraBottomPadding;

  return (
    <>
      <Tabs
        initialRouteName="dashboard-main"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
            height: totalTabHeight,
            paddingBottom: extraBottomPadding,
            paddingTop: 4,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          },
          tabBarItemStyle: {
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 2,
          },
          tabBarActiveTintColor: "#DC2626",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarLabel: ({ focused, color, children }) => (
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: focused ? "700" : "500",
                color,
                marginTop: 2,
                textAlign: "center",
              }}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {children}
            </Text>
          ),
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
