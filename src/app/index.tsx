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
import { fetchFromGateway, type MikrotikRouterConfig } from "../lib/api-client";

export default function GatewayScreen() {
  const router = useRouter();
  const {
    gatewayUrl,
    isConnected,
    loading,
    connectToGateway,
  } = useGateway();

  const [inputUrl, setInputUrl] = useState(gatewayUrl);
  const [isConnectingGateway, setIsConnectingGateway] = useState(false);

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

    try {
      // 1. Verify credentials against central database
      const result = await fetchFromGateway<{
        success: boolean;
        user?: { id?: number; username: string; displayName?: string };
        error?: string;
      }>(
        gatewayUrl,
        "/api/mikrotik/auth/login",
        null,
        {
          method: "POST",
          body: { username: user, password: pass },
        }
      );

      if (result.success && result.user) {
        const dName = result.user.displayName || result.user.username;
        if (result.user.id) {
          await AsyncStorage.setItem("salesperson_id", String(result.user.id));
        }
        await AsyncStorage.setItem("salesperson_name", result.user.username);
        await AsyncStorage.setItem("salesperson_display_name", dName);
        setCurrentUser(dName);
        setLoginUsername("");
        setLoginPassword("");
        Alert.alert("Success", `Logged in as: ${dName}`);
        return;
      }

      Alert.alert("Login Failed", result.error || "Invalid operator credentials");
    } catch {
      // 2. Offline fallback check
      if (
        (user === "Fasil@2020" && pass === "1234") ||
        (user === "Rifai" && pass === "3421")
      ) {
        const dName = user === "Fasil@2020" ? "Fasil" : "Rifai";
        const userId = user === "Fasil@2020" ? "7" : "8";
        await AsyncStorage.setItem("salesperson_id", userId);
        await AsyncStorage.setItem("salesperson_name", user);
        await AsyncStorage.setItem("salesperson_display_name", dName);
        setCurrentUser(dName);
        setLoginUsername("");
        setLoginPassword("");
        Alert.alert("Success", `Logged in as: ${dName}`);
      } else {
        Alert.alert("Error", "Invalid operator credentials or server offline");
      }
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

  const [isGatewaySessionConnected, setIsGatewaySessionConnected] = useState(false);

  useEffect(() => {
    setInputUrl(gatewayUrl);
  }, [gatewayUrl]);

  // Navigate to dashboard only when they explicitly connect in this session
  useEffect(() => {
    if (isGatewaySessionConnected) {
      router.replace("/(dashboard)");
    }
  }, [isGatewaySessionConnected]);

  const handleConnectGateway = async () => {
    if (!inputUrl.trim()) {
      Alert.alert("Error", "Gateway URL cannot be empty");
      return;
    }
    
    setIsConnectingGateway(true);
    try {
      const result = await connectToGateway(inputUrl.trim());
      if (result.success) {
        setIsGatewaySessionConnected(true);
        if (result.routerCount === 0) {
          Alert.alert(
            "Connected",
            "Connected successfully, but no camps are configured yet. Please configure your routers in the Web Admin Portal."
          );
        } else {
          Alert.alert("Success", "Connected to Gateway server successfully!");
        }
      }
    } catch (err) {
      Alert.alert(
        "Connection Failed",
        err instanceof Error ? err.message : "Failed to connect to Gateway server. Please verify the URL."
      );
    } finally {
      setIsConnectingGateway(false);
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
            Enter the URL of your Next.js server and click Connect.
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
            <TouchableOpacity 
              style={[styles.saveButtonLight, isConnectingGateway && { opacity: 0.7 }]} 
              onPress={handleConnectGateway}
              disabled={isConnectingGateway}
            >
              {isConnectingGateway ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonTextLight}>Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
