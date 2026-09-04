import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LogOut,
  User,
  Shield,
  Info,
  Smartphone,
  CheckCircle,
  Power,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  X,
  Building2,
  Check,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useGateway } from "../../contexts/gateway-context";
import { ConfirmModal } from "../../components/confirm-modal";
import { fetchFromGateway } from "../../lib/api-client";

export default function MoreScreen() {
  const router = useRouter();
  const { gatewayUrl, activeRouter, routers, disconnectRouter } = useGateway();
  const [salesperson, setSalesperson] = useState("Unknown");
  const [displayName, setDisplayName] = useState("Salesperson");
  const [company, setCompany] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Reset HotSpot Session State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetVoucherCode, setResetVoucherCode] = useState("");
  const [selectedResetCampId, setSelectedResetCampId] = useState<string>("auto");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadUser() {
        try {
          const name = await AsyncStorage.getItem("salesperson_name");
          if (!name || name === "Unknown") {
            router.replace("/");
            return;
          }
          const dName = await AsyncStorage.getItem("salesperson_display_name");
          const comp = await AsyncStorage.getItem("salesperson_company");
          setSalesperson(name);
          if (dName) setDisplayName(dName);
          if (comp) setCompany(comp);
        } catch (e) {
          router.replace("/");
        }
      }
      void loadUser();
    }, [router])
  );

  const handleOpenResetModal = () => {
    setResetVoucherCode("");
    setSelectedResetCampId(activeRouter?.id || (routers.length > 0 ? routers[0].id : "auto"));
    setResetError(null);
    setResetSuccess(null);
    setShowResetModal(true);
  };

  const handleExecuteReset = async () => {
    const trimmedCode = resetVoucherCode.trim();
    if (!trimmedCode) {
      setResetError("Please enter a voucher code.");
      return;
    }

    setIsResetting(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const targetRouter =
        selectedResetCampId !== "auto"
          ? routers.find((r) => r.id === selectedResetCampId) || activeRouter
          : undefined;

      const response = await fetchFromGateway<{
        success: boolean;
        message?: string;
        error?: string;
      }>(
        gatewayUrl,
        "/api/mikrotik/users/reset-session",
        targetRouter || activeRouter,
        {
          method: "POST",
          body: {
            voucherCode: trimmedCode,
            routerId: targetRouter?.id,
          },
        }
      );

      if (response.success) {
        setResetSuccess(
          response.message ||
            `Active session for voucher "${trimmedCode}" has been disconnected successfully. The voucher remains valid.`
        );
      } else {
        setResetError(
          response.error || `Could not disconnect session for voucher "${trimmedCode}".`
        );
      }
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : "Failed to communicate with router. Please check connection."
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      // 1. Instantly wipe all local operator session keys & JWT tokens
      await AsyncStorage.multiRemove([
        "salesperson_name",
        "salesperson_display_name",
        "salesperson_id",
        "salesperson_company",
        "salesperson_allowed_camps",
        "auth_token",
        "mikrotik_routers_list",
        "mikrotik_active_router_id",
      ]);

      // 2. Disconnect local router state
      await disconnectRouter();

      // 3. Navigate directly to login screen
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/");
      }
    } catch (e) {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.avatarCircle}>
            <User size={32} color="#4A60D6" />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.salespersonName}>{displayName || salesperson}</Text>
            {company ? (
              <Text style={styles.usernameSubText}>{company}</Text>
            ) : (displayName || "").toLowerCase() !== (salesperson || "").toLowerCase() ? (
              <Text style={styles.usernameSubText}>@{salesperson}</Text>
            ) : null}
          </View>
        </View>

        {/* Voucher Tools Section */}
        <View style={styles.sectionCard}>
          {/* Reset User Session */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleOpenResetModal}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: "#fff7ed" }]}>
              <RotateCcw size={18} color="#ea580c" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: "#ea580c" }]}>Reset Voucher Code</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Clean Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Reset Voucher Modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isResetting) setShowResetModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.resetModalContainer}>
            {/* Header */}
            <View style={styles.resetModalHeader}>
              <View style={styles.resetHeaderIconWrap}>
                <RotateCcw size={20} color="#ea580c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetModalTitle}>Reset</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetModal(false)}
                disabled={isResetting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Target Camp Selector */}
            {routers.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Camp</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.campChipsScroll}
                >
                  {/* Router / Camp Chips */}
                  {routers.map((r) => {
                    const campName = r.camp || r.sessionName || "Camp";
                    const isSelected = selectedResetCampId === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.campChip, isSelected && styles.campChipSelected]}
                        onPress={() => setSelectedResetCampId(r.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.campChipText,
                            isSelected && styles.campChipTextSelected,
                          ]}
                        >
                          {campName}
                        </Text>
                        {isSelected && <Check size={13} color="#ea580c" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Input field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Voucher Code</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter voucher code (e.g. ABC123)"
                placeholderTextColor="#94a3b8"
                value={resetVoucherCode}
                onChangeText={(text) => {
                  setResetVoucherCode(text);
                  if (resetError) setResetError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isResetting}
                returnKeyType="done"
                onSubmitEditing={handleExecuteReset}
              />
            </View>

            {/* Feedback messages */}
            {resetError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorBannerText}>{resetError}</Text>
              </View>
            )}

            {resetSuccess && (
              <View style={styles.successBanner}>
                <CheckCircle2 size={16} color="#16a34a" />
                <Text style={styles.successBannerText}>{resetSuccess}</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResetModal(false)}
                disabled={isResetting}
              >
                <Text style={styles.cancelButtonText}>
                  {resetSuccess ? "Done" : "Cancel"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resetSubmitButton,
                  (!resetVoucherCode.trim() || isResetting) && styles.resetSubmitDisabled,
                ]}
                onPress={handleExecuteReset}
                disabled={!resetVoucherCode.trim() || isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <RotateCcw size={16} color="#ffffff" />
                    <Text style={styles.resetSubmitText}>Reset</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title="Logout Account"
        message={`Are you sure you want to log out from account "${salesperson}"?`}
        confirmText="Logout"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  accountInfo: {
    flex: 1,
    gap: 4,
  },
  salespersonName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  usernameSubText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTextWrap: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  onlineText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#16a34a",
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  loggingOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  resetModalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  resetModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resetHeaderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
  },
  resetModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  resetModalSub: {
    fontSize: 12,
    color: "#64748b",
  },
  noticeBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#ea580c",
  },
  noticeText: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155",
  },
  campChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  campChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  campChipSelected: {
    backgroundColor: "#fff7ed",
    borderColor: "#ea580c",
  },
  campChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  campChipTextSelected: {
    color: "#ea580c",
    fontWeight: "700",
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: "#dc2626",
    fontWeight: "600",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: "#16a34a",
    fontWeight: "600",
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  resetSubmitButton: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ea580c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resetSubmitDisabled: {
    backgroundColor: "#fdba74",
    opacity: 0.7,
  },
  resetSubmitText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8,
    marginTop: 4,
    marginBottom: 24,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
});
