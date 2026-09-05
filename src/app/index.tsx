import { useRouter, useFocusEffect } from "expo-router";
import {
    Check,
    ChevronRight,
    Edit2,
    Key,
    Plus,
    Trash2,
    User,
    Wifi,
    X,
    Eye,
    EyeOff
} from "lucide-react-native";
import { useEffect, useState, useCallback } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../contexts/gateway-context";
import { fetchFromGateway, type MikrotikRouterConfig } from "../lib/api-client";
import { SHOW_GATEWAY_CONFIG_SCREEN, DEFAULT_GATEWAY_URL } from "../constants/config";

export default function GatewayScreen() {
  const router = useRouter();
  const {
    gatewayUrl,
    isConnected,
    loading,
    connectToGateway,
  } = useGateway();

  // Operator Login State
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function checkLogin() {
        try {
          const storedUser = await AsyncStorage.getItem("salesperson_name");
          if (!isMounted) return;

          if (storedUser && storedUser !== "Unknown") {
            const token = await AsyncStorage.getItem("auth_token");
            const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");
            let allowedCamps: string[] = [];
            if (allowedStr) {
              try {
                const parsed = JSON.parse(allowedStr);
                if (Array.isArray(parsed)) allowedCamps = parsed;
              } catch {}
            }
            setCurrentUser(storedUser);
            void connectToGateway(gatewayUrl || DEFAULT_GATEWAY_URL, token || undefined, allowedCamps);
            router.replace("/(dashboard)/dashboard-main");
          } else {
            setCurrentUser(null);
            setLoginPassword("");
          }
        } catch (err) {
          console.error("Failed to load operator login state", err);
          if (isMounted) setCurrentUser(null);
        } finally {
          if (isMounted) setCheckingLogin(false);
        }
      }
      void checkLogin();
      return () => {
        isMounted = false;
      };
    }, [gatewayUrl, connectToGateway])
  );

  const handleOperatorLogin = async () => {
    const user = loginUsername.trim();
    const pass = loginPassword;
    setLoginError(null);

    if (!user || !pass) {
      const msg = "Please enter both username and password";
      setLoginError(msg);
      Alert.alert("Error", msg);
      return;
    }

    setIsLoggingIn(true);
    try {
      // 1. Verify credentials against central database
      const activeUrl = gatewayUrl || DEFAULT_GATEWAY_URL;
      const result = await fetchFromGateway<{
        success: boolean;
        token?: string;
        user?: {
          id?: number;
          username: string;
          displayName?: string;
          companyName?: string;
          allowedCamps?: string[];
        };
        error?: string;
      }>(
        activeUrl,
        "/api/mikrotik/auth/login",
        null,
        {
          method: "POST",
          body: { username: user, password: pass },
        }
      );

      if (result.success && result.user) {
        const dName = result.user.displayName || result.user.username;
        if (result.token) {
          await AsyncStorage.setItem("auth_token", result.token);
        }
        if (result.user.id) {
          await AsyncStorage.setItem("salesperson_id", String(result.user.id));
        }
        await AsyncStorage.setItem("salesperson_name", result.user.username);
        await AsyncStorage.setItem("salesperson_display_name", dName);
        if (result.user.companyId) {
          await AsyncStorage.setItem("salesperson_company_id", String(result.user.companyId));
        } else {
          await AsyncStorage.removeItem("salesperson_company_id");
        }
        if (result.user.companyName) {
          await AsyncStorage.setItem("salesperson_company", result.user.companyName);
        } else {
          await AsyncStorage.removeItem("salesperson_company");
        }
        if (result.user.allowedCamps) {
          await AsyncStorage.setItem("salesperson_allowed_camps", JSON.stringify(result.user.allowedCamps));
        } else {
          await AsyncStorage.removeItem("salesperson_allowed_camps");
        }
        setCurrentUser(dName);
        setLoginUsername("");
        setLoginPassword("");
        setLoginError(null);

        try {
          await connectToGateway(activeUrl, result.token, result.user.allowedCamps);
        } catch (e) {
          console.warn("Auto gateway connect warning:", e);
        }
        router.replace("/(dashboard)/dashboard-main");
        return;
      }

      const errMsg = result.error || "Invalid operator credentials. Please check your username and password.";
      setLoginError(errMsg);
      Alert.alert("Login Failed", errMsg);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : "Cannot reach backend server. Please check connection.";
      setLoginError(errorMsg);
      Alert.alert("Connection Error", errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (checkingLogin || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>
          {checkingLogin ? "Checking operator session..." : "Loading configurations..."}
        </Text>
      </View>
    );
  }

  if (currentUser) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Connecting...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.containerWhite}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.loginScrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.loginContentWrapper}>
          {/* Brand Logo */}
          <View style={styles.brandLogoContainer}>
            <Image
              source={require("../../assets/images/app-logo.png")}
              style={{ width: 90, height: 90, marginBottom: 8, borderRadius: 18 }}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.loginWelcomeText}>
            Welcome to <Text style={styles.loginWelcomeStaff}>Staff</Text> Login
          </Text>

          {/* Card Form */}
          <View style={styles.loginFormCard}>
            {loginError ? (
              <View style={styles.loginErrorBanner}>
                <Text style={styles.loginErrorText}>{loginError}</Text>
              </View>
            ) : null}

            <View style={styles.inputWrapperLight}>
              <TextInput
                style={styles.inputLight}
                placeholder="Username"
                placeholderTextColor="#94a3b8"
                value={loginUsername}
                onChangeText={(text) => {
                  setLoginUsername(text);
                  if (loginError) setLoginError(null);
                }}
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
                onChangeText={(text) => {
                  setLoginPassword(text);
                  if (loginError) setLoginError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#64748B" />
                ) : (
                  <Eye size={20} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButtonRed, isLoggingIn && { opacity: 0.7 }]}
              onPress={handleOperatorLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>LOGIN</Text>
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
    backgroundColor: "#ffffff",
    paddingBottom: 0,
  },
  loginContentWrapper: {
    paddingHorizontal: 24,
    paddingTop: 30,
    alignItems: "center",
  },
  brandLogoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoIconBg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  brandLogoText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1E293B",
  },
  brandLogoTextRed: {
    color: "#DC2626",
  },
  brandLogoSub: {
    fontSize: 12,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  loginWelcomeText: {
    fontSize: 20,
    color: "#1E293B",
    marginBottom: 16,
    fontWeight: "500",
  },
  loginWelcomeStaff: {
    fontWeight: "bold",
    color: "#DC2626",
  },
  loginFormCard: {
    width: "100%",
    maxWidth: 360,
  },
  loginErrorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  loginErrorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  inputWrapperLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 12,
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
  eyeIconButton: {
    padding: 6,
    marginLeft: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonRed: {
    backgroundColor: "#DC2626",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
    overflow: "hidden",
  },
  illustrationContainerGateway: {
    marginHorizontal: -16,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 20,
    overflow: "hidden",
  },
  illustrationImage: {
    width: "100%",
    height: 220,
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
