import { useRouter } from "expo-router";
import {
    Check,
    ChevronRight,
    Edit2,
    Key,
    Plus,
    Trash2,
    User,
    Wifi,
    X
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    updateRouter,
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
  const [editingId, setEditingId] = useState<string | null>(null);

  // Operator Login State
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(true);

  useEffect(() => {
    async function checkLogin() {
      try {
        const storedUser = await AsyncStorage.getItem("salesperson_name");
        if (storedUser) {
          setCurrentUser(storedUser);
        }
      } catch (err) {
        console.error("Failed to load operator login state", err);
      } finally {
        setCheckingLogin(false);
      }
    }
    void checkLogin();
  }, []);

  const handleOperatorLogin = async () => {
    const user = loginUsername.trim();
    const pass = loginPassword;

    if (!user || !pass) {
      Alert.alert("Error", "Please enter both operator username and password");
      return;
    }

    if (
      (user === "Fasil@2020" && pass === "1234") ||
      (user === "Rifai" && pass === "3421")
    ) {
      try {
        await AsyncStorage.setItem("salesperson_name", user);
        setCurrentUser(user);
        setLoginUsername("");
        setLoginPassword("");
        Alert.alert("Success", `Logged in as operator: ${user}`);
      } catch {
        Alert.alert("Error", "Failed to save operator session");
      }
    } else {
      Alert.alert("Error", "Invalid operator credentials");
    }
  };

  const handleOperatorLogout = async () => {
    try {
      await AsyncStorage.removeItem("salesperson_name");
      setCurrentUser(null);
    } catch {
      Alert.alert("Error", "Failed to clear operator session");
    }
  };

  useEffect(() => {
    setInputUrl(gatewayUrl);
  }, [gatewayUrl]);

  // Navigate to dashboard whenever connected (and not still loading).
  useEffect(() => {
    if (!loading && isConnected) {
      router.replace("/(dashboard)");
    }
  }, [isConnected, loading]);

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
      if (editingId) {
        // Update existing router
        await updateRouter({
          id: editingId,
          sessionName: sessionName.trim(),
          host: host.trim(),
          port: Number(port.trim()),
          username: username.trim(),
          password: password,
          useTls,
          currency: currency.trim() || "AED",
        });
        Alert.alert("Success", "Router config updated");
      } else {
        // Add new router
        await addRouter({
          sessionName: sessionName.trim(),
          host: host.trim(),
          port: Number(port.trim()),
          username: username.trim(),
          password: password,
          useTls,
          currency: currency.trim() || "AED",
        });
        Alert.alert("Success", "Router config added");
      }

      // Reset Form
      setSessionName("");
      setHost("");
      setPort("8728");
      setUsername("admin");
      setPassword("");
      setUseTls(false);
      setCurrency("AED");
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      Alert.alert("Error", editingId ? "Failed to update router" : "Failed to add router");
    }
  };

  const handleEditRouter = (routerConfig: MikrotikRouterConfig) => {
    setEditingId(routerConfig.id);
    setSessionName(routerConfig.sessionName);
    setHost(routerConfig.host);
    setPort(String(routerConfig.port));
    setUsername(routerConfig.username);
    setPassword(routerConfig.password || "");
    setUseTls(routerConfig.useTls);
    setCurrency(routerConfig.currency || "AED");
    setIsAdding(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSessionName("");
    setHost("");
    setPort("8728");
    setUsername("admin");
    setPassword("");
    setUseTls(false);
    setCurrency("AED");
    setIsAdding(false);
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    try {
      const success = await connectRouter(id);
      if (success) {
        // Add a small delay to ensure state updates propagate
        setTimeout(() => {
          router.replace("/(dashboard)");
        }, 300);
      } else {
        Alert.alert("Connection Failed", "Unable to establish connection. Please try again.");
      }
    } catch (err) {
      Alert.alert(
        "Connection Failed",
        err instanceof Error ? err.message : "Could not connect to router. Check credentials and gateway status."
      );
    } finally {
      setConnectingId(null);
    }
  };

  if (checkingLogin || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A60D6" />
        <Text style={styles.loadingText}>
          {checkingLogin ? "Checking operator session..." : "Loading configurations..."}
        </Text>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.containerWhite}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ScrollView contentContainerStyle={styles.loginScrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.loginContentWrapper}>
            {/* Logo */}
            <View style={styles.brandLogoContainer}>
              <View style={styles.logoIconBg}>
                <Wifi size={28} color="#4A60D6" />
              </View>
              <Text style={styles.brandLogoText}>
                Smart <Text style={styles.brandLogoTextBlue}>wifi</Text>
              </Text>
              <Text style={styles.brandLogoSub}>IT Service LLC</Text>
            </View>

            {/* Title */}
            <Text style={styles.loginWelcomeText}>
              Welcome to <Text style={styles.loginWelcomeStaff}>Staff</Text> Login
            </Text>

            {/* Card Form */}
            <View style={styles.loginFormCard}>
              <View style={styles.inputWrapperLight}>
                <TextInput
                  style={styles.inputLight}
                  placeholder="Username"
                  placeholderTextColor="#94a3b8"
                  value={loginUsername}
                  onChangeText={setLoginUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <User size={20} color="#94a3b8" style={styles.inputRightIcon} />
              </View>

              <View style={styles.inputWrapperLight}>
                <TextInput
                  style={styles.inputLight}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Key size={20} color="#94a3b8" style={styles.inputRightIcon} />
              </View>

              <TouchableOpacity style={styles.loginButtonIndigo} onPress={handleOperatorLogin}>
                <Text style={styles.loginButtonText}>LOGIN</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require("../../assets/images/login_city_bg.jpg")}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Connected state: Router management list (styled in clean light theme!)
  return (
    <SafeAreaView style={styles.containerLight}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={styles.scrollContainerLight} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.headerLight}>
          <View style={styles.logoBadgeLight}>
            <Wifi size={24} color="#4A60D6" />
          </View>
          <Text style={styles.titleLight}>SmartWifi Gateway</Text>
          <Text style={styles.subtitleLight}>MikroTik RouterOS Gateway Manager</Text>
        </View>

        {/* Operator Session Info */}
        <View style={styles.operatorSessionCardLight}>
          <Text style={styles.operatorSessionTextLight}>
            Operator: <Text style={styles.operatorSessionNameLight}>{currentUser}</Text>
          </Text>
          <TouchableOpacity style={styles.operatorLogoutBtnLight} onPress={handleOperatorLogout}>
            <Text style={styles.operatorLogoutBtnTextLight}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Gateway API Configuration */}
        <View style={styles.cardLight}>
          <Text style={styles.cardTitleLight}>Next.js Gateway Server</Text>
          <Text style={styles.cardDescLight}>
            Specify the base URL of your running Next.js application proxy.
          </Text>
          <View style={styles.inputRowLight}>
            <TextInput
              style={styles.inputLightConfig}
              placeholder="e.g. http://192.168.1.5:3000"
              placeholderTextColor="#94a3b8"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveButtonLight} onPress={handleSaveGateway}>
              <Text style={styles.saveButtonTextLight}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Router List */}
        <View style={styles.sectionHeaderLight}>
          <Text style={styles.sectionTitleLight}>Your MikroTik Routers</Text>
          {!isAdding && (
            <TouchableOpacity
              style={styles.addButtonInlineLight}
              onPress={() => setIsAdding(true)}
            >
              <Plus size={16} color="#4A60D6" />
              <Text style={styles.addButtonInlineTextLight}>Add New</Text>
            </TouchableOpacity>
          )}
        </View>

        {isAdding && (
          <View style={[styles.cardLight, styles.formCardLight]}>
            <View style={styles.formHeaderLight}>
              <Text style={styles.cardTitleLight}>
                {editingId ? "Edit Router Configuration" : "Add Router Configuration"}
              </Text>
              <TouchableOpacity onPress={handleCancelEdit}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.labelLight}>Session Name *</Text>
            <TextInput
              style={styles.formInputLight}
              placeholder="e.g. Office Core"
              placeholderTextColor="#94a3b8"
              value={sessionName}
              onChangeText={setSessionName}
            />

            <View style={styles.formRowLight}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.labelLight}>IP Address / Host *</Text>
                <TextInput
                  style={styles.formInputLight}
                  placeholder="e.g. 192.168.88.1"
                  placeholderTextColor="#94a3b8"
                  value={host}
                  onChangeText={setHost}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelLight}>Port *</Text>
                <TextInput
                  style={styles.formInputLight}
                  placeholder="8728"
                  placeholderTextColor="#94a3b8"
                  value={port}
                  onChangeText={setPort}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formRowLight}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.labelLight}>Username *</Text>
                <TextInput
                  style={styles.formInputLight}
                  placeholder="admin"
                  placeholderTextColor="#94a3b8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.labelLight}>Password</Text>
                <TextInput
                  style={styles.formInputLight}
                  placeholder="password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.formRowLight}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.labelLight}>Currency Code</Text>
                <TextInput
                  style={styles.formInputLight}
                  placeholder="AED"
                  placeholderTextColor="#94a3b8"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.switchContainerLight, { flex: 1 }]}>
                <Text style={styles.labelLight}>Use TLS</Text>
                <Switch
                  value={useTls}
                  onValueChange={setUseTls}
                  trackColor={{ false: "#e2e8f0", true: "#4A60D6" }}
                  thumbColor={useTls ? "#fff" : "#cbd5e1"}
                />
              </View>
            </View>

            <View style={styles.formActionsLight}>
              <TouchableOpacity
                style={styles.cancelButtonLight}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonTextLight}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButtonLight} onPress={handleAddRouter}>
                <Text style={styles.submitButtonTextLight}>
                  {editingId ? "Update Config" : "Save Config"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {routers.length === 0 ? (
          <View style={styles.emptyCardLight}>
            <Wifi size={36} color="#94a3b8" style={styles.emptyIconLight} />
            <Text style={styles.emptyTitleLight}>No routers added</Text>
            <Text style={styles.emptyDescLight}>
              Add your MikroTik router connection details to monitor your hotspots.
            </Text>
            <TouchableOpacity
              style={styles.emptyButtonLight}
              onPress={() => setIsAdding(true)}
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.emptyButtonTextLight}>Add First Router</Text>
            </TouchableOpacity>
          </View>
        ) : (
          routers.map((item) => {
            const isConnecting = connectingId === item.id;
            const isActive = activeRouter?.id === item.id;

            return (
              <View key={item.id} style={styles.routerCardLight}>
                <View style={styles.routerInfoLight}>
                  <View style={styles.routerMainInfoLight}>
                    <Text style={styles.routerNameLight}>{item.sessionName}</Text>
                    {isActive && (
                      <View style={styles.connectedBadgeLight}>
                        <Check size={10} color="#16a34a" />
                        <Text style={styles.connectedBadgeTextLight}>Connected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.routerHostLight}>
                    {item.host}:{item.port} • {item.username}
                  </Text>
                </View>

                <View style={styles.routerActionsLight}>
                  <TouchableOpacity
                    style={styles.editBtnLight}
                    onPress={() => handleEditRouter(item)}
                  >
                    <Edit2 size={16} color="#4A60D6" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtnLight}
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
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.connectBtnLight,
                      isActive && styles.activeConnectBtnLight,
                    ]}
                    onPress={() => void handleConnect(item.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.connectBtnTextLight}>
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
  containerWhite: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loginScrollContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingBottom: 20,
  },
  loginContentWrapper: {
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  brandLogoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIconBg: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  brandLogoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
  },
  brandLogoTextBlue: {
    color: "#4A60D6",
  },
  brandLogoSub: {
    fontSize: 12,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  loginWelcomeText: {
    fontSize: 22,
    color: "#1E293B",
    marginBottom: 30,
    fontWeight: "500",
  },
  loginWelcomeStaff: {
    fontWeight: "bold",
    color: "#4A60D6",
  },
  loginFormCard: {
    width: "100%",
    maxWidth: 360,
  },
  inputWrapperLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  inputLight: {
    flex: 1,
    height: "100%",
    color: "#1E293B",
    fontSize: 15,
  },
  inputRightIcon: {
    marginLeft: 10,
  },
  loginButtonIndigo: {
    backgroundColor: "#4A60D6",
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#4A60D6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  illustrationContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  illustrationImage: {
    width: "100%",
    height: 190,
  },

  // Gateway Config / Router Manager Light Theme Styles
  containerLight: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContainerLight: {
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
    color: "#64748B",
    marginTop: 10,
    fontSize: 15,
  },
  headerLight: {
    alignItems: "center",
    marginVertical: 24,
  },
  logoBadgeLight: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  titleLight: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    letterSpacing: 0.5,
  },
  subtitleLight: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  operatorSessionCardLight: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  operatorSessionTextLight: {
    color: "#64748B",
    fontSize: 13,
  },
  operatorSessionNameLight: {
    color: "#4A60D6",
    fontWeight: "bold",
  },
  operatorLogoutBtnLight: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  operatorLogoutBtnTextLight: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardLight: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitleLight: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  cardDescLight: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 16,
  },
  inputRowLight: {
    flexDirection: "row",
  },
  inputLightConfig: {
    flex: 1,
    height: 44,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
  },
  saveButtonLight: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonTextLight: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionHeaderLight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleLight: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  addButtonInlineLight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonInlineTextLight: {
    color: "#4A60D6",
    fontWeight: "bold",
    fontSize: 14,
  },
  formCardLight: {
    borderColor: "#4A60D6",
  },
  formHeaderLight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  labelLight: {
    color: "#475569",
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
    fontWeight: "600",
  },
  formInputLight: {
    height: 40,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    paddingHorizontal: 10,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 13,
  },
  formRowLight: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  switchContainerLight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 8,
  },
  formActionsLight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancelButtonLight: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  cancelButtonTextLight: {
    color: "#64748B",
    fontSize: 14,
  },
  submitButtonLight: {
    backgroundColor: "#4A60D6",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonTextLight: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyCardLight: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyIconLight: {
    marginBottom: 12,
  },
  emptyTitleLight: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  emptyDescLight: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyButtonLight: {
    flexDirection: "row",
    backgroundColor: "#4A60D6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    gap: 6,
  },
  emptyButtonTextLight: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  routerCardLight: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  routerInfoLight: {
    flex: 1,
    marginRight: 8,
  },
  routerMainInfoLight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routerNameLight: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E293B",
  },
  connectedBadgeLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  connectedBadgeTextLight: {
    color: "#16a34a",
    fontSize: 9,
    fontWeight: "bold",
  },
  routerHostLight: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  routerActionsLight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editBtnLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  connectBtnLight: {
    backgroundColor: "#4A60D6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 72,
    justifyContent: "center",
  },
  activeConnectBtnLight: {
    backgroundColor: "#16a34a",
  },
  connectBtnTextLight: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
