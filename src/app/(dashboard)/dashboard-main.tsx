import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { Bell, Wifi, Building2, DollarSign, TrendingUp, Award, Calendar } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface SalespersonStats {
  totalRevenue: number;
  todayRevenue: number;
  monthlyRevenue: number;
  todaySalesCount: number;
  monthlySalesCount: number;
  totalSalesCount: number;
}

interface OverallStats {
  totalOutstanding: number;
  totalSalesRevenue: number;
  todayTotalSaleCount: number;
  todayTotalSaleRevenue: number;
}

interface CollectionItem {
  amount: number;
  date: string;
  time: string;
  campName: string;
  paidBy: string;
}

export default function DashboardScreen() {
  const { gatewayUrl } = useGateway();
  const [salesperson, setSalesperson] = useState("Unknown");
  const [summaryList, setSummaryList] = useState<any[]>([]);
  const [lastCollections, setLastCollections] = useState<CollectionItem[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalOutstanding: 0,
    totalSalesRevenue: 0,
    todayTotalSaleCount: 0,
    todayTotalSaleRevenue: 0,
  });
  const [userStats, setUserStats] = useState<SalespersonStats>({
    totalRevenue: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    todaySalesCount: 0,
    monthlySalesCount: 0,
    totalSalesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummaryData = useCallback(async (currentSalesperson?: string, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    const activeUser = currentSalesperson || salesperson;

    try {
      const payload = await fetchFromGateway<{ 
        data: any[]; 
        userStats?: SalespersonStats; 
        overallStats?: OverallStats;
        lastCollections?: CollectionItem[];
      }>(
        gatewayUrl,
        `/api/mikrotik/dashboard/sales-summary?salesperson=${encodeURIComponent(activeUser)}`,
        null,
        { method: "GET" }
      );
      setSummaryList(payload.data || []);
      if (payload.userStats) setUserStats(payload.userStats);
      if (payload.overallStats) setOverallStats(payload.overallStats);
      if (payload.lastCollections) setLastCollections(payload.lastCollections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, salesperson]);

  useEffect(() => {
    async function init() {
      try {
        const name = await AsyncStorage.getItem("salesperson_name");
        const activeName = name || "Unknown";
        setSalesperson(activeName);
        await loadSummaryData(activeName, false);
      } catch {
        void loadSummaryData(salesperson, false);
      }
    }
    void init();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void loadSummaryData(salesperson, true);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Fetching dashboard data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fafafc" />
      
      {/* Header Profile Info */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeTitle}>Hello {salesperson}</Text>
          <Text style={styles.welcomeSub}>Welcome</Text>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Bell size={22} color="#0f172a" />
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
        {/* TOP ROW: Outstanding Balance & Today's Sale */}
        <View style={styles.topCardsRow}>
          {/* Outstanding Balance Card (Light Cyan/Blue) */}
          <View style={styles.outstandingCard}>
            <Text style={styles.topCardTitle}>Outstanding{"\n"}Balance</Text>
            <View style={styles.topCardBottom}>
              <Text style={styles.outstandingValue}>
                AED <Text style={styles.outstandingValueBold}>
                  {overallStats.totalOutstanding > 0 
                    ? overallStats.totalOutstanding.toFixed(0) 
                    : userStats.totalRevenue.toFixed(0)}
                </Text>
              </Text>
              <Text style={styles.outstandingSubValue}>
                {"{AED " + (overallStats.totalOutstanding > 0 ? overallStats.totalOutstanding.toFixed(0) : userStats.totalRevenue.toFixed(0)) + "}"}
              </Text>
            </View>
          </View>

          {/* Today's Sale Card (Light Green) */}
          <View style={styles.todaySaleCard}>
            <Text style={styles.topCardTitle}>Today's{"\n"}Sale</Text>
            <View style={styles.todayCardContent}>
              <Text style={styles.statSmallLabel}>Amount</Text>
              <Text style={styles.todayAmountValue}>
                AED <Text style={styles.todayAmountValueBold}>
                  {userStats.todayRevenue > 0 ? userStats.todayRevenue.toFixed(0) : (overallStats.todayTotalSaleRevenue || 0).toFixed(0)}
                </Text>
              </Text>

              <View style={styles.todayDivider} />

              <Text style={styles.statSmallLabel}>Count</Text>
              <Text style={styles.todayCountValue}>
                {userStats.todaySalesCount > 0 ? userStats.todaySalesCount : overallStats.todayTotalSaleCount}
              </Text>
            </View>
          </View>
        </View>

        {/* LAST 5 COLLECTION SECTION */}
        <View style={styles.collectionCard}>
          <Text style={styles.collectionTitle}>Last 5 Collection</Text>
          <View style={styles.collectionTableHeader}>
            <Text style={styles.collectionColHeader}>Amount</Text>
            <Text style={styles.collectionColCenter}>Date</Text>
            <Text style={styles.collectionColRight}>Time</Text>
          </View>

          {lastCollections.length === 0 ? (
            <View style={styles.collectionEmpty}>
              <Text style={styles.collectionEmptyText}>No recent collections recorded</Text>
            </View>
          ) : (
            lastCollections.map((item, idx) => (
              <View key={idx} style={styles.collectionTableRow}>
                <Text style={styles.collectionAmountText}>AED {item.amount.toFixed(0)}</Text>
                <Text style={styles.collectionDateText}>{item.date || "—"}</Text>
                <Text style={styles.collectionTimeText}>{item.time || "—"}</Text>
              </View>
            ))
          )}
        </View>

        {/* SALE ANALYSIS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sale Analysis</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {summaryList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Building2 size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No sales analysis data available.</Text>
            <Text style={[styles.emptyText, { fontSize: 11, color: '#94a3b8', marginTop: 2 }]}>
              Please connect routers & record sales to see statistics.
            </Text>
          </View>
        ) : (
          summaryList.map((item, index) => (
            <View key={index} style={styles.salesCard}>
              <View style={styles.cardCol}>
                <Text style={styles.cardColLabel}>Camp Name</Text>
                <Text style={styles.campNameBold} numberOfLines={2}>{item.campName}</Text>
              </View>
              <View style={styles.cardColCenter}>
                <Text style={styles.cardColLabel}>Today sale</Text>
                <Text style={styles.saleCountText}>{item.todaySale}</Text>
              </View>
              <View style={styles.cardColRight}>
                <Text style={styles.cardColLabel}>Monthly sale</Text>
                <Text style={styles.saleCountText}>{item.monthlySale}</Text>
              </View>
            </View>
          ))
        )}

        {/* CAMPWISE PENDING SECTION */}
        <Text style={styles.sectionTitlePending}>Campwise pending</Text>

        {summaryList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Wifi size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No outstanding balances.</Text>
          </View>
        ) : (
          summaryList.map((item, index) => (
            <View key={index} style={styles.pendingCard}>
              <View style={styles.pendingCardLeft}>
                <Text style={styles.cardColLabel}>Camp Name</Text>
                <Text style={styles.campNameBoldPending} numberOfLines={2}>{item.campName}</Text>
              </View>
              <View style={styles.pendingCardRight}>
                <Text style={styles.cardColLabel}>Outstanding</Text>
                <Text style={styles.outstandingAmountText}>
                  AED <Text style={styles.outstandingBoldText}>{item.outstanding}</Text>
                </Text>
              </View>
            </View>
          ))
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafafc",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
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
    color: "#2e4396", // Dark blue from image
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
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  topCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
  },
  outstandingCard: {
    flex: 1,
    backgroundColor: "#e0f2fe", // Light soft cyan/blue from image
    borderRadius: 18,
    padding: 16,
    minHeight: 160,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#bae6fd",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  todaySaleCard: {
    flex: 1,
    backgroundColor: "#dcfce7", // Light soft pastel green from image
    borderRadius: 18,
    padding: 16,
    minHeight: 160,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  topCardTitle: {
    fontSize: 19,
    fontWeight: "400",
    color: "#334155",
    lineHeight: 24,
  },
  topCardBottom: {
    marginTop: 16,
  },
  outstandingValue: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  outstandingValueBold: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  outstandingSubValue: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  todayCardContent: {
    marginTop: 6,
  },
  statSmallLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  todayAmountValue: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "500",
  },
  todayAmountValueBold: {
    fontSize: 20,
    fontWeight: "800",
    color: "#15803d",
  },
  todayDivider: {
    height: 1,
    backgroundColor: "#86efac",
    marginVertical: 6,
  },
  todayCountValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16a34a",
  },
  collectionCard: {
    backgroundColor: "#ede9fe", // Soft lavender/purple card as in image
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  collectionTitle: {
    fontSize: 18,
    fontWeight: "400",
    color: "#334155",
    marginBottom: 14,
  },
  collectionTableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  collectionColHeader: {
    flex: 1.2,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  collectionColCenter: {
    flex: 1,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  collectionColRight: {
    flex: 1,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "right",
  },
  collectionTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.5)",
  },
  collectionAmountText: {
    flex: 1.2,
    fontSize: 13,
    fontWeight: "700",
    color: "#5b21b6",
  },
  collectionDateText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
  },
  collectionTimeText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    textAlign: "right",
  },
  collectionEmpty: {
    paddingVertical: 12,
    alignItems: "center",
  },
  collectionEmptyText: {
    fontSize: 12,
    color: "#7c3aed",
    opacity: 0.8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#334155",
  },
  sectionTitlePending: {
    fontSize: 18,
    fontWeight: "500",
    color: "#334155",
    marginTop: 28,
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "500",
  },
  salesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#2e4396",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardCol: {
    flex: 1.5,
    flexDirection: "column",
  },
  cardColCenter: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
  },
  cardColRight: {
    flex: 1.2,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  cardColLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  campNameBold: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2e4396",
  },
  saleCountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  pendingCard: {
    backgroundColor: "#f0f7ff", // Nice light blue background as in image
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pendingCardLeft: {
    flex: 1.5,
    flexDirection: "column",
  },
  pendingCardRight: {
    flex: 1.5,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  campNameBoldPending: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  outstandingAmountText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1e3a8a",
  },
  outstandingBoldText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e3a8a",
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
