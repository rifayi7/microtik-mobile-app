import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Phone,
} from "lucide-react-native";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";
import { formatCurrency } from "../../lib/format";

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
  comment?: string;
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
  const { gatewayUrl, activeRouter, routers } = useGateway();
  const [data, setData] = useState<RechargeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesperson, setSalesperson] = useState("Unknown");

  // Form states
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [selectedCode, setSelectedCode] = useState<VoucherCode | null>(null);
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [rechargeMode, setRechargeMode] = useState<"select" | "manual">("select");
  const [manualVoucherCode, setManualVoucherCode] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [step, setStep] = useState<"entry" | "confirmation" | "success">("entry");
  const [showCampDropdown, setShowCampDropdown] = useState(false);
  const [showValidityDropdown, setShowValidityDropdown] = useState(false);

  const [lastTransaction, setLastTransaction] = useState<{
    code: string;
    mobile: string;
    validity: number;
    timestamp: string;
    camp: string;
    paymentType: string;
  } | null>(null);

  const camps = useMemo(() => {
    // Get unique camp names from routers configured in Next.js portal
    const list = routers
      .map((r) => r.camp)
      .filter((c): c is string => !!c);
    
    const unique = Array.from(new Set(list));
    if (unique.length === 0) {
      const defaultCamp = activeRouter?.camp || "APM-DXB-camp-1 - Apricom DXB";
      return [defaultCamp, "APM-DXB-camp-2 - Apricom DXB 2", "APM-SHJ-camp-1 - Sharjah Main"];
    }
    return unique;
  }, [routers, activeRouter]);

  const [selectedCamp, setSelectedCamp] = useState("");

  useEffect(() => {
    if (camps.length > 0) {
      setSelectedCamp(camps[0]);
    }
  }, [camps]);

  useEffect(() => {
    async function loadSalesperson() {
      const user = await AsyncStorage.getItem("salesperson_name");
      if (user) {
        setSalesperson(user);
      }
    }
    void loadSalesperson();
  }, []);

  const loadData = useCallback(async () => {
    const targetRouter = routers.find((r) => r.camp === selectedCamp) || activeRouter;
    if (!targetRouter) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ users: HotspotUser[] }>(
        gatewayUrl,
        "/api/mikrotik/users",
        targetRouter
      );

      const vouchers = payload.users
        .map((user) => ({
          id: user.id,
          code: user.username,
          profile: user.profile,
          validity: parseValidityDays(user.profile),
          status:
            (user.comment && user.comment.includes("Mobile:")) || user.status !== "active"
              ? ("used" as const)
              : ("available" as const),
          createdAt: user.createdAt,
        }))
        .filter((voucher) => voucher.validity > 0 && voucher.status === "available");

      setData({
        vouchers,
        currency: targetRouter.currency ?? "AED",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recharge data");
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl, activeRouter, routers, selectedCamp]);

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

  const handleConfirmRecharge = async () => {
    if (!mobileNumber.trim()) {
      Alert.alert("Error", "Please enter mobile number");
      return;
    }

    if (rechargeMode === "manual") {
      if (!manualVoucherCode.trim()) {
        Alert.alert("Error", "Please enter voucher code");
        return;
      }
    } else {
      if (!selectedCode) {
        Alert.alert("Error", "Please select a plan");
        return;
      }
    }

    if (mobileNumber.trim().length < 8 || mobileNumber.trim().length > 12) {
      Alert.alert("Error", "Mobile number should be 8-12 digits");
      return;
    }

    const targetRouter = routers.find((r) => r.camp === selectedCamp) || activeRouter;
    if (!targetRouter) return;

    setProcessingCode(rechargeMode === "manual" ? "manual" : selectedCode!.id);
    try {
      const result = await fetchFromGateway<{ 
        success: boolean; 
        code?: string; 
        validity?: number; 
        message?: string; 
      }>(
        gatewayUrl,
        "/api/mikrotik/vouchers/redeem",
        targetRouter,
        {
          method: "POST",
          body: rechargeMode === "manual"
            ? {
                voucherCode: manualVoucherCode.trim(),
                mobileNumber: mobileNumber.trim(),
                salesperson,
              }
            : {
                voucherId: selectedCode!.id,
                mobileNumber: mobileNumber.trim(),
                salesperson,
              },
        }
      );

      if (result.success) {
        const transaction = {
          code: result.code || (rechargeMode === "manual" ? manualVoucherCode.trim() : selectedCode!.code),
          mobile: mobileNumber,
          validity: result.validity || (rechargeMode === "manual" ? 0 : selectedCode!.validity),
          timestamp: new Date().toLocaleString(),
          camp: selectedCamp,
          paymentType: paymentType,
        };
        setLastTransaction(transaction);
        setStep("success");

        // Reset form
        setMobileNumber("");
        setManualVoucherCode("");
        setSelectedCode(null);

        // Reload data
        await loadData();
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
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading recharge data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header (Top Profile Bar) */}
      <View style={styles.topProfileBar}>
        <View style={styles.welcomeInfo}>
          <Text style={styles.welcomeHello}>Hello {salesperson}</Text>
          <Text style={styles.welcomeSubtitle}>Welcome</Text>
        </View>
        <View style={styles.headerRightControls}>
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={20} color="#334155" />
          </TouchableOpacity>
          <View style={styles.profileBadge}>
            <View style={styles.profileBadgeTextContainer}>
              <Text style={styles.profileBadgeName}>{salesperson.substring(0, 10)}</Text>
              <Text style={styles.profileBadgeRole}>STAFF</Text>
            </View>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{salesperson.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress Steps Tracker */}
      <View style={styles.stepsContainer}>
        <TouchableOpacity 
          style={[styles.stepItem, step === "entry" && styles.stepItemActive]}
          onPress={() => step !== "success" && setStep("entry")}
        >
          <Text style={[styles.stepText, step === "entry" && styles.stepTextActive]}>Entry</Text>
          {step === "entry" && <View style={styles.stepUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.stepItem, step === "confirmation" && styles.stepItemActive]}
          onPress={() => step === "confirmation" && setStep("confirmation")}
          disabled={step === "entry"}
        >
          <Text style={[styles.stepText, step === "confirmation" && styles.stepTextActive]}>Confirmation</Text>
          {step === "confirmation" && <View style={styles.stepUnderline} />}
        </TouchableOpacity>

        <View style={[styles.stepItem, step === "success" && styles.stepItemActive]}>
          <Text style={[styles.stepText, step === "success" && styles.stepTextActive]}>Success</Text>
          {step === "success" && <View style={styles.stepUnderline} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === "entry" && (
          <View style={styles.formContainer}>
            {/* Select Camp Dropdown */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Select Camp</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector} 
                onPress={() => {
                  setShowCampDropdown(!showCampDropdown);
                  setShowValidityDropdown(false);
                }}
              >
                <View style={styles.dropdownSelectorLeft}>
                  <Building2 size={18} color="#4A60D6" style={styles.fieldIcon} />
                  <Text style={styles.dropdownSelectorText} numberOfLines={1}>{selectedCamp}</Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>

              {showCampDropdown && (
                <View style={styles.dropdownOptionsContainer}>
                  {camps.map((camp, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.dropdownOptionItem}
                      onPress={() => {
                        setSelectedCamp(camp);
                        setShowCampDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{camp}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Mobile Number Input */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#4A60D6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor="#94a3b8"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Choose the Validity Dropdown */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Choose the Validity</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector} 
                onPress={() => {
                  setShowValidityDropdown(!showValidityDropdown);
                  setShowCampDropdown(false);
                }}
              >
                <View style={styles.dropdownSelectorLeft}>
                  <View style={styles.checkmarkIconBg}>
                    <Check size={12} color="#ffffff" />
                  </View>
                  <Text style={styles.dropdownSelectorText}>
                    {rechargeMode === "manual" ? "Manual Code" : `${selectedPlan} Days`}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>

              {showValidityDropdown && (
                <View style={styles.dropdownOptionsContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownOptionItem}
                    onPress={() => {
                      setRechargeMode("manual");
                      setShowValidityDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>Manual Code Entry</Text>
                  </TouchableOpacity>
                  {planGroups.map((group) => (
                    <TouchableOpacity 
                      key={group.days} 
                      style={styles.dropdownOptionItem}
                      onPress={() => {
                        setRechargeMode("select");
                        handleSelectPlan(group.days);
                        setShowValidityDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{group.days} Days ({group.vouchers.length} available)</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Manual Code Input (Visible only if rechargeMode === "manual") */}
            {rechargeMode === "manual" && (
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Manual Voucher Code</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter manual 9-character code"
                    placeholderTextColor="#94a3b8"
                    value={manualVoucherCode}
                    onChangeText={setManualVoucherCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}

            {/* Choose Payment Type */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Choose payment type</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity 
                  style={[styles.segmentButton, paymentType === "cash" && styles.segmentButtonActive]}
                  onPress={() => setPaymentType("cash")}
                >
                  <Text style={[styles.segmentText, paymentType === "cash" && styles.segmentTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.segmentButton, paymentType === "credit" && styles.segmentButtonActive]}
                  onPress={() => setPaymentType("credit")}
                >
                  <Text style={[styles.segmentText, paymentType === "credit" && styles.segmentTextActive]}>Credit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Next Button */}
            <TouchableOpacity 
              style={styles.nextButton}
              onPress={() => {
                if (!mobileNumber.trim()) {
                  Alert.alert("Error", "Please enter mobile number");
                  return;
                }
                if (mobileNumber.trim().length < 8 || mobileNumber.trim().length > 12) {
                  Alert.alert("Error", "Mobile number should be 8-12 digits");
                  return;
                }
                if (rechargeMode === "manual" && !manualVoucherCode.trim()) {
                  Alert.alert("Error", "Please enter manual voucher code");
                  return;
                }
                if (rechargeMode === "select" && !selectedCode) {
                  Alert.alert("Error", "No available vouchers for selected plan");
                  return;
                }
                setStep("confirmation");
              }}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "confirmation" && (
          <View style={styles.confirmationContainer}>
            <View style={styles.receiptCard}>
              <Text style={styles.confirmHeaderTitle}>Confirm Details</Text>
              <Text style={styles.confirmHeaderSub}>Please verify customer recharge information</Text>

              <View style={styles.confirmDetailsWrapper}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Selected Camp</Text>
                  <Text style={styles.receiptValue}>{selectedCamp}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Mobile Number</Text>
                  <Text style={styles.receiptValue}>{mobileNumber}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Validity Period</Text>
                  <Text style={styles.receiptValue}>
                    {rechargeMode === "manual" ? "Manual Voucher Code" : `${selectedPlan} Days`}
                  </Text>
                </View>
                <View style={styles.receiptDivider} />

                {rechargeMode === "manual" && (
                  <>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Voucher Code</Text>
                      <Text style={styles.receiptValue}>{manualVoucherCode}</Text>
                    </View>
                    <View style={styles.receiptDivider} />
                  </>
                )}

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment Method</Text>
                  <Text style={[styles.receiptValue, {textTransform: 'capitalize'}]}>{paymentType}</Text>
                </View>
              </View>

              <View style={styles.confirmActionRow}>
                <TouchableOpacity 
                  style={styles.confirmBackBtn} 
                  onPress={() => setStep("entry")}
                >
                  <Text style={styles.confirmBackBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmSubmitBtn}
                  onPress={handleConfirmRecharge}
                  disabled={!!processingCode}
                >
                  {processingCode ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmSubmitBtnText}>Confirm & Recharge</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {step === "success" && lastTransaction && (
          <View style={styles.successContainer}>
            <View style={styles.receiptCard}>
              <View style={styles.successCheckIconBg}>
                <Check size={36} color="#ffffff" />
              </View>
              <Text style={styles.receiptTitle}>Success!</Text>
              <Text style={styles.receiptSubtitle}>Thank You For Your Recharge</Text>

              <View style={styles.confirmDetailsWrapper}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Voucher Code</Text>
                  <Text style={styles.receiptValueCode}>{lastTransaction.code}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Mobile Number</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.mobile}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Validity</Text>
                  <Text style={styles.receiptValue}>
                    {lastTransaction.validity > 0 ? `${lastTransaction.validity} Days` : "Custom"}
                  </Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Selected Camp</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.camp}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment Type</Text>
                  <Text style={[styles.receiptValue, {textTransform: 'capitalize'}]}>{lastTransaction.paymentType}</Text>
                </View>
                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Time</Text>
                  <Text style={styles.receiptValue}>{lastTransaction.timestamp}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.doneBtn}
                onPress={() => {
                  setStep("entry");
                  setLastTransaction(null);
                }}
              >
                <Text style={styles.doneBtnText}>Done</Text>
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
    backgroundColor: "#F8FAFC",
  },
  topProfileBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeHello: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  headerRightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  profileBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  profileBadgeTextContainer: {
    marginLeft: 4,
  },
  profileBadgeName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A60D6",
  },
  profileBadgeRole: {
    fontSize: 8,
    color: "#64748B",
    fontWeight: "bold",
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4A60D6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Steps Tracker
  stepsContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    alignItems: "center",
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  stepItemActive: {
    // optional styling
  },
  stepText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  stepTextActive: {
    color: "#4A60D6",
    fontWeight: "700",
  },
  stepUnderline: {
    position: "absolute",
    bottom: 0,
    width: "60%",
    height: 3,
    backgroundColor: "#4A60D6",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Content
  scrollContent: {
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
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },

  // Form
  formContainer: {
    width: "100%",
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
  },
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    height: 50,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  fieldIcon: {
    marginRight: 2,
  },
  dropdownSelectorText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
    flex: 1,
  },
  checkmarkIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownOptionsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4,
    paddingVertical: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownOptionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#1E293B",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    height: 50,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: "#1E293B",
    fontSize: 14,
    height: "100%",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 4,
    height: 50,
    alignItems: "center",
  },
  segmentButton: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  segmentText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#4A60D6",
  },
  nextButton: {
    backgroundColor: "#4A60D6",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#4A60D6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  nextButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },

  // Confirmation / Receipt Cards
  confirmationContainer: {
    width: "100%",
    alignItems: "center",
  },
  successContainer: {
    width: "100%",
    alignItems: "center",
  },
  receiptCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    alignItems: "center",
  },
  confirmHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 6,
  },
  confirmHeaderSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  confirmDetailsWrapper: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  receiptLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  receiptValueCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4A60D6",
  },
  receiptDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  confirmActionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  confirmBackBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  confirmBackBtnText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 14,
  },
  confirmSubmitBtn: {
    flex: 2,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#4A60D6",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmSubmitBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },

  // Success state specific
  successCheckIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  receiptSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 20,
  },
  doneBtn: {
    backgroundColor: "#4A60D6",
    height: 46,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  doneBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
