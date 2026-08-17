import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { Search, ShieldAlert, BookOpen, Users, Clock, Zap, LogOut, Power, Activity } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface UserProfile {
  id: string;
  name: string;
  sharedUsers: number;
  rateLimit: string;
  sessionTimeout: string;
  idleTimeout: string;
  validity: string;
  price: number;
  currency: string;
  routerCount: number;
}

import { ConfirmModal } from "../../components/confirm-modal";

export default function MoreScreen() {
  const router = useRouter();
  const { gatewayUrl, activeRouter, disconnectRouter } = useGateway();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [salesperson, setSalesperson] = useState("Unknown");
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    async function loadSalesperson() {
      const user = await AsyncStorage.getItem("salesperson_name");
      if (user) {
        setSalesperson(user);
      }
    }
    void loadSalesperson();
  }, []);

  const loadProfiles = useCallback(async (isRefresh = false) => {
    if (!activeRouter) {
      setProfiles([]);
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ profiles: UserProfile[] }>(
        gatewayUrl,
        "/api/mikrotik/profiles",
        activeRouter
      );
      setProfiles(payload.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user profiles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    if (!activeRouter) {
      setProfiles([]);
      return;
    }
    void loadProfiles();
  }, [loadProfiles, activeRouter]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadProfiles(true);
  };

  const navigateToRoot = () => {
    if (Platform.OS === "web") {
      window.location.href = "/";
    } else {
      router.replace("/");
    }
  };

  const handleExitRouter = () => {
    setConfirmModal({
      visible: true,
      title: "Disconnect Device",
      message: "Are you sure you want to disconnect from this router?",
      confirmText: "Disconnect",
      action: async () => {
        await disconnectRouter();
        navigateToRoot();
      },
    });
  };

  const handleLogoutOperator = () => {
    setConfirmModal({
      visible: true,
      title: "Operator Logout",
      message: "Are you sure you want to log out of your operator session?",
      confirmText: "Log Out",
      action: async () => {
        await AsyncStorage.removeItem("salesperson_name");
        await disconnectRouter();
        navigateToRoot();
      },
    });
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

  const renderHeader = () => (
    <View>
      {/* Active Session Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Activity size={18} color="#4A60D6" />
          <Text style={styles.cardTitle}>Active Connection</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Session Name</Text>
          <Text style={styles.detailValue}>{activeRouter?.sessionName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>IP / Hostname</Text>
          <Text style={styles.detailValue}>{activeRouter?.host}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Default Currency</Text>
          <Text style={styles.detailValue}>{activeRouter?.currency || "AED"}</Text>
        </View>
      </View>

      {/* Operator Session Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Users size={18} color="#4A60D6" />
          <Text style={styles.cardTitle}>Operator Session</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Operator Name</Text>
          <Text style={[styles.detailValue, { fontWeight: "bold", color: "#4A60D6" }]}>{salesperson}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Role Level</Text>
          <Text style={styles.detailValue}>STAFF OPERATOR</Text>
        </View>
      </View>

      {/* Speed Profiles Header */}
      <Text style={styles.sectionHeaderTitle}>Speed Profiles</Text>

      {/* Search Box */}
      <View style={styles.searchBox}>
        <Search size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search profiles..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.actionContainer}>
      <TouchableOpacity style={styles.exitBtn} onPress={handleExitRouter}>
        <Power size={18} color="#ef4444" />
        <Text style={styles.exitBtnText}>Disconnect Device</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutOperator}>
        <LogOut size={18} color="#64748b" />
        <Text style={styles.logoutBtnText}>Log Out Operator</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: UserProfile }) => {
    return (
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileTitleRow}>
            <View style={styles.avatar}>
              <BookOpen size={15} color="#4A60D6" />
            </View>
            <Text style={styles.profileName}>{item.name}</Text>
          </View>
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedText}>Shared: {item.sharedUsers}</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailBox}>
            <Zap size={13} color="#64748b" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailBoxLabel}>Rate Limit</Text>
              <Text style={styles.detailBoxValue}>{item.rateLimit || "Unlimited"}</Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            <Clock size={13} color="#64748b" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailBoxLabel}>Timeout</Text>
              <Text style={styles.detailBoxValue}>{item.sessionTimeout || "None"}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {loading && profiles.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading configurations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadProfiles()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          visible={confirmModal.visible}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={async () => {
            const act = confirmModal.action;
            setConfirmModal(null);
            await act();
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 10,
    fontSize: 15,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: "#4A60D6",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  detailValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 8,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
    marginBottom: 8,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  sharedBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sharedText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "bold",
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  detailTexts: {
    flex: 1,
  },
  detailBoxLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  detailBoxValue: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "bold",
    marginTop: 1,
  },
  actionContainer: {
    marginTop: 20,
    gap: 12,
  },
  exitBtn: {
    flexDirection: "row",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  exitBtnText: {
    color: "#ef4444",
    fontWeight: "bold",
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  logoutBtnText: {
    color: "#475569",
    fontWeight: "bold",
    fontSize: 14,
  },
});
