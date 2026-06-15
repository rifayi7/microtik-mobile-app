import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Search, ShieldAlert, Power, Wifi, ShieldCheck } from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface ActiveSession {
  id: string;
  username: string;
  routerId: string;
  routerName: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  download: string;
  upload: string;
  profile: string;
}

export default function SessionsScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (!activeRouter) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ sessions: ActiveSession[] }>(
        gatewayUrl,
        "/api/mikrotik/sessions",
        activeRouter
      );
      setSessions(payload.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadSessions(true);
  };

  const handleDisconnect = async (sessionId: string, username: string) => {
    if (!activeRouter) return;

    Alert.alert(
      "Disconnect Session",
      `Are you sure you want to disconnect ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setDisconnectingId(sessionId);
            try {
              // Call DELETE endpoint in Next.js backend
              await fetchFromGateway(
                gatewayUrl,
                "/api/mikrotik/sessions",
                activeRouter,
                {
                  method: "DELETE",
                  body: { sessionId },
                }
              );
              // Reload
              void loadSessions(true);
              Alert.alert("Success", `Disconnected session for ${username}`);
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to disconnect session"
              );
            } finally {
              setDisconnectingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(
      (s) =>
        s.username.toLowerCase().includes(search.toLowerCase()) ||
        s.ipAddress.includes(search) ||
        s.macAddress.toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  const renderItem = ({ item }: { item: ActiveSession }) => {
    const isDisconnecting = disconnectingId === item.id;

    return (
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionMain}>
            <Text style={styles.username}>{item.username}</Text>
            <View style={styles.serverBadge}>
              <Text style={styles.serverBadgeText}>{item.profile}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={() => void handleDisconnect(item.id, item.username)}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Power size={14} color="#ef5350" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>IP Address:</Text>
            <Text style={styles.detailValue}>{item.ipAddress}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MAC Address:</Text>
            <Text style={styles.macValue}>{item.macAddress}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Uptime:</Text>
            <Text style={styles.detailValue}>{item.uptime}</Text>
          </View>
          <View style={styles.trafficRow}>
            <View style={styles.trafficBox}>
              <Text style={styles.trafficLabel}>DOWNLOAD</Text>
              <Text style={styles.trafficValue}>{item.download}</Text>
            </View>
            <View style={[styles.trafficBox, styles.trafficBorderLeft]}>
              <Text style={styles.trafficLabel}>UPLOAD</Text>
              <Text style={styles.trafficValue}>{item.upload}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sessions (User, IP, MAC)..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loading && sessions.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={styles.loadingText}>Loading active sessions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef5350" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadSessions()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredSessions.length === 0 ? (
        <View style={styles.centered}>
          <Wifi size={36} color="#444" />
          <Text style={styles.emptyText}>No active sessions</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  searchBarContainer: {
    padding: 12,
    backgroundColor: "#1e1e1e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#aaa",
    marginTop: 10,
    fontSize: 15,
  },
  errorText: {
    color: "#ef5350",
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
  },
  retryBtn: {
    backgroundColor: "#f5a623",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  retryBtnText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 13,
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
  },
  sessionCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingBottom: 8,
    marginBottom: 8,
  },
  sessionMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  serverBadge: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serverBadgeText: {
    color: "#aaa",
    fontSize: 9,
    fontWeight: "bold",
  },
  disconnectBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#2d1e20",
    justifyContent: "center",
    alignItems: "center",
  },
  sessionDetails: {},
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: "#888",
  },
  detailValue: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  macValue: {
    fontSize: 11,
    color: "#ccc",
    fontFamily: "System",
  },
  trafficRow: {
    flexDirection: "row",
    backgroundColor: "#121212",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  trafficBox: {
    flex: 1,
    alignItems: "center",
  },
  trafficBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#2a2a2a",
  },
  trafficLabel: {
    fontSize: 9,
    color: "#888",
    fontWeight: "bold",
    marginBottom: 2,
  },
  trafficValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#26c6da",
  },
});
