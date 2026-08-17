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
} from "react-native";
import { Search, ShieldAlert, Clock, CheckCircle } from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface SalesLog {
  id?: string;
  code: string;
  validity: number;
  mobile: string;
  timestamp: string;
  seller: string;
}

export default function HistoryScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (!activeRouter) {
      setLogs([]);
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ success: boolean; sales: SalesLog[] }>(
        gatewayUrl,
        "/api/mikrotik/reports",
        activeRouter
      );
      if (payload.success && payload.sales) {
        // Sort by timestamp desc
        const sorted = [...payload.sales].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(sorted);
      } else {
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    if (!activeRouter) {
      setLogs([]);
      return;
    }
    void loadHistory();
  }, [loadHistory, activeRouter]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHistory(true);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        (log.code && log.code.toLowerCase().includes(search.toLowerCase())) ||
        (log.mobile && log.mobile.includes(search)) ||
        (log.seller && log.seller.toLowerCase().includes(search.toLowerCase()))
    );
  }, [logs, search]);

  const renderItem = ({ item }: { item: SalesLog }) => {
    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Voucher Code</Text>
            <Text style={styles.codeValue}>{item.code}</Text>
          </View>
          <View style={styles.statusBadge}>
            <CheckCircle size={12} color="#16a34a" />
            <Text style={styles.statusText}>Completed</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mobile Number</Text>
            <Text style={styles.detailValue}>{item.mobile || "N/A"}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Validity</Text>
            <Text style={styles.detailValue}>{item.validity} Days</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Salesperson</Text>
            <Text style={[styles.detailValue, { fontWeight: "bold", color: "#4A60D6" }]}>{item.seller}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.timeValue}>{item.timestamp}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search history (Mobile, Code, User)..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loading && logs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadHistory()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.centered}>
          <Clock size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No recharge logs found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item, index) => item.code + index}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
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
  searchBarContainer: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
    paddingBottom: 24,
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
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
    marginBottom: 10,
  },
  codeContainer: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#4A60D6",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "bold",
  },
  cardDetails: {},
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
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
  timeValue: {
    fontSize: 12,
    color: "#475569",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
});
