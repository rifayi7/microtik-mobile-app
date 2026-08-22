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
} from "react-native";
import { Bell, ChevronDown, Building2, Ticket } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface PlanCount {
  days: number;
  available_count: number;
}

export default function CouponScreen() {
  const { gatewayUrl, routers } = useGateway();
  const [salesperson, setSalesperson] = useState("iqbalapricom");
  const [campPlans, setCampPlans] = useState<Record<string, PlanCount[]>>({});
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [loadingCampId, setLoadingCampId] = useState<string | null>(null);
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

  const loadPlansForRouter = async (routerId: string, isRefresh = false) => {
    const targetRouter = routers.find((r) => r.id === routerId);
    if (!targetRouter) return;

    if (!isRefresh) setLoadingCampId(routerId);
    try {
      const plansPayload = await fetchFromGateway<PlanCount[]>(
        gatewayUrl,
        "/api/mikrotik/vouchers/plans",
        targetRouter,
        { method: "POST" }
      );
      setCampPlans((prev) => ({ ...prev, [routerId]: plansPayload || [] }));
    } catch (err) {
      console.warn("Failed to fetch plans for camp:", routerId, err);
    } finally {
      setLoadingCampId(null);
    }
  };

  const handleToggleCamp = (routerId: string) => {
    if (selectedCampId === routerId) {
      setSelectedCampId(null);
    } else {
      setSelectedCampId(routerId);
      void loadPlansForRouter(routerId);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedCampId) {
      await loadPlansForRouter(selectedCampId, true);
    }
    setRefreshing(false);
  };

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
        {/* Title */}
        <Text style={styles.sectionTitle}>Camps Voucher Inventory</Text>

        {routers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Building2 size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No camps available.</Text>
            <Text style={[styles.emptyText, { fontSize: 11, color: '#94a3b8', marginTop: 2 }]}>
              Please configure a router in the Web Admin Portal first.
            </Text>
          </View>
        ) : (
          routers.map((routerItem) => {
            const isExpanded = selectedCampId === routerItem.id;
            const plansList = campPlans[routerItem.id] || [];
            const isLoadingPlans = loadingCampId === routerItem.id;
            const campName = routerItem.camp || routerItem.sessionName;

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

                {/* Accordion Content (Voucher plan counts) */}
                {isExpanded && (
                  <View style={styles.campAccordionContent}>
                    {isLoadingPlans ? (
                      <View style={styles.centeredRow}>
                        <ActivityIndicator size="small" color="#4A60D6" />
                        <Text style={styles.loadingCountsText}>Loading counts...</Text>
                      </View>
                    ) : plansList.length === 0 ? (
                      <View style={styles.emptyStockWrapper}>
                        <Ticket size={20} color="#94a3b8" />
                        <Text style={styles.noVouchersText}>No available vouchers in stock</Text>
                      </View>
                    ) : (
                      <View style={styles.accordionPlansRow}>
                        {plansList.map((p, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.planStockBadge,
                              p.days === 30 ? styles.badgeBlue : styles.badgeGreen,
                            ]}
                          >
                            <Text style={p.days === 30 ? styles.planTextBlue : styles.planTextGreen}>
                              {p.days}-Days: <Text style={styles.planCountText}>{p.available_count}</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
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
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeBlue: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  badgeGreen: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  planTextBlue: {
    color: "#1e3a8a",
    fontWeight: "700",
    fontSize: 13,
  },
  planTextGreen: {
    color: "#064e3b",
    fontWeight: "700",
    fontSize: 13,
  },
  planCountText: {
    fontSize: 14,
    fontWeight: "900",
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
