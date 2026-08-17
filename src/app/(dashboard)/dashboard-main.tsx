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
} from "react-native";
import {
  Wifi,
  Users,
  Banknote,
  Cpu,
  Tv,
  Database,
  Activity,
  Info,
  Clock,
} from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";
import { formatCurrency } from "../../lib/format";

interface RouterResource {
  cpuLoad: string;
  cpuCount: string;
  cpuFrequency: string;
  memoryUsed: string;
  memoryTotal: string;
  memoryPercent: number;
  hddUsed: string;
  hddTotal: string;
  hddPercent: number;
  uptime: string;
  version: string;
  boardName: string;
  identity: string;
}

interface HotspotLogEntry {
  id: string;
  time: string;
  user: string;
  message: string;
}

interface ConnectedDashboardData {
  resource: RouterResource;
  activeSessions: number;
  totalUsers: number;
  incomeToday: number;
  incomeMonth: number;
  currency: string;
  appLogs: string[];
  hotspotLogs: HotspotLogEntry[];
}

export default function DashboardScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [data, setData] = useState<ConnectedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!activeRouter) {
      setData(null);
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ dashboard: ConnectedDashboardData }>(
        gatewayUrl,
        "/api/mikrotik/dashboard",
        activeRouter
      );
      setData(payload.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    if (!activeRouter) {
      setData(null);
      return;
    }
    void loadDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void loadDashboard(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadDashboard, activeRouter]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadDashboard(true);
  };

  const getBarColor = (percent: number) => {
    if (percent > 85) return "#ef4444"; // Red
    if (percent > 60) return "#f59e0b"; // Amber
    return "#10b981"; // Green
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A60D6" />
        <Text style={styles.loadingText}>Fetching dashboard data...</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
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
        {/* Top Active Router Banner */}
        <View style={styles.bannerRow}>
          <Text style={styles.bannerTitle}>ACTIVE DEVICE</Text>
          <Text style={styles.bannerValue} numberOfLines={1}>
            {activeRouter?.sessionName.toUpperCase()} ({activeRouter?.host})
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
            <View style={[styles.statIconContainer, { backgroundColor: "#3b82f6" }]}>
              <Wifi size={20} color="#fff" />
            </View>
            <View>
              <Text style={[styles.statNumber, { color: "#1e3a8a" }]}>{data.activeSessions}</Text>
              <Text style={[styles.statLabel, { color: "#1e40af" }]}>Active Sessions</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
            <View style={[styles.statIconContainer, { backgroundColor: "#10b981" }]}>
              <Users size={20} color="#fff" />
            </View>
            <View>
              <Text style={[styles.statNumber, { color: "#064e3b" }]}>{data.totalUsers}</Text>
              <Text style={[styles.statLabel, { color: "#047857" }]}>Total Hotspot Users</Text>
            </View>
          </View>
        </View>

        {/* Income Card */}
        <View style={styles.incomeCard}>
          <View style={styles.incomeHeader}>
            <Banknote size={20} color="#4A60D6" />
            <Text style={styles.incomeTitle}>Income Summary</Text>
          </View>
          <View style={styles.incomeValues}>
            <View style={styles.incomeItem}>
              <Text style={styles.incomeLabel}>Today</Text>
              <Text style={styles.incomeAmount}>
                {formatCurrency(data.incomeToday, data.currency)}
              </Text>
            </View>
            <View style={[styles.incomeItem, styles.incomeBorderLeft]}>
              <Text style={styles.incomeLabel}>This Month</Text>
              <Text style={[styles.incomeAmount, { color: "#10b981" }]}>
                {formatCurrency(data.incomeMonth, data.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Resource Gauges */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Activity size={18} color="#4A60D6" />
            <Text style={styles.cardTitle}>Resource Monitor</Text>
          </View>

          {/* CPU Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeLabelRow}>
              <View style={styles.iconLabel}>
                <Cpu size={14} color="#64748b" />
                <Text style={styles.gaugeLabel}>CPU Load</Text>
              </View>
              <Text style={styles.gaugeValue}>
                {data.resource.cpuLoad}% ({data.resource.cpuCount}x {data.resource.cpuFrequency}MHz)
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.max(1, Math.min(100, Number(data.resource.cpuLoad)))}%`,
                    backgroundColor: getBarColor(Number(data.resource.cpuLoad)),
                  },
                ]}
              />
            </View>
          </View>

          {/* Memory Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeLabelRow}>
              <View style={styles.iconLabel}>
                <Tv size={14} color="#64748b" />
                <Text style={styles.gaugeLabel}>Memory</Text>
              </View>
              <Text style={styles.gaugeValue}>
                {data.resource.memoryUsed} / {data.resource.memoryTotal} ({data.resource.memoryPercent}%)
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.max(1, Math.min(100, data.resource.memoryPercent))}%`,
                    backgroundColor: getBarColor(data.resource.memoryPercent),
                  },
                ]}
              />
            </View>
          </View>

          {/* HDD Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeLabelRow}>
              <View style={styles.iconLabel}>
                <Database size={14} color="#64748b" />
                <Text style={styles.gaugeLabel}>HDD Space</Text>
              </View>
              <Text style={styles.gaugeValue}>
                {data.resource.hddUsed} / {data.resource.hddTotal} ({data.resource.hddPercent}%)
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.max(1, Math.min(100, data.resource.hddPercent))}%`,
                    backgroundColor: getBarColor(data.resource.hddPercent),
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* System Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Info size={18} color="#4A60D6" />
            <Text style={styles.cardTitle}>System Info</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uptime</Text>
            <Text style={styles.infoValue}>{data.resource.uptime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Board Name</Text>
            <Text style={styles.infoValue}>{data.resource.boardName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>OS Version</Text>
            <Text style={styles.infoValue}>{data.resource.version} (stable)</Text>
          </View>
        </View>

        {/* Hotspot Logs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={18} color="#4A60D6" />
            <Text style={styles.cardTitle}>Hotspot Activity Log</Text>
          </View>

          {data.hotspotLogs.length === 0 ? (
            <Text style={styles.emptyLogText}>No recent activity logs found</Text>
          ) : (
            data.hotspotLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.time}</Text>
                <View style={styles.logContent}>
                  <Text style={styles.logUser}>{log.user || "system"}</Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* App Syslogs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={18} color="#4A60D6" />
            <Text style={styles.cardTitle}>System Gateway Log</Text>
          </View>
          <View style={styles.appLogContainer}>
            {data.appLogs.length === 0 ? (
              <Text style={[styles.emptyLogText, { color: "#64748b" }]}>No gateway server logs yet</Text>
            ) : (
              data.appLogs.slice(0, 10).map((log, index) => (
                <Text key={index} style={styles.appLogText} numberOfLines={2}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  bannerRow: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bannerTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  bannerValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4A60D6",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  incomeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  incomeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  incomeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  incomeValues: {
    flexDirection: "row",
  },
  incomeItem: {
    flex: 1,
    paddingVertical: 4,
  },
  incomeBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    paddingLeft: 16,
  },
  incomeLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4A60D6",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  gaugeContainer: {
    marginBottom: 12,
  },
  gaugeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  iconLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gaugeLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  gaugeValue: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "bold",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  infoValue: {
    color: "#1e293b",
    fontWeight: "600",
    fontSize: 13,
  },
  logRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
    gap: 12,
  },
  logTime: {
    fontSize: 11,
    color: "#64748b",
    width: 60,
  },
  logContent: {
    flex: 1,
  },
  logUser: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4A60D6",
  },
  logMessage: {
    fontSize: 12,
    color: "#334155",
    marginTop: 2,
  },
  emptyLogText: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  appLogContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  appLogText: {
    color: "#0f766e",
    fontFamily: "System",
    fontSize: 11,
    marginBottom: 4,
  },
});
