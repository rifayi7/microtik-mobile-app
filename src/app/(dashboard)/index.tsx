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
    if (!activeRouter) return;
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
    void loadDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void loadDashboard(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadDashboard(true);
  };

  const getBarColor = (percent: number) => {
    if (percent > 85) return "#ef5350"; // Red
    if (percent > 60) return "#f5a623"; // Yellow/Orange
    return "#4caf50"; // Green
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
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
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f5a623"
            colors={["#f5a623"]}
          />
        }
      >
        {/* Top Clock/Zone Banner */}
        <View style={styles.bannerRow}>
          <Text style={styles.bannerTitle}>ACTIVE DEVICE</Text>
          <Text style={styles.bannerValue}>
            {activeRouter?.sessionName.toUpperCase()} ({activeRouter?.host})
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: "#ef5350" }]}>
            <View style={styles.statIconContainer}>
              <Wifi size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.statNumber}>{data.activeSessions}</Text>
              <Text style={styles.statLabel}>Active Sessions</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#ffb300" }]}>
            <View style={styles.statIconContainer}>
              <Users size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.statNumber}>{data.totalUsers}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
          </View>
        </View>

        <View style={styles.incomeCard}>
          <View style={styles.incomeHeader}>
            <Banknote size={20} color="#f5a623" />
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
              <Text style={styles.incomeAmount}>
                {formatCurrency(data.incomeMonth, data.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Resource Gauges */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Activity size={18} color="#f5a623" />
            <Text style={styles.cardTitle}>Resource Monitor</Text>
          </View>

          {/* CPU Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeLabelRow}>
              <View style={styles.iconLabel}>
                <Cpu size={14} color="#aaa" />
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
                <Tv size={14} color="#aaa" />
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
                <Database size={14} color="#aaa" />
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
            <Info size={18} color="#f5a623" />
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
            <Clock size={18} color="#f5a623" />
            <Text style={styles.cardTitle}>Hotspot Activity Log</Text>
          </View>

          {data.hotspotLogs.length === 0 ? (
            <Text style={styles.emptyLogText}>No recent hotspot log entries.</Text>
          ) : (
            data.hotspotLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.time}</Text>
                <View style={styles.logContent}>
                  <Text style={styles.logUser}>{log.user}</Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* App Logs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={18} color="#f5a623" />
            <Text style={styles.cardTitle}>Gateway Sync Log</Text>
          </View>
          <View style={styles.appLogContainer}>
            {data.appLogs.map((log, index) => (
              <Text key={index} style={styles.appLogText}>
                {log}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
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
  },
  bannerRow: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#888",
    letterSpacing: 1,
  },
  bannerValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "600",
  },
  incomeCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    color: "#fff",
  },
  incomeValues: {
    flexDirection: "row",
  },
  incomeItem: {
    flex: 1,
    alignItems: "center",
  },
  incomeBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#2a2a2a",
  },
  incomeLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#26c6da",
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
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
    color: "#aaa",
    fontWeight: "500",
  },
  gaugeValue: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#2a2a2a",
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
    borderBottomColor: "#2a2a2a",
    paddingVertical: 10,
  },
  infoLabel: {
    color: "#888",
    fontSize: 13,
  },
  infoValue: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  logRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingVertical: 8,
    gap: 12,
  },
  logTime: {
    fontSize: 11,
    color: "#888",
    width: 60,
    fontFamily: "System",
  },
  logContent: {
    flex: 1,
  },
  logUser: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f5a623",
  },
  logMessage: {
    fontSize: 12,
    color: "#ccc",
    marginTop: 2,
  },
  emptyLogText: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  appLogContainer: {
    backgroundColor: "#121212",
    borderRadius: 6,
    padding: 10,
  },
  appLogText: {
    color: "#00e676",
    fontFamily: "System",
    fontSize: 11,
    marginBottom: 4,
  },
});
