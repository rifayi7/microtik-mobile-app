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
import {
  Search,
  ShieldAlert,
  Clock,
  CheckCircle,
  Calendar,
  X,
  Tag,
  Phone,
  User,
} from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface SalesLog {
  code: string;
  validity: number;
  mobile: string;
  timestamp: string;
  seller: string;
  price?: number;
  campName?: string;
}

type DateFilterType = "all" | "today" | "yesterday" | "this_month";

export default function HistoryScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      if (dateFilter === "today") {
        startDate = todayStr;
        endDate = todayStr;
      } else if (dateFilter === "yesterday") {
        const yest = new Date(Date.now() - 86400000);
        const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
        startDate = yestStr;
        endDate = yestStr;
      } else if (dateFilter === "this_month") {
        startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
        endDate = todayStr;
      }

      const payload = await fetchFromGateway<{ success: boolean; sales: SalesLog[] }>(
        gatewayUrl,
        "/api/mikrotik/reports",
        activeRouter,
        {
          method: "POST",
          body: {
            startDate,
            endDate,
            search: search.trim() ? search.trim() : undefined,
          },
        }
      );

      if (payload.success && payload.sales) {
        setLogs(payload.sales);
      } else {
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter, dateFilter, search]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHistory(true);
  };

  const handleSearchSubmit = () => {
    void loadHistory();
  };

  const clearSearch = () => {
    setSearch("");
  };

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
            <View style={styles.detailLabelRow}>
              <Phone size={13} color="#64748b" />
              <Text style={styles.detailLabel}>Mobile</Text>
            </View>
            <Text style={styles.detailValue}>{item.mobile || "N/A"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Tag size={13} color="#64748b" />
              <Text style={styles.detailLabel}>Plan / Validity</Text>
            </View>
            <Text style={styles.detailValue}>
              {item.validity} Days {item.price ? `(AED ${item.price.toFixed(0)})` : ""}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <User size={13} color="#64748b" />
              <Text style={styles.detailLabel}>Salesperson</Text>
            </View>
            <Text style={[styles.detailValue, { fontWeight: "700", color: "#4A60D6" }]}>
              {item.seller || "Direct"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Clock size={13} color="#64748b" />
              <Text style={styles.detailLabel}>Time</Text>
            </View>
            <Text style={styles.timeValue}>{item.timestamp || "—"}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Search & Filter Bar */}
      <View style={styles.topFilterContainer}>
        {/* Search Input with Search & Clear Button */}
        <View style={styles.searchBox}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search voucher code, mobile, seller..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Date Filter Pills */}
        <View style={styles.datePillsRow}>
          <TouchableOpacity
            style={[styles.datePill, dateFilter === "all" && styles.datePillActive]}
            onPress={() => setDateFilter("all")}
          >
            <Text style={[styles.datePillText, dateFilter === "all" && styles.datePillTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, dateFilter === "today" && styles.datePillActive]}
            onPress={() => setDateFilter("today")}
          >
            <Text style={[styles.datePillText, dateFilter === "today" && styles.datePillTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, dateFilter === "yesterday" && styles.datePillActive]}
            onPress={() => setDateFilter("yesterday")}
          >
            <Text style={[styles.datePillText, dateFilter === "yesterday" && styles.datePillTextActive]}>
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, dateFilter === "this_month" && styles.datePillActive]}
            onPress={() => setDateFilter("this_month")}
          >
            <Text style={[styles.datePillText, dateFilter === "this_month" && styles.datePillTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Log List View */}
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
      ) : logs.length === 0 ? (
        <View style={styles.centered}>
          <Clock size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No recharge transactions found</Text>
          <Text style={styles.emptySubText}>
            {search || dateFilter !== "all" ? "Try clearing your filters or search term" : "Recharged vouchers will appear here"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => `${item.code}-${index}`}
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
  topFilterContainer: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 12,
    paddingRight: 4,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 13,
  },
  searchButton: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  searchButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  datePillsRow: {
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  datePillActive: {
    backgroundColor: "#4A60D6",
    borderColor: "#4A60D6",
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  datePillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
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
    fontSize: 14,
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
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
  },
  emptySubText: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  codeContainer: {
    gap: 2,
  },
  codeLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  codeValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "700",
  },
  cardDetails: {
    padding: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "600",
  },
  timeValue: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },
});
