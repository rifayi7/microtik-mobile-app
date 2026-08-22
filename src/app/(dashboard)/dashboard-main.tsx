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
import { Bell, Wifi, Building2 } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

export default function DashboardScreen() {
  const { gatewayUrl } = useGateway();
  const [salesperson, setSalesperson] = useState("iqbalapricom");
  const [summaryList, setSummaryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSalesperson = async () => {
    try {
      const name = await AsyncStorage.getItem("salesperson_name");
      if (name) {
        setSalesperson(name);
      }
    } catch (e) {
      console.warn("Failed to load salesperson name from storage:", e);
    }
  };

  const loadSummaryData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ data: any[] }>(
        gatewayUrl,
        "/api/mikrotik/dashboard/sales-summary",
        null,
        { method: "GET" }
      );
      setSummaryList(payload.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl]);

  useEffect(() => {
    void loadSalesperson();
    void loadSummaryData();
  }, [loadSummaryData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadSummaryData(true);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Fetching sales analysis...</Text>
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
              Please add routers & record sales to see statistics.
            </Text>
          </View>
        ) : (
          summaryList.map((item, index) => (
            <View key={index} style={styles.salesCard}>
              <View style={styles.cardCol}>
                <Text style={styles.cardColLabel}>Camp Name</Text>
                <Text style={styles.campNameBold}>{item.campName}</Text>
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
                <Text style={styles.campNameBoldPending}>{item.campName}</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
