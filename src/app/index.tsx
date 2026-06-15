import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Server,
  Plus,
  Trash2,
  Check,
  Globe,
  Lock,
  DollarSign,
  Wifi,
  ChevronRight,
} from "lucide-react-native";
import { useGateway } from "../contexts/gateway-context";
import { type MikrotikRouterConfig } from "../lib/api-client";

export default function GatewayScreen() {
  const router = useRouter();
  const {
    gatewayUrl,
    routers,
    activeRouter,
    isConnected,
    loading,
    setGatewayUrl,
    addRouter,
    deleteRouter,
    connectRouter,
    disconnectRouter,
  } = useGateway();

  const [inputUrl, setInputUrl] = useState(gatewayUrl);
  const [sessionName, setSessionName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8728");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [useTls, setUseTls] = useState(false);
  const [currency, setCurrency] = useState("AED");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setInputUrl(gatewayUrl);
  }, [gatewayUrl]);

  // If already connected, offer navigation to dashboard directly
  useEffect(() => {
    if (isConnected) {
      router.replace("/(dashboard)");
    }
  }, [isConnected]);

  const handleSaveGateway = async () => {
    if (!inputUrl.trim()) {
      Alert.alert("Error", "Gateway URL cannot be empty");
      return;
    }
    try {
      await setGatewayUrl(inputUrl.trim());
      Alert.alert("Success", "Gateway API URL updated successfully");
    } catch {
      Alert.alert("Error", "Failed to save gateway URL");
    }
  };

  const handleAddRouter = async () => {
    if (!sessionName.trim() || !host.trim() || !port.trim() || !username.trim()) {
      Alert.alert("Error", "Please fill in all required fields (Name, IP, Port, Username)");
      return;
    }

    try {
      await addRouter({
        sessionName: sessionName.trim(),
        host: host.trim(),
        port: Number(port.trim()),
        username: username.trim(),
        password: password,
        useTls,
        currency: currency.trim() || "AED",
      });

      // Reset Form
      setSessionName("");
      setHost("");
      setPort("8728");
      setUsername("admin");
      setPassword("");
      setUseTls(false);
      setCurrency("AED");
      setIsAdding(false);
      Alert.alert("Success", "Router config added");
    } catch {
      Alert.alert("Error", "Failed to add router");
    }
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    try {
      const success = await connectRouter(id);
      if (success) {
        router.replace("/(dashboard)");
      }
    } catch (err) {
      Alert.alert(
        "Connection Failed",
        err instanceof Error ? err.message : "Could not connect to router. Check credentials and Next.js status."
      );
    } finally {
      setConnectingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
        <Text style={styles.loadingText}>Loading configurations...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1e1e" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <Text style={styles.title}>TOETIK MOBILE</Text>
          <Text style={styles.subtitle}>MikroTik RouterOS Gateway Manager</Text>
        </View>

        {/* Gateway API Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next.js Gateway Server</Text>
          <Text style={styles.cardDesc}>
            Specify the base URL of your running Next.js application proxy.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. http://192.168.1.5:3000"
              placeholderTextColor="#888"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveGateway}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Router List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your MikroTik Routers</Text>
          {!isAdding && (
            <TouchableOpacity
              style={styles.addButtonInline}
              onPress={() => setIsAdding(true)}
            >
              <Plus size={16} color="#f5a623" />
              <Text style={styles.addButtonInlineText}>Add New</Text>
            </TouchableOpacity>
          )}
        </View>

        {isAdding && (
          <View style={[styles.card, styles.formCard]}>
            <Text style={styles.cardTitle}>Add Router Configuration</Text>

            <Text style={styles.label}>Session Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Office Core"
              placeholderTextColor="#888"
              value={sessionName}
              onChangeText={setSessionName}
            />

            <View style={styles.formRow}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.label}>IP Address / Host *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 192.168.88.1"
                  placeholderTextColor="#888"
                  value={host}
                  onChangeText={setHost}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Port *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="8728"
                  placeholderTextColor="#888"
                  value={port}
                  onChangeText={setPort}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Username *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="admin"
                  placeholderTextColor="#888"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="password"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Currency Code</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="AED"
                  placeholderTextColor="#888"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.switchContainer, { flex: 1 }]}>
                <Text style={styles.label}>Use TLS</Text>
                <Switch
                  value={useTls}
                  onValueChange={setUseTls}
                  trackColor={{ false: "#333", true: "#f5a623" }}
                  thumbColor={useTls ? "#fff" : "#aaa"}
                />
              </View>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsAdding(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddRouter}>
                <Text style={styles.submitButtonText}>Save Config</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {routers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Wifi size={36} color="#444" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No routers added</Text>
            <Text style={styles.emptyDesc}>
              Add your MikroTik router connection details to monitor your hotspots.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setIsAdding(true)}
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.emptyButtonText}>Add First Router</Text>
            </TouchableOpacity>
          </View>
        ) : (
          routers.map((item) => {
            const isConnecting = connectingId === item.id;
            const isActive = activeRouter?.id === item.id;

            return (
              <View key={item.id} style={styles.routerCard}>
                <View style={styles.routerInfo}>
                  <View style={styles.routerMainInfo}>
                    <Text style={styles.routerName}>{item.sessionName}</Text>
                    {isActive && (
                      <View style={styles.connectedBadge}>
                        <Check size={10} color="#2e7d32" />
                        <Text style={styles.connectedBadgeText}>Connected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.routerHost}>
                    {item.host}:{item.port} • {item.username}
                  </Text>
                </View>

                <View style={styles.routerActions}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      Alert.alert(
                        "Delete Router",
                        `Are you sure you want to delete ${item.sessionName}?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => void deleteRouter(item.id),
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={16} color="#ef5350" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.connectBtn,
                      isActive && styles.activeConnectBtn,
                    ]}
                    onPress={() => void handleConnect(item.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.connectBtnText}>
                          {isActive ? "Enter" : "Connect"}
                        </Text>
                        <ChevronRight size={14} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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
    backgroundColor: "#121212",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#aaa",
    marginTop: 10,
    fontSize: 15,
  },
  header: {
    alignItems: "center",
    marginVertical: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#f5a623",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: "#888",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: "#f5a623",
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  addButtonInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonInlineText: {
    color: "#f5a623",
    fontWeight: "bold",
    fontSize: 14,
    marginLeft: 4,
  },
  formCard: {
    borderColor: "#f5a623",
  },
  label: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
  },
  formInput: {
    height: 40,
    backgroundColor: "#2a2a2a",
    borderRadius: 6,
    paddingHorizontal: 10,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    fontSize: 13,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 8,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  cancelButtonText: {
    color: "#aaa",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#f5a623",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  emptyDesc: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: "row",
    backgroundColor: "#f5a623",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    gap: 6,
  },
  emptyButtonText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
  routerCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  routerInfo: {
    flex: 1,
    marginRight: 8,
  },
  routerMainInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routerName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#c8e6c9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  connectedBadgeText: {
    color: "#2e7d32",
    fontSize: 9,
    fontWeight: "bold",
  },
  routerHost: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  routerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2d1e20",
    justifyContent: "center",
    alignItems: "center",
  },
  connectBtn: {
    backgroundColor: "#f5a623",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 80,
    justifyContent: "center",
  },
  activeConnectBtn: {
    backgroundColor: "#2e7d32",
  },
  connectBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
});
