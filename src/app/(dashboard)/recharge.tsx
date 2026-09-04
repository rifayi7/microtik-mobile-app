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
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";
import { formatCurrency } from "../../lib/format";

interface PlanGroup {
  days: number;
  available_count: number;
}

interface RechargeData {
  plans: PlanGroup[];
  currency: string;
}

export default function RechargeScreen() {
  const { gatewayUrl, activeRouter, routers, connectRouter } = useGateway();
  const [data, setData] = useState<RechargeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesperson, setSalesperson] = useState("Unknown");

  // Form states
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(0);
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

  const [customerHistory, setCustomerHistory] = useState<{
    code: string;
    validity: number;
    timestamp: string;
    campName?: string;
    price?: number;
  }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [allowedCamps, setAllowedCamps] = useState<string[]>([]);
  const [selectedCamp, setSelectedCamp] = useState("");

  useEffect(() => {
    async function loadSalesperson() {
      const user = await AsyncStorage.getItem("salesperson_name");
      if (user) {
        setSalesperson(user);
      }
      const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");
      if (allowedStr) {
        try {
          const parsed = JSON.parse(allowedStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllowedCamps(parsed);
          }
        } catch {}
      }
    }
    void loadSalesperson();
  }, []);

  const camps = useMemo(() => {
    if (allowedCamps.length > 0) {
      return Array.from(new Set(allowedCamps));
    }
    const allCamps = routers.map((r) => r.camp || r.sessionName).filter(Boolean) as string[];
    return Array.from(new Set(allCamps));
  }, [routers, allowedCamps]);

  // Set default selected camp from allowed list
  useEffect(() => {
    if (camps.length > 0 && (!selectedCamp || !camps.some((c) => c.toLowerCase() === selectedCamp.toLowerCase()))) {
      setSelectedCamp(camps[0]);
    }
  }, [camps, selectedCamp]);

  const currentCampRouter = useMemo(() => {
    if (!selectedCamp) return null;
    return routers.find((r) => (r.camp || r.sessionName)?.toLowerCase() === selectedCamp.toLowerCase()) || null;
  }, [routers, selectedCamp]);

  const loadData = useCallback(async () => {
    if (!currentCampRouter) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Fetch available voucher counts per validity plan for the selected camp router
      const plans = await fetchFromGateway<PlanGroup[]>(
        gatewayUrl,
        "/api/mikrotik/vouchers/plans",
        currentCampRouter,
        { method: "POST" }
      );

      setData({
        plans: plans || [],
        currency: currentCampRouter?.currency ?? "AED",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recharge data");
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl, currentCampRouter]);

  useFocusEffect(
    useCallback(() => {
      if (currentCampRouter) {
        void loadData();
      }
    }, [loadData, currentCampRouter])
  );

  const planGroups = useMemo(() => {
    if (!data) return [];
    return [...data.plans].sort((a, b) => a.days - b.days);
  }, [data]);

  const handleSelectPlan = (days: number) => {
    setSelectedPlan(days);
  };

  const handleSelectCamp = async (campName: string) => {
    setSelectedCamp(campName);
    setShowCampDropdown(false);
    
    const targetRouter = routers.find((r) => (r.camp || r.sessionName) === campName);
    if (targetRouter && targetRouter.id !== activeRouter?.id) {
      try {
        setLoading(true);
        const success = await connectRouter(targetRouter.id);
        if (!success) {
          Alert.alert("Error", `Failed to switch to camp router: ${campName}`);
        }
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to switch camp");
      } finally {
        setLoading(false);
      }
    }
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
      if (!selectedPlan) {
        Alert.alert("Error", "Please select a plan");
        return;
      }
    }

    // Ensure we use the router matching the selected camp
    const targetRouter = routers.find((r) => (r.camp || r.sessionName) === selectedCamp) || activeRouter;
    if (!targetRouter) return;

    setProcessingCode(rechargeMode === "manual" ? "manual" : String(selectedPlan));
    try {
      const storedUserId = await AsyncStorage.getItem("salesperson_id");

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
                salesPersonId: storedUserId ? Number(storedUserId) : undefined,
              }
            : {
                validity_days: selectedPlan,
                mobileNumber: mobileNumber.trim(),
                salesperson,
                salesPersonId: storedUserId ? Number(storedUserId) : undefined,
              },
        }
      );

      if (result.success) {
        const transaction = {
          code: result.code || "",
          mobile: mobileNumber,
          validity: result.validity || selectedPlan,
          timestamp: new Date().toLocaleString(),
          camp: selectedCamp,
          paymentType: paymentType,
        };
        setLastTransaction(transaction);
        setStep("success");

        // Reset form
        setMobileNumber("");
        setManualVoucherCode("");

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
                  <Building2 size={18} color={selectedCamp ? "#4A60D6" : "#94a3b8"} style={styles.fieldIcon} />
                  <Text style={[styles.dropdownSelectorText, !selectedCamp && { color: "#94a3b8" }]} numberOfLines={1}>
                    {selectedCamp || "Select Camp"}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>

              {showCampDropdown && (
                <View style={styles.dropdownOptionsContainer}>
                  {camps.map((camp, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.dropdownOptionItem}
                      onPress={() => void handleSelectCamp(camp)}
                    >
                      <Text style={styles.dropdownOptionText}>{camp}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Mobile Number Input */}
            <View style={styles.fieldSection}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <Text style={{ fontSize: 11, color: mobileNumber.length === 10 ? "#16a34a" : "#64748b", fontWeight: "600" }}>
                  {mobileNumber.length}/10 digits
                </Text>
              </View>
              <View style={[styles.inputWrapper, mobileNumber.length > 0 && mobileNumber.length !== 10 && { borderColor: "#f87171" }]}>
                <Phone size={18} color="#4A60D6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit number (e.g. 0501234567)"
                  placeholderTextColor="#94a3b8"
                  value={mobileNumber}
                  onChangeText={(val) => {
                    // Only allow numeric characters and max 10 digits
                    const cleaned = val.replace(/[^0-9]/g, "").slice(0, 10);
                    setMobileNumber(cleaned);
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              {mobileNumber.length > 0 && mobileNumber.length !== 10 && (
                <Text style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: "600" }}>
                  ⚠️ Mobile number must be exactly 10 digits
                </Text>
              )}
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
                  <View style={[styles.checkmarkIconBg, selectedPlan === 0 && { backgroundColor: "#cbd5e1" }]}>
                    <Check size={12} color="#ffffff" />
                  </View>
                  <Text style={[styles.dropdownSelectorText, selectedPlan === 0 && { color: "#94a3b8" }]}>
                    {selectedPlan > 0 ? `${selectedPlan} Days` : "Select Validity Plan"}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>

              {showValidityDropdown && (
                <View style={styles.dropdownOptionsContainer}>
                  {planGroups.length === 0 ? (
                    <View style={styles.dropdownOptionItem}>
                      <Text style={[styles.dropdownOptionText, { color: "#94a3b8", fontStyle: "italic" }]}>
                        {selectedCamp ? "No vouchers in stock for this camp" : "Please select a camp first"}
                      </Text>
                    </View>
                  ) : (
                    planGroups.map((group) => (
                      <TouchableOpacity 
                        key={group.days} 
                        style={styles.dropdownOptionItem}
                        onPress={() => {
                          handleSelectPlan(group.days);
                          setShowValidityDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownOptionText}>{group.days} Days ({group.available_count} available)</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

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
            {(() => {
              const selectedPlanGroup = planGroups.find((g) => g.days === selectedPlan);
              const availableCount = selectedPlanGroup ? selectedPlanGroup.available_count : 0;
              const isOutOfStock = selectedPlan > 0 && availableCount <= 0;
              const isFormIncomplete =
                mobileNumber.trim().length !== 10 ||
                !selectedCamp ||
                selectedPlan === 0 ||
                isOutOfStock ||
                loadingHistory;

              return (
                <>
                  {isOutOfStock && (
                    <View style={{ marginBottom: 10, padding: 10, backgroundColor: "#fee2e2", borderRadius: 8, borderWidth: 1, borderColor: "#fca5a5" }}>
                      <Text style={{ color: "#b91c1c", fontSize: 12, fontWeight: "600", textAlign: "center" }}>
                        ⚠️ Out of Stock: No available voucher codes for {selectedPlan}-Days plan in {selectedCamp}.
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity 
                    style={[
                      styles.nextButton,
                      isFormIncomplete && { backgroundColor: "#cbd5e1" }
                    ]}
                    disabled={isFormIncomplete}
                    onPress={async () => {
                      if (!selectedCamp) {
                        Alert.alert("Camp Required", "Please select a camp first.");
                        return;
                      }
                      if (mobileNumber.trim().length !== 10) {
                        Alert.alert("Invalid Mobile Number", "Mobile number must be exactly 10 digits.");
                        return;
                      }
                      if (selectedPlan === 0) {
                        Alert.alert("Validity Required", "Please select a validity plan.");
                        return;
                      }
                      if (availableCount <= 0) {
                        Alert.alert("Out of Stock", `No available vouchers found for ${selectedPlan}-Days plan.`);
                        return;
                      }

                // Fetch previous recharge history for this specific mobile number
                setLoadingHistory(true);
                try {
                  const histRes = await fetchFromGateway<{ success: boolean; sales: any[] }>(
                    gatewayUrl,
                    "/api/mikrotik/reports",
                    null,
                    {
                      method: "POST",
                      body: { search: mobileNumber.trim() },
                    }
                  );
                  if (histRes.success && histRes.sales) {
                    setCustomerHistory(histRes.sales.map((s) => ({
                      code: s.code,
                      validity: s.validity,
                      timestamp: s.timestamp || s.formattedTime || "",
                      campName: s.campName,
                      price: s.price,
                    })));
                  } else {
                    setCustomerHistory([]);
                  }
                } catch {
                  setCustomerHistory([]);
                } finally {
                  setLoadingHistory(false);
                  setStep("confirmation");
                }
              }}
            >
              {loadingHistory ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.nextButtonText}>Next</Text>
              )}
            </TouchableOpacity>
            </>
          );
        })()}
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
                  <Text style={styles.receiptValue}>{selectedPlan} Days</Text>
                </View>
                <View style={styles.receiptDivider} />

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

              {/* Customer's Previous Recharge History (Displayed below Back & Confirm buttons) */}
              <View style={styles.prevHistoryContainer}>
                <View style={styles.prevHistoryHeader}>
                  <Clock size={14} color="#4A60D6" />
                  <Text style={styles.prevHistoryTitle}>
                    Previous Recharge History ({customerHistory.length})
                  </Text>
                </View>

                {customerHistory.length === 0 ? (
                  <View style={styles.prevHistoryEmpty}>
                    <Text style={styles.prevHistoryEmptyText}>No previous recharges found for this number</Text>
                  </View>
                ) : (
                  <View style={styles.prevHistoryList}>
                    {customerHistory.slice(0, 5).map((item, idx) => (
                      <View key={`${item.code}-${idx}`} style={styles.prevHistoryItem}>
                        <View style={styles.prevHistoryLeft}>
                          <View style={styles.prevCodeWrap}>
                            <Text style={styles.prevCodeText}>{item.code}</Text>
                            <View style={styles.prevPlanBadge}>
                              <Text style={styles.prevPlanText}>{item.validity} Days</Text>
                            </View>
                          </View>
                          <Text style={styles.prevDateText}>
                            {item.timestamp ? item.timestamp : "Past Recharge"} • {item.campName || selectedCamp}
                          </Text>
                        </View>
                        <Text style={styles.prevPriceText}>
                          AED {item.price || (item.validity === 30 ? 32 : 16)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
    ...Platform.select({
      web: {
        outlineStyle: "none",
        outlineWidth: 0,
      } as any,
    }),
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
  prevHistoryContainer: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginTop: 16,
    gap: 6,
  },
  prevHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 6,
  },
  prevHistoryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  prevHistoryEmpty: {
    paddingVertical: 8,
    alignItems: "center",
  },
  prevHistoryEmptyText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  prevHistoryList: {
    gap: 6,
  },
  prevHistoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  prevHistoryLeft: {
    gap: 2,
  },
  prevCodeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prevCodeText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  prevPlanBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  prevPlanText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#2563EB",
  },
  prevDateText: {
    fontSize: 10,
    color: "#64748B",
  },
  prevPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
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
