import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LogOut, User, Shield, Info, Smartphone, CheckCircle, Power } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useGateway } from "../../contexts/gateway-context";
import { ConfirmModal } from "../../components/confirm-modal";

export default function MoreScreen() {
  const router = useRouter();
  const { disconnectRouter } = useGateway();
  const [salesperson, setSalesperson] = useState("Unknown");
  const [displayName, setDisplayName] = useState("Salesperson");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await AsyncStorage.getItem("salesperson_name");
        const dName = await AsyncStorage.getItem("salesperson_display_name");
        if (user) setSalesperson(user);
        if (dName) setDisplayName(dName);
      } catch (e) {
        console.warn("Failed to load user info:", e);
      }
    }
    void loadUser();
  }, []);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    setIsLoggingOut(true);
    try {
      await AsyncStorage.removeItem("salesperson_name");
      await AsyncStorage.removeItem("salesperson_display_name");
      await disconnectRouter();
      
      // Brief pause so transition looks clean
      await new Promise((resolve) => setTimeout(resolve, 400));
      
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/");
      }
    } catch (e) {
      setIsLoggingOut(false);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.avatarCircle}>
            <User size={32} color="#4A60D6" />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.salespersonName}>{displayName}</Text>
            <Text style={styles.usernameSubText}>@{salesperson}</Text>
            <View style={styles.roleBadge}>
              <Shield size={12} color="#16a34a" />
              <Text style={styles.roleText}>Active Salesperson</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account & Session</Text>

          {/* Logout Button Row */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: "#fee2e2" }]}>
              <LogOut size={18} color="#ef4444" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: "#ef4444" }]}>Logout</Text>
              <Text style={styles.menuSubtitle}>Sign out and switch salesperson account</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Name</Text>
            <Text style={styles.infoValue}>Smart WiFi Recharge</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>v2.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Connected</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title="Logout Account"
        message={`Are you sure you want to log out from account "${salesperson}"?`}
        confirmText="Logout"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Loading Modal on Logout */}
      <Modal visible={isLoggingOut} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingModalCard}>
            <ActivityIndicator size="large" color="#4A60D6" />
            <Text style={styles.loggingOutText}>Logging out...</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  accountInfo: {
    flex: 1,
    gap: 4,
  },
  salespersonName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  usernameSubText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTextWrap: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  onlineText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#16a34a",
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  loggingOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
});
