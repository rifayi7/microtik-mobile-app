import React, { useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";
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
  Modal,
  Platform,
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

type DateFilterType = "today" | "yesterday" | "custom" | "all";

export default function HistoryScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  
  // Custom Date Modal State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

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
      } else if (dateFilter === "custom") {
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
      }

      const payload = await fetchFromGateway<{ success: boolean; sales: SalesLog[] }>(
        gatewayUrl,
        "/api/mikrotik/reports",
        null, // Pass null so history fetches across ALL camps
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
  }, [gatewayUrl, activeRouter, dateFilter, search, customStartDate, customEndDate]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory(true);
    }, [loadHistory])
  );

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

  const applyCustomDates = () => {
    setCustomModalOpen(false);
    setDateFilter("custom");
    void loadHistory();
  };

  // Compact Single Card Design
  const renderItem = ({ item }: { item: SalesLog }) => {
    const formattedTime = item.timestamp ? item.timestamp.split(" ")[1] || item.timestamp : "—";
    const formattedDate = item.timestamp ? item.timestamp.split(" ")[0] : "";

    return (
      <View style={styles.compactCard}>
        {/* Top Row: Code & Price / Status */}
        <View style={styles.cardTopRow}>
          <View style={styles.codeWrap}>
            <Text style={styles.codeText}>{item.code}</Text>
            <View style={styles.statusDot} />
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>
              AED {item.price ? item.price.toFixed(0) : (item.validity === 30 ? 32 : 16)}
            </Text>
          </View>
        </View>

        {/* Bottom Row: Plan + Mobile + Seller + Time */}
        <View style={styles.cardBottomRow}>
          <View style={styles.metaPill}>
            <Tag size={10} color="#6366f1" />
            <Text style={styles.metaPillText}>{item.validity}d</Text>
          </View>

          {item.mobile ? (
            <View style={styles.metaItem}>
              <Phone size={10} color="#64748b" />
              <Text style={styles.metaText}>{item.mobile}</Text>
            </View>
          ) : null}

          <View style={styles.metaItem}>
            <User size={10} color="#64748b" />
            <Text style={styles.metaTextSeller}>{item.seller || "Direct"}</Text>
          </View>

          <View style={[styles.metaItem, { marginLeft: "auto" }]}>
            <Clock size={10} color="#94a3b8" />
            <Text style={styles.metaTimeText}>
              {dateFilter === "today" || dateFilter === "yesterday" ? formattedTime : `${formattedDate} ${formattedTime}`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Filter & Search Section */}
      <View style={styles.topFilterContainer}>
        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={15} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code, mobile, seller..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Date Filter Pills: Today | Yesterday | Custom Date */}
        <View style={styles.datePillsRow}>
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
            style={[styles.datePill, dateFilter === "custom" && styles.datePillActive]}
            onPress={() => setCustomModalOpen(true)}
          >
            <Calendar size={12} color={dateFilter === "custom" ? "#ffffff" : "#64748b"} />
            <Text style={[styles.datePillText, dateFilter === "custom" && styles.datePillTextActive]}>
              {dateFilter === "custom" && customStartDate ? customStartDate : "Custom Date"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, dateFilter === "all" && styles.datePillActive]}
            onPress={() => setDateFilter("all")}
          >
            <Text style={[styles.datePillText, dateFilter === "all" && styles.datePillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Log List View */}
      {loading && logs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={32} color="#ef4444" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadHistory()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centered}>
          <Clock size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No recharge transactions found</Text>
          <Text style={styles.emptySubText}>
            {search || dateFilter !== "all" ? "Try adjusting your search or date filter" : "Recharged vouchers will appear here"}
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

      {/* Custom Date Range Picker Modal */}
      <Modal visible={customModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Custom Date</Text>
              <TouchableOpacity onPress={() => setCustomModalOpen(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-08-24"
                value={customStartDate}
                onChangeText={setCustomStartDate}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-08-24"
                value={customEndDate}
                onChangeText={setCustomEndDate}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApplyBtn} onPress={applyCustomDates}>
                <Text style={styles.modalApplyText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
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
  topFilterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 10,
    paddingRight: 4,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 12.5,
  },
  searchButton: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  searchButtonText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
  datePillsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  datePillActive: {
    backgroundColor: "#4A60D6",
    borderColor: "#4A60D6",
  },
  datePillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
  },
  datePillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContainer: {
    padding: 10,
    paddingBottom: 24,
    gap: 8,
  },
  compactCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  codeText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  priceBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  priceText: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "700",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  metaPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#4f46e5",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  metaTextSeller: {
    fontSize: 11,
    color: "#4A60D6",
    fontWeight: "600",
  },
  metaTimeText: {
    fontSize: 10.5,
    color: "#94a3b8",
    fontWeight: "500",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 13,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: "#4A60D6",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  emptySubText: {
    color: "#94a3b8",
    fontSize: 11.5,
    marginTop: 3,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: "#1e293b",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modalCancelText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  modalApplyBtn: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modalApplyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
