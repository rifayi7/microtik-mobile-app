import { Search, ShieldAlert, Ticket } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface HotspotUser {
  id: string;
  username: string;
  profile: string;
  routerId: string;
  routerName: string;
  status: "active" | "disabled" | "expired";
  uptime: string;
  dataUsed: string;
  dataLimit: string;
  expiresAt: string;
  createdAt: string;
  server?: string;
  macAddress?: string;
  bytesIn?: string;
  bytesOut?: string;
  comment?: string;
}

export default function CouponScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [coupons, setCoupons] = useState<HotspotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "used" | "expired">("all");

  const loadCoupons = useCallback(async (isRefresh = false) => {
    if (!activeRouter) {
      setCoupons([]);
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ users: HotspotUser[] }>(
        gatewayUrl,
        "/api/mikrotik/users",
        activeRouter
      );
      setCoupons(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    if (!activeRouter) {
      setCoupons([]);
      return;
    }
    void loadCoupons();
  }, [loadCoupons, activeRouter]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadCoupons(true);
  };

  function parseValidityDays(profile: string | undefined): number {
    const target = String(profile || "").trim();
    const match = target.match(/(\d+)\s*[-_]?\s*days?/i);
    if (match) return Number(match[1]);
    const numeric = Number(target.replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  const filteredCoupons = useMemo(() => {
    return coupons.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.profile.toLowerCase().includes(search.toLowerCase()) ||
        (u.comment ?? "").toLowerCase().includes(search.toLowerCase());

      // Determine coupon local status
      const isUsed = (u.comment && u.comment.includes("Mobile:")) || u.status === "disabled";
      const isExpired = u.status === "expired";
      const isAvailable = u.status === "active" && !isUsed;

      let matchesStatus = true;
      if (statusFilter === "available") {
        matchesStatus = isAvailable;
      } else if (statusFilter === "used") {
        matchesStatus = isUsed;
      } else if (statusFilter === "expired") {
        matchesStatus = isExpired;
      }

      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const getStatusBadge = (item: HotspotUser) => {
    const isUsed = (item.comment && item.comment.includes("Mobile:")) || item.status === "disabled";
    const isExpired = item.status === "expired";

    if (isExpired) {
      return { text: "Expired", bg: "#fee2e2", color: "#ef4444" };
    }
    if (isUsed) {
      return { text: "Used", bg: "#f1f5f9", color: "#64748b" };
    }
    return { text: "Available", bg: "#dcfce7", color: "#16a34a" };
  };

  const renderItem = ({ item }: { item: HotspotUser }) => {
    const badge = getStatusBadge(item);
    const validityDays = parseValidityDays(item.profile);

    return (
      <View style={styles.couponCard}>
        {/* Card Left Part */}
        <View style={styles.couponLeft}>
          <View style={styles.ticketIconBg}>
            <Ticket size={22} color="#4A60D6" />
          </View>
          <View style={styles.couponMainDetails}>
            <Text style={styles.couponCode}>{item.username}</Text>
            <Text style={styles.couponProfile}>
              {validityDays > 0 ? `${validityDays}-Days Plan` : item.profile}
            </Text>
          </View>
        </View>

        {/* Card Divider Line (Dashed ticket separator look) */}
        <View style={styles.ticketDashedLine} />

        {/* Card Right Part */}
        <View style={styles.couponRight}>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
          </View>
          {item.comment && item.comment.includes("Mobile:") ? (
            <Text style={styles.mobileText} numberOfLines={1}>
              {item.comment.replace("Mobile:", "")}
            </Text>
          ) : (
            <Text style={styles.createdText}>{item.createdAt ? item.createdAt.split(" ")[0] : "Active"}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Toolbar / Search Header */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coupons..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "available", "used", "expired"] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              statusFilter === filter && styles.activeFilterTab,
            ]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[
                styles.filterTabText,
                statusFilter === filter && styles.activeFilterTabText,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && coupons.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading coupons...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadCoupons()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredCoupons.length === 0 ? (
        <View style={styles.centered}>
          <Ticket size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No coupons found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCoupons}
          keyExtractor={(item) => item.id}
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
  filterRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  activeFilterTab: {
    backgroundColor: "#EEF2FF",
    borderColor: "#bfdbfe",
  },
  filterTabText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
  },
  activeFilterTabText: {
    color: "#4A60D6",
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
  couponCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    flexDirection: "row",
    height: 76,
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    overflow: "hidden",
  },
  couponLeft: {
    flex: 3,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  ticketIconBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  couponMainDetails: {},
  couponCode: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1e293b",
    letterSpacing: 0.5,
  },
  couponProfile: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  ticketDashedLine: {
    width: 1,
    height: "100%",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginHorizontal: 2,
  },
  couponRight: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: "#FAFBFD",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  mobileText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  createdText: {
    fontSize: 11,
    color: "#94a3b8",
  },
});
