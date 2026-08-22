import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Bell, ChevronDown, Building2, Ticket, Copy, Check, Search, Filter } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface PlanCount {
  days: number;
  available_count: number;
}

interface VoucherItem {
  code: string;
  validityDays: number;
  status: string;
  usedBy: string | null;
  usedAt: string | null;
  priceCharged: number | null;
}

interface VoucherListResponse {
  vouchers: VoucherItem[];
  total: number;
  summary: Record<string, { available: number; reserved: number; redeemed: number; total: number }>;
}

export default function CouponScreen() {
  const { gatewayUrl, routers } = useGateway();
  const [salesperson, setSalesperson] = useState("iqbalapricom");
  const [campPlans, setCampPlans] = useState<Record<string, PlanCount[]>>({});
  const [campVouchers, setCampVouchers] = useState<Record<string, VoucherItem[]>>({});
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [loadingCampId, setLoadingCampId] = useState<string | null>(null);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"available" | "all">("available");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadSalesperson() {
      try {
        const name = await AsyncStorage.getItem("salesperson_name");
        if (name) setSalesperson(name);
      } catch (e) {
        console.warn("Failed to load salesperson name:", e);
      }
    }
    void loadSalesperson();
  }, []);

  const loadDataForRouter = async (routerId: string, isRefresh = false) => {
    const targetRouter = routers.find((r) => r.id === routerId);
    if (!targetRouter) return;

    if (!isRefresh) setLoadingCampId(routerId);
    try {
      // 1. Fetch available plan counts
      const plansPayload = await fetchFromGateway<PlanCount[]>(
        gatewayUrl,
        "/api/mikrotik/vouchers/plans",
        targetRouter,
        { method: "POST" }
      );
      setCampPlans((prev) => ({ ...prev, [routerId]: plansPayload || [] }));

      // 2. Fetch voucher codes list
      const listPayload = await fetchFromGateway<VoucherListResponse>(
        gatewayUrl,
        "/api/mikrotik/vouchers/list",
        targetRouter,
        {
          method: "POST",
          body: {
            status: "all",
            limit: 200,
          },
        }
      );
      if (listPayload && listPayload.vouchers) {
        setCampVouchers((prev) => ({ ...prev, [routerId]: listPayload.vouchers }));
      }
    } catch (err) {
      console.warn("Failed to fetch vouchers for camp:", routerId, err);
    } finally {
      setLoadingCampId(null);
    }
  };

  const handleToggleCamp = (routerId: string) => {
    if (selectedCampId === routerId) {
      setSelectedCampId(null);
    } else {
      setSelectedCampId(routerId);
      setSelectedPlanFilter("all");
      setSearchQuery("");
      void loadDataForRouter(routerId);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedCampId) {
      await loadDataForRouter(selectedCampId, true);
    }
    setRefreshing(false);
  };

  const handleCopyCode = async (code: string) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (e) {
      console.warn("Failed to copy code", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fafafc" />

      {/* Header Profile Info */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeTitle}>Hello {salesperson}</Text>
          <Text style={styles.welcomeSub}>Vouchers & Available Codes</Text>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Bell size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4A60D6"
            colors={["#4A60D6"]}
          />
        }
      >
        <Text style={styles.sectionTitle}>Camps Voucher Inventory</Text>

        {routers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Building2 size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No camps available.</Text>
            <Text style={[styles.emptyText, { fontSize: 11, color: "#94a3b8", marginTop: 2 }]}>
              Please configure a router in the Web Admin Portal first.
            </Text>
          </View>
        ) : (
          routers.map((routerItem) => {
            const isExpanded = selectedCampId === routerItem.id;
            const plansList = campPlans[routerItem.id] || [];
            const vouchersList = campVouchers[routerItem.id] || [];
            const isLoadingPlans = loadingCampId === routerItem.id;
            const campName = routerItem.camp || routerItem.sessionName;

            // Filter vouchers by status, plan, and search query
            const filteredVouchers = vouchersList.filter((v) => {
              if (statusFilter === "available" && v.status !== "available") return false;
              if (selectedPlanFilter !== "all" && v.validityDays !== selectedPlanFilter) return false;
              if (searchQuery.trim() && !v.code.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
                return false;
              }
              return true;
            });

            return (
              <View key={routerItem.id} style={styles.campAccordionCard}>
                {/* Accordion Header */}
                <TouchableOpacity
                  style={styles.campAccordionHeader}
                  onPress={() => handleToggleCamp(routerItem.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.campHeaderLeft}>
                    <View style={styles.campIconContainer}>
                      <Building2 size={18} color="#2e4396" />
                    </View>
                    <Text style={styles.campNameText}>{campName}</Text>
                  </View>
                  <ChevronDown
                    size={18}
                    color="#64748b"
                    style={isExpanded && { transform: [{ rotate: "180deg" }] }}
                  />
                </TouchableOpacity>

                {/* Accordion Content */}
                {isExpanded && (
                  <View style={styles.campAccordionContent}>
                    {isLoadingPlans ? (
                      <View style={styles.centeredRow}>
                        <ActivityIndicator size="small" color="#4A60D6" />
                        <Text style={styles.loadingCountsText}>Loading vouchers & codes...</Text>
                      </View>
                    ) : plansList.length === 0 && vouchersList.length === 0 ? (
                      <View style={styles.emptyStockWrapper}>
                        <Ticket size={20} color="#94a3b8" />
                        <Text style={styles.noVouchersText}>No available vouchers in stock</Text>
                      </View>
                    ) : (
                      <>
                        {/* Summary Badges by Plan */}
                        <View style={styles.accordionPlansRow}>
                          <TouchableOpacity
                            style={[
                              styles.planStockBadge,
                              selectedPlanFilter === "all" ? styles.badgeActive : styles.badgeDefault,
                            ]}
                            onPress={() => setSelectedPlanFilter("all")}
                          >
                            <Text style={selectedPlanFilter === "all" ? styles.planTextActive : styles.planTextDefault}>
                              All Plans
                            </Text>
                          </TouchableOpacity>
                          {plansList.map((p, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.planStockBadge,
                                selectedPlanFilter === p.days ? styles.badgeActive : styles.badgeDefault,
                              ]}
                              onPress={() => setSelectedPlanFilter(selectedPlanFilter === p.days ? "all" : p.days)}
                            >
                              <Text style={selectedPlanFilter === p.days ? styles.planTextActive : styles.planTextDefault}>
                                {p.days}d: <Text style={styles.planCountText}>{p.available_count}</Text>
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Search & Filter Toolbar */}
                        <View style={styles.toolbarRow}>
                          <View style={styles.searchBox}>
                            <Search size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                            <TextInput
                              style={styles.searchInput}
                              placeholder="Search code..."
                              placeholderTextColor="#94a3b8"
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              autoCapitalize="characters"
                            />
                          </View>
                          <View style={styles.statusToggleGroup}>
                            <TouchableOpacity
                              style={[
                                styles.statusToggleBtn,
                                statusFilter === "available" && styles.statusToggleBtnActive,
                              ]}
                              onPress={() => setStatusFilter("available")}
                            >
                              <Text
                                style={[
                                  styles.statusToggleText,
                                  statusFilter === "available" && styles.statusToggleTextActive,
                                ]}
                              >
                                Available
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.statusToggleBtn,
                                statusFilter === "all" && styles.statusToggleBtnActive,
                              ]}
                              onPress={() => setStatusFilter("all")}
                            >
                              <Text
                                style={[
                                  styles.statusToggleText,
                                  statusFilter === "all" && styles.statusToggleTextActive,
                                ]}
                              >
                                All
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Voucher Codes Grid / List */}
                        <Text style={styles.codesListHeader}>
                          {statusFilter === "available" ? "Available Codes" : "All Codes"} ({filteredVouchers.length})
                        </Text>

                        {filteredVouchers.length === 0 ? (
                          <View style={styles.emptyFilteredWrapper}>
                            <Text style={styles.emptyFilteredText}>No matching voucher codes found</Text>
                          </View>
                        ) : (
                          <View style={styles.codesGrid}>
                            {filteredVouchers.slice(0, 50).map((voucher) => {
                              const isCopied = copiedCode === voucher.code;
                              const isAvailable = voucher.status === "available";
                              return (
                                <TouchableOpacity
                                  key={voucher.code}
                                  style={[
                                    styles.voucherCodeCard,
                                    isAvailable ? styles.voucherCardAvailable : styles.voucherCardRedeemed,
                                  ]}
                                  onPress={() => void handleCopyCode(voucher.code)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.voucherCodeTop}>
                                    <Text style={styles.voucherDaysBadge}>{voucher.validityDays}D</Text>
                                    <View style={styles.copyIconWrapper}>
                                      {isCopied ? (
                                        <Check size={13} color="#16a34a" />
                                      ) : (
                                        <Copy size={13} color="#64748b" />
                                      )}
                                    </View>
                                  </View>
                                  <Text style={styles.voucherCodeText}>{voucher.code}</Text>
                                  <Text style={[styles.voucherStatusText, isAvailable ? styles.statusGreen : styles.statusGray]}>
                                    {voucher.status.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                        {filteredVouchers.length > 50 && (
                          <Text style={styles.moreCountText}>
                            + {filteredVouchers.length - 50} more codes available
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafc",
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fafafc",
  },
  headerLeft: {
    flexDirection: "column",
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2e4396",
  },
  welcomeSub: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 2,
  },
  bellButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#334155",
    marginTop: 20,
    marginBottom: 16,
  },
  campAccordionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#2e4396",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  campAccordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  campHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  campIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  campNameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2e4396",
  },
  campAccordionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#fcfdfe",
  },
  centeredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  loadingCountsText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyStockWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  noVouchersText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  accordionPlansRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  planStockBadge: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeDefault: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  badgeActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  planTextDefault: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 12,
  },
  planTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12,
  },
  planCountText: {
    fontSize: 13,
    fontWeight: "800",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#1e293b",
    padding: 0,
  },
  statusToggleGroup: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusToggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  statusToggleTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  codesListHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginTop: 14,
    marginBottom: 8,
  },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  voucherCodeCard: {
    width: "48%",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  voucherCardAvailable: {
    backgroundColor: "#ffffff",
    borderColor: "#bbf7d0",
  },
  voucherCardRedeemed: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    opacity: 0.75,
  },
  voucherCodeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  voucherDaysBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  copyIconWrapper: {
    padding: 2,
  },
  voucherCodeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
  voucherStatusText: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  statusGreen: {
    color: "#16a34a",
  },
  statusGray: {
    color: "#94a3b8",
  },
  emptyFilteredWrapper: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyFilteredText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  moreCountText: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 10,
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "500",
  },
});
