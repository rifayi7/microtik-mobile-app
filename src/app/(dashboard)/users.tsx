import { Search, ShieldAlert, User } from "lucide-react-native";
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

export default function UsersScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "expired">("all");
  const [dayFilter, setDayFilter] = useState<number | "all">("all");

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (!activeRouter) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ users: HotspotUser[] }>(
        gatewayUrl,
        "/api/mikrotik/users",
        activeRouter
      );
      setUsers(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hotspot users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadUsers(true);
  };

  function parseValidityDays(profile: string | undefined): number {
    const target = String(profile || "").trim();
    const match = target.match(/(\d+)\s*[-_]?\s*days?/i);
    if (match) return Number(match[1]);
    const numeric = Number(target.replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  const activeDays = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter((user) => user.status === "active")
          .map((user) => parseValidityDays(user.profile))
          .filter((days) => days > 0)
      )
    ).sort((a, b) => a - b);
  }, [users]);

  useEffect(() => {
    if (statusFilter !== "active") {
      setDayFilter("all");
    }
  }, [statusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.profile.toLowerCase().includes(search.toLowerCase()) ||
        (u.comment ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      const matchesDay =
        statusFilter !== "active" || dayFilter === "all"
          ? true
          : parseValidityDays(u.profile) === dayFilter;

      return matchesSearch && matchesStatus && matchesDay;
    });
  }, [users, search, statusFilter, dayFilter]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "#2e7d32", text: "#e8f5e9" };
      case "disabled":
        return { bg: "#c62828", text: "#ffebee" };
      case "expired":
      default:
        return { bg: "#ef6c00", text: "#fff3e0" };
    }
  };

  const renderItem = ({ item }: { item: HotspotUser }) => {
    const statusColors = getStatusStyle(item.status);

    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userLeft}>
            <View style={styles.avatar}>
              <User size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.profileText}>
                {item.profile} • {item.server ?? "all"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.bg },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.userDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MAC Address:</Text>
            <Text style={styles.detailValue}>{item.macAddress || "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Uptime / Traffic:</Text>
            <Text style={styles.detailValue}>
              {item.uptime || "0s"} ({item.dataUsed || "—"})
            </Text>
          </View>
          {item.comment ? (
            <View style={styles.commentContainer}>
              <Text style={styles.commentText}>{item.comment}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Toolbar / Search Header */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {(["all", "active", "disabled", "expired"] as const).map((filter) => (
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

      {statusFilter === "active" && activeDays.length > 0 && (
        <View style={styles.dayFilterRow}>
          <Text style={styles.dayFilterLabel}>Days:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.dayFilterChip,
                dayFilter === "all" && styles.activeDayFilterChip,
              ]}
              onPress={() => setDayFilter("all")}
            >
              <Text
                style={[
                  styles.dayFilterText,
                  dayFilter === "all" && styles.activeDayFilterText,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {activeDays.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.dayFilterChip,
                  dayFilter === days && styles.activeDayFilterChip,
                ]}
                onPress={() => setDayFilter(days)}
              >
                <Text
                  style={[
                    styles.dayFilterText,
                    dayFilter === days && styles.activeDayFilterText,
                  ]}
                >
                  {days} Days
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading && users.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={styles.loadingText}>Loading hotspot users...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef5350" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadUsers()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centered}>
          <User size={36} color="#444" />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
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
  filterRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  activeFilterTab: {
    backgroundColor: "#f5a623",
    borderColor: "#f5a623",
  },
  filterTabText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  activeFilterTabText: {
    color: "#121212",
  },
  dayFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  dayFilterLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  dayFilterScroll: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dayFilterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  activeDayFilterChip: {
    backgroundColor: "#f5a623",
    borderColor: "#f5a623",
  },
  dayFilterText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  activeDayFilterText: {
    color: "#121212",
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
  userCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingBottom: 8,
    marginBottom: 8,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  profileText: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  userDetails: {},
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
  commentContainer: {
    backgroundColor: "#121212",
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
  },
  commentText: {
    fontSize: 11,
    color: "#f5a623",
    fontStyle: "italic",
  },
});
