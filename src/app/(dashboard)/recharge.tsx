import { Check, Clock, CreditCard, Phone } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

interface VoucherCode {
  id: string;
  code: string;
  validity: number; // in days
  profile: string;
  status: "available" | "used" | "expired";
  createdAt: string;
  usedAt?: string;
}

interface HotspotUser {
  id: string;
  username: string;
  profile: string;
  status: "active" | "disabled" | "expired";
  createdAt: string;
}

interface RechargeData {
  vouchers: VoucherCode[];
  currency: string;
}

function parseValidityDays(value: string | undefined): number {
  const target = String(value || "").trim();
  if (!target) return 0;

  const match = target.match(/(\d+)\D*days?/i);
  if (match) return Number(match[1]);

  const numeric = Number(target.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export default function RechargeScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [data, setData] = useState<RechargeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [selectedCode, setSelectedCode] = useState<VoucherCode | null>(null);
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    code: string;
    mobile: string;
    validity: number;
    timestamp: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ users: HotspotUser[] }>(
        gatewayUrl,
        "/api/mikrotik/users",
        activeRouter
      );

      const vouchers = payload.users
        .map((user) => ({
          id: user.id,
          code: user.username,
          profile: user.profile,
          validity: parseValidityDays(user.profile),
          status:
            user.status === "active"
              ? "available"
              : user.status === "expired"
              ? "expired"
              : "used",
          createdAt: user.createdAt,
        }))
        .filter((voucher) => voucher.validity > 0 && voucher.status === "available");

      setData({
        vouchers,
        currency: activeRouter?.currency ?? "AED",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recharge data");
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Get available codes for selected plan
  const planGroups = useMemo(() => {
    if (!data) return [];

    const groups = data.vouchers
      .filter((voucher) => voucher.status === "available" && voucher.validity > 0)
      .reduce<Record<number, VoucherCode[]>>((acc, voucher) => {
        acc[voucher.validity] = acc[voucher.validity] || [];
        acc[voucher.validity].push(voucher);
        return acc;
      }, {});

    return Object.entries(groups)
      .map(([validity, vouchers]) => ({
        days: Number(validity),
        vouchers,
      }))
      .sort((a, b) => a.days - b.days);
  }, [data]);

  useEffect(() => {
    if (planGroups.length > 0 && !planGroups.some((group) => group.days === selectedPlan)) {
      setSelectedPlan(planGroups[0].days);
    }
  }, [planGroups, selectedPlan]);

  useEffect(() => {
    const group = planGroups.find((g) => g.days === selectedPlan);
    setSelectedCode(group?.vouchers[0] ?? null);
  }, [planGroups, selectedPlan]);

  const handleSelectPlan = (days: number) => {
    setSelectedPlan(days);
  };

  const selectedPlanCount = planGroups.find((group) => group.days === selectedPlan)?.vouchers.length ?? 0;

  const handleConfirmRecharge = async () => {
    if (!mobileNumber.trim()) {
      Alert.alert("Error", "Please enter mobile number");
      return;
    }

    if (!selectedCode) {
      Alert.alert("Error", "Please select a plan");
      return;
    }

    if (mobileNumber.trim().length < 8 || mobileNumber.trim().length > 12) {
      Alert.alert("Error", "Mobile number should be 8-12 digits");
      return;
    }

    if (!activeRouter) return;

    setProcessingCode(selectedCode.id);
    try {
      const result = await fetchFromGateway<{ success: boolean; message?: string }>(
        gatewayUrl,
        "/api/mikrotik/vouchers/redeem",
        activeRouter,
        {
          method: "POST",
          body: {
            voucherId: selectedCode.id,
            mobileNumber: mobileNumber.trim(),
          },
        }
      );

      if (result.success) {
        const transaction = {
          code: selectedCode.code,
          mobile: mobileNumber,
          validity: selectedCode.validity,
          timestamp: new Date().toLocaleString(),
        };
        setLastTransaction(transaction);
        setShowReceipt(true);

        // Reset form
        setMobileNumber("");
        setSelectedCode(null);

        // Reload data
        await loadData();

        Alert.alert("Success", "Recharge completed successfully!");
      } else {
        throw new Error(result.message || "Recharge failed");
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to process recharge"
      );
    } finally {
      setProcessingCode(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1e1e1e" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={styles.loadingText}>Loading recharge data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1e1e1e" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1e1e" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <CreditCard size={40} color="#f5a623" style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Quick Recharge</Text>
          <Text style={styles.heroSubtitle}>Select a plan and recharge instantly</Text>
        </View>

        {/* Mobile Number Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mobile Number</Text>
          <View style={styles.inputWrapper}>
            <Phone size={18} color="#f5a623" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter mobile number"
              placeholderTextColor="#888"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              editable={!showReceipt}
            />
          </View>
          <Text style={styles.inputHint}>Voucher details will be sent to this number</Text>
        </View>

        {/* Plans Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Plans</Text>
          {planGroups.length > 0 ? (
            <View style={styles.plansGrid}>
              {planGroups.map((group) => (
                <TouchableOpacity
                  key={group.days}
                  style={[
                    styles.planCard,
                    selectedPlan === group.days && styles.planCardSelected,
                  ]}
                  onPress={() => handleSelectPlan(group.days)}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planDays}>{`${group.days} Days`}</Text>
                    {selectedPlan === group.days && (
                      <Check size={18} color="#f5a623" style={styles.checkmark} />
                    )}
                  </View>
                  <View style={styles.planFooter}>
                    <Clock size={14} color="#999" />
                    <Text style={styles.planCodeCount}>{group.vouchers.length} available</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noCodesBox}>
              <Text style={styles.noCodesTitle}>No active recharge plans</Text>
              <Text style={styles.noCodesDesc}>
                There are no available active codes to recharge right now.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Plan</Text>
          <View style={styles.planSummaryCard}>
            <Text style={styles.planSummaryText}>
              {selectedPlan} Days
            </Text>
            <Text style={styles.planSummarySubtext}>
              Matching active recharge code is selected automatically.
            </Text>
          </View>

          {!selectedCode ? (
            <View style={styles.noCodesBox}>
              <Text style={styles.noCodesTitle}>Plan unavailable</Text>
              <Text style={styles.noCodesDesc}>
                There are no available codes for this plan. Choose another day.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Confirm Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!selectedCode || !mobileNumber.trim()) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirmRecharge}
            disabled={!selectedCode || !mobileNumber.trim() || !!processingCode}
          >
            {processingCode ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.confirmButtonText}>Confirm Recharge</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Receipt Modal */}
        {showReceipt && lastTransaction && (
          <View style={styles.receiptOverlay}>
            <View style={styles.receiptCard}>
              <View style={styles.receiptSuccess}>
                <Check size={40} color="#2ecc71" />
              </View>
              <Text style={styles.receiptTitle}>Success!</Text>
              <Text style={styles.receiptSubtitle}>Thank You For Your Recharge</Text>

              <View style={styles.receiptContent}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Voucher Code</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.code}</Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Mobile Number</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.mobile}</Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Validity</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.validity} Days</Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Time</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.timestamp}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.receiptButton}
                onPress={() => setShowReceipt(false)}
              >
                <Text style={styles.receiptButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#ef5350",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#f5a623",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#000",
    fontWeight: "bold",
  },

  // Hero Section
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    marginTop: 16,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#999",
  },

  // Sections
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },

  // Mobile Input
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    paddingVertical: 12,
    fontSize: 14,
  },
  inputHint: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },

  // Plans Grid
  plansGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  planCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: "#3a3a3a",
  },
  planCardSelected: {
    borderColor: "#f5a623",
    backgroundColor: "#2d2416",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  planDays: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  checkmark: {
    marginRight: 0,
  },
  planFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  planCodeCount: {
    fontSize: 12,
    color: "#999",
  },

  // No Codes Box
  noCodesBox: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  noCodesTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  noCodesDesc: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
  },

  planSummaryCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    marginBottom: 12,
  },
  planSummaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  planSummarySubtext: {
    fontSize: 12,
    color: "#999",
  },

  // Action Section
  actionSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: "#f5a623",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },

  // Receipt Overlay
  receiptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  receiptCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  receiptSuccess: {
    alignItems: "center",
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  receiptSubtitle: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    marginBottom: 16,
  },
  receiptContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 12,
    color: "#888",
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f5a623",
  },
  receiptDivider: {
    height: 1,
    backgroundColor: "#3a3a3a",
  },
  receiptButton: {
    backgroundColor: "#f5a623",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  receiptButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
});
