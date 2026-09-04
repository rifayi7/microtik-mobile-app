import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Wifi, Building2, Wallet, Receipt, ChevronRight } from "lucide-react-native";
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
  const router = useRouter();
  const { gatewayUrl } = useGateway();
  const [salesperson, setSalesperson] = useState("Unknown");
  const [displayName, setDisplayName] = useState("Salesperson");
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
      const storedUserId = await AsyncStorage.getItem("salesperson_id");
      const urlQuery = storedUserId
        ? `/api/mikrotik/dashboard/sales-summary?salesPersonId=${encodeURIComponent(storedUserId)}&salesperson=${encodeURIComponent(activeUser)}`
        : `/api/mikrotik/dashboard/sales-summary?salesperson=${encodeURIComponent(activeUser)}`;

      const payload = await fetchFromGateway<{ 
        data: any[]; 
        userStats?: SalespersonStats; 
        overallStats?: OverallStats;
        lastCollections?: CollectionItem[];
      }>(
        gatewayUrl,
        urlQuery,
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

  useFocusEffect(
    useCallback(() => {
      async function refreshOnFocus() {
        try {
          const name = await AsyncStorage.getItem("salesperson_name");
          if (!name || name === "Unknown") {
            router.replace("/");
            return;
          }
          const dName = await AsyncStorage.getItem("salesperson_display_name");
          setSalesperson(name);
          setDisplayName(dName || name);
          await loadSummaryData(name, true);
        } catch {
          router.replace("/");
        }
      }
      void refreshOnFocus();
    }, [loadSummaryData, router])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadSummaryData(salesperson, true);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#DC2626" />
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
          <Text style={styles.welcomeTitle}>Hello {displayName}</Text>
          <Text style={styles.welcomeSub}>Welcome</Text>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Bell size={22} color="#0f172a" />
          <View style={styles.bellBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DC2626"
            colors={["#DC2626"]}
          />
        }
      >
        {/* TOP ROW: Total Collection & Today's Sale */}
        <View style={styles.topCardsRow}>
          {/* Total Collection Card (Crimson Red) */}
          <View style={styles.outstandingCard}>
            <View style={styles.topCardHeader}>
              <Text style={styles.topCardTitleRed}>Total{"\n"}Collection</Text>
              <View style={styles.iconCircleRed}>
                <Wallet size={18} color="#ffffff" />
              </View>
            </View>
            <View style={styles.topCardBottom}>
              <Text style={styles.outstandingValue}>
                AED <Text style={styles.outstandingValueBold}>
                  {userStats.totalRevenue.toFixed(0)}
                </Text>
              </Text>
            </View>
          </View>

          {/* Today's Sale Card (Dark Charcoal) */}
          <View style={styles.todaySaleCard}>
            <View style={styles.topCardHeader}>
              <Text style={styles.topCardTitleDark}>Today's{"\n"}Sale</Text>
              <View style={styles.iconCircleDark}>
                <Receipt size={18} color="#ef4444" />
              </View>
            </View>
            <View style={styles.todayCardContent}>
              <Text style={styles.statSmallLabelDark}>Amount</Text>
              <Text style={styles.todayAmountValue}>
                AED <Text style={styles.todayAmountValueBold}>
                  {userStats.todayRevenue.toFixed(0)}
                </Text>
              </Text>

              <View style={styles.todayDivider} />

              <Text style={styles.statSmallLabelDark}>Count</Text>
              <Text style={styles.todayCountValue}>
                {(() => {
                  const cnt = userStats.todaySalesCount;
                  return Number.isInteger(cnt) ? cnt.toString() : cnt.toFixed(1);
                })()}
              </Text>
            </View>
          </View>
        </View>

        {/* SALE ANALYSIS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sale Analysis</Text>
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
                <Text style={styles.saleAmountMain}>AED {Number(item.todaySale || 0).toFixed(0)}</Text>
              </View>
              <View style={styles.cardColRight}>
                <Text style={styles.cardColLabel}>Monthly sale</Text>
                <Text style={styles.saleAmountMain}>AED {Number(item.monthlySale || 0).toFixed(0)}</Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
            </View>
          ))
        )}

        {/* CAMPWISE COLLECTION SECTION */}
        <Text style={styles.sectionTitlePending}>Campwise Collection</Text>

        {summaryList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Wifi size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No collections recorded.</Text>
          </View>
        ) : (
          summaryList.map((item, index) => (
            <View key={index} style={styles.pendingCard}>
              <View style={styles.pendingCardLeft}>
                <Text style={styles.cardColLabel}>Camp Name</Text>
                <Text style={styles.campNameBoldPending} numberOfLines={2}>{item.campName}</Text>
              </View>
              <View style={styles.pendingCardRight}>
                <Text style={styles.cardColLabel}>Collection</Text>
                <Text style={styles.outstandingAmountText}>
                  AED <Text style={styles.outstandingBoldText}>{item.outstanding}</Text>
                </Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" style={{ marginLeft: 8 }} />
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
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
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
    backgroundColor: "#DC2626", // Solid Crimson Red
    borderRadius: 18,
    padding: 16,
    minHeight: 160,
    justifyContent: "space-between",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  todaySaleCard: {
    flex: 1,
    backgroundColor: "#18181B", // Dark Charcoal / Black Card
    borderRadius: 18,
    padding: 16,
    minHeight: 160,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topCardTitleRed: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  topCardTitleDark: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  iconCircleRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleDark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  topCardBottom: {
    marginTop: 16,
  },
  outstandingValue: {
    fontSize: 13,
    color: "#FEE2E2",
    fontWeight: "500",
  },
  outstandingValueBold: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  todayCardContent: {
    marginTop: 6,
  },
  statSmallLabelDark: {
    fontSize: 12,
    color: "#A1A1AA",
    marginBottom: 2,
  },
  todayAmountValue: {
    fontSize: 13,
    color: "#F87171",
    fontWeight: "500",
  },
  todayAmountValueBold: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EF4444",
  },
  todayDivider: {
    height: 1,
    backgroundColor: "#27272A",
    marginVertical: 6,
  },
  todayCountValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EF4444",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionTitlePending: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 24,
    marginBottom: 16,
  },
  salesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
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
    color: "#94A3B8",
    marginBottom: 4,
  },
  campNameBold: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  saleAmountMain: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
  pendingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    color: "#0F172A",
  },
  outstandingAmountText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#DC2626",
  },
  outstandingBoldText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
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
