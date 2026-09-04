import React, { useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  Search,
  ShieldAlert,
  Clock,
  Calendar,
  X,
  Tag,
  Phone,
  Building2,
  ChevronDown,
  Check,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface SalesLog {
  code: string;
  validity: number;
  mobile: string;
  timestamp: string;
  seller: string;
  price?: number;
  campName?: string;
}

type DateFilterType = "today" | "yesterday" | "custom" | "all";

export default function HistoryScreen() {
  const { gatewayUrl, routers } = useGateway();
  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesperson, setSalesperson] = useState("Unknown");

  // Filters State
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [selectedCampFilter, setSelectedCampFilter] = useState<string>("all");
  const [campDropdownOpen, setCampDropdownOpen] = useState(false);
  
  // Custom Date Modal & Native Picker State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [startDateObj, setStartDateObj] = useState(new Date());
  const [endDateObj, setEndDateObj] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [allowedCamps, setAllowedCamps] = useState<string[]>([]);

  // Extract distinct camp names from registered routers
  const campList = useMemo(() => {
    const names = new Set<string>();
    routers.forEach((r) => {
      const name = r.camp || r.sessionName;
      if (name) {
        if (allowedCamps.length === 0 || allowedCamps.includes(name)) {
          names.add(name);
        }
      }
    });
    return Array.from(names);
  }, [routers, allowedCamps]);

  const loadHistory = useCallback(async (selectedFilter: DateFilterType = dateFilter, isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
      setLogs([]); // Clear previous logs immediately so stale data does not flash
    }
    setError(null);

    try {
      const activeUser = (await AsyncStorage.getItem("salesperson_name")) || salesperson;
      const storedUserId = await AsyncStorage.getItem("salesperson_id");
      const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");
      if (allowedStr) {
        try {
          const parsed = JSON.parse(allowedStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllowedCamps(parsed);
          }
        } catch {}
      }

      if (activeUser && activeUser !== "Unknown") {
        setSalesperson(activeUser);
      }

      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      // Compute Dubai Local Date (UTC+4)
      const getDubaiDateStr = (dateObj: Date) => {
        // Dubai is UTC+4
        const utc = dateObj.getTime() + dateObj.getTimezoneOffset() * 60000;
        const dubaiTime = new Date(utc + 3600000 * 4);
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${dubaiTime.getFullYear()}-${pad(dubaiTime.getMonth() + 1)}-${pad(dubaiTime.getDate())}`;
      };

      const todayStr = getDubaiDateStr(new Date());

      if (selectedFilter === "today") {
        startDate = todayStr;
        endDate = todayStr;
      } else if (selectedFilter === "yesterday") {
        const yest = new Date(Date.now() - 86400000);
        const yestStr = getDubaiDateStr(yest);
        startDate = yestStr;
        endDate = yestStr;
      } else if (selectedFilter === "custom") {
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
      }

      const payload = await fetchFromGateway<{ success: boolean; sales: SalesLog[] }>(
        gatewayUrl,
        "/api/mikrotik/reports",
        null, // Pass null so history fetches across ALL camps
        {
          method: "POST",
          body: {
            startDate,
            endDate,
            salesperson: activeUser && activeUser !== "Unknown" ? activeUser : undefined,
            salesPersonId: storedUserId ? Number(storedUserId) : undefined,
            search: search.trim() ? search.trim() : undefined,
          },
        }
      );

      if (payload.success && payload.sales) {
        setLogs(payload.sales);
      } else {
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, salesperson, dateFilter, search, customStartDate, customEndDate]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory(dateFilter, true);
    }, [loadHistory, dateFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadHistory(dateFilter, true);
  };

  const handleSearchSubmit = () => {
    void loadHistory();
  };

  const clearSearch = () => {
    setSearch("");
  };

  const formatDateYMD = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const handleOpenCustomModal = () => {
    if (!customStartDate) {
      const today = new Date();
      setCustomStartDate(formatDateYMD(today));
      setCustomEndDate(formatDateYMD(today));
      setStartDateObj(today);
      setEndDateObj(today);
    }
    setCustomModalOpen(true);
  };

  // In-Modal Calendar State
  const [calendarMode, setCalendarMode] = useState<"start" | "end" | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatted = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    const selectedDate = new Date(viewYear, viewMonth, day);

    if (calendarMode === "start") {
      setStartDateObj(selectedDate);
      setCustomStartDate(formatted);
      if (selectedDate > endDateObj) {
        setEndDateObj(selectedDate);
        setCustomEndDate(formatted);
      }
      setCalendarMode(null);
    } else if (calendarMode === "end") {
      setEndDateObj(selectedDate);
      setCustomEndDate(formatted);
      setCalendarMode(null);
    }
  };

  const applyCustomDates = () => {
    setCalendarMode(null);
    setCustomModalOpen(false);
    setDateFilter("custom");
    void loadHistory();
  };

  // Filter logs by selected camp filter client-side
  const filteredLogs = useMemo(() => {
    if (selectedCampFilter === "all") return logs;
    return logs.filter(
      (item) => item.campName && item.campName.toLowerCase() === selectedCampFilter.toLowerCase()
    );
  }, [logs, selectedCampFilter]);

  // Helper to format ISO or SQL date string into clean Dubai time (hh:mm AM/PM)
  const formatDubaiTime = (timestampStr?: string) => {
    if (!timestampStr || timestampStr.trim() === "" || timestampStr === "null") return "—";
    try {
      // If it's already "YYYY-MM-DD HH:MM:SS"
      const parts = timestampStr.split(" ");
      const timePart = parts.length > 1 ? parts[1] : parts[0];
      const timeComponents = timePart.split(":");
      if (timeComponents.length >= 2) {
        let hour = parseInt(timeComponents[0], 10);
        const minute = timeComponents[1];
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
      }
      return timePart;
    } catch {
      return timestampStr;
    }
  };

  // Compact Single Card Design showing Camp Name instead of Salesperson
  const renderItem = ({ item }: { item: SalesLog }) => {
    const formattedTime = formatDubaiTime(item.timestamp);
    const formattedDate = item.timestamp ? item.timestamp.split(" ")[0] : "";

    return (
      <View style={styles.compactCard}>
        {/* Top Row: Code & Price */}
        <View style={styles.cardTopRow}>
          <View style={styles.codeWrap}>
            <Text style={styles.codeText}>{item.code}</Text>
            <View style={styles.statusDot} />
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>
              AED {item.price ? item.price.toFixed(0) : (item.validity === 30 ? 32 : 16)}
            </Text>
          </View>
        </View>

        {/* Bottom Row: Camp Name + Plan + Mobile + Time */}
        <View style={styles.cardBottomRow}>
          {/* Camp Name Badge */}
          <View style={styles.campBadge}>
            <Building2 size={10} color="#0284c7" />
            <Text style={styles.campBadgeText}>{item.campName || "Camp"}</Text>
          </View>

          {/* Plan Pill */}
          <View style={styles.metaPill}>
            <Tag size={10} color="#6366f1" />
            <Text style={styles.metaPillText}>{item.validity}d</Text>
          </View>

          {/* Customer Mobile */}
          {item.mobile ? (
            <View style={styles.metaItem}>
              <Phone size={10} color="#64748b" />
              <Text style={styles.metaText}>{item.mobile}</Text>
            </View>
          ) : null}

          {/* Timestamp in Dubai Time (hh:mm AM/PM) */}
          <View style={[styles.metaItem, { marginLeft: "auto" }]}>
            <Clock size={10} color="#94a3b8" />
            <Text style={styles.metaTimeText}>
              {dateFilter === "today" || dateFilter === "yesterday" ? formattedTime : `${formattedDate} ${formattedTime}`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Filter & Search Section */}
      <View style={styles.topFilterContainer}>
        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={15} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code, mobile..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Row with Camp Dropdown Selector and Date Filter Pills */}
        <View style={styles.filterControlsRow}>
          {/* Camp Select Dropdown Button */}
          <TouchableOpacity
            style={styles.campSelectButton}
            onPress={() => setCampDropdownOpen(true)}
            activeOpacity={0.8}
          >
            <Building2 size={12} color="#0284c7" />
            <Text style={styles.campSelectText} numberOfLines={1}>
              {selectedCampFilter === "all" ? "All Camps" : selectedCampFilter}
            </Text>
            <ChevronDown size={12} color="#64748b" />
          </TouchableOpacity>

          {/* Date Filter Pills */}
          <View style={styles.datePillsRow}>
            <TouchableOpacity
              style={[styles.datePill, dateFilter === "today" && styles.datePillActive]}
              onPress={() => {
                if (dateFilter !== "today") {
                  setDateFilter("today");
                  void loadHistory("today");
                }
              }}
            >
              <Text style={[styles.datePillText, dateFilter === "today" && styles.datePillTextActive]}>
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilter === "yesterday" && styles.datePillActive]}
              onPress={() => {
                if (dateFilter !== "yesterday") {
                  setDateFilter("yesterday");
                  void loadHistory("yesterday");
                }
              }}
            >
              <Text style={[styles.datePillText, dateFilter === "yesterday" && styles.datePillTextActive]}>
                Yesterday
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilter === "custom" && styles.datePillActive]}
              onPress={handleOpenCustomModal}
            >
              <Calendar size={11} color={dateFilter === "custom" ? "#ffffff" : "#64748b"} />
              <Text style={[styles.datePillText, dateFilter === "custom" && styles.datePillTextActive]}>
                {dateFilter === "custom" && customStartDate ? `${customStartDate.slice(5)}...` : "Custom"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilter === "all" && styles.datePillActive]}
              onPress={() => {
                if (dateFilter !== "all") {
                  setDateFilter("all");
                  void loadHistory("all");
                }
              }}
            >
              <Text style={[styles.datePillText, dateFilter === "all" && styles.datePillTextActive]}>
                All
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Log List View */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A60D6" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={32} color="#ef4444" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadHistory()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.centered}>
          <Clock size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No recharge transactions found</Text>
          <Text style={styles.emptySubText}>
            {search || dateFilter !== "all" || selectedCampFilter !== "all"
              ? "Try adjusting your search or camp/date filter"
              : "Recharged vouchers will appear here"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item, index) => `${item.code}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Camp Dropdown Selector Modal */}
      <Modal visible={campDropdownOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCampDropdownOpen(false)}
        >
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Camp</Text>
              <TouchableOpacity onPress={() => setCampDropdownOpen(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.dropdownItem, selectedCampFilter === "all" && styles.dropdownItemActive]}
              onPress={() => {
                setSelectedCampFilter("all");
                setCampDropdownOpen(false);
              }}
            >
              <View style={styles.dropdownItemLeft}>
                <Building2 size={16} color={selectedCampFilter === "all" ? "#4A60D6" : "#64748b"} />
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedCampFilter === "all" && styles.dropdownItemTextActive,
                  ]}
                >
                  All Camps
                </Text>
              </View>
              {selectedCampFilter === "all" && <Check size={16} color="#4A60D6" />}
            </TouchableOpacity>

            {campList.map((camp) => (
              <TouchableOpacity
                key={camp}
                style={[
                  styles.dropdownItem,
                  selectedCampFilter === camp && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedCampFilter(camp);
                  setCampDropdownOpen(false);
                }}
              >
                <View style={styles.dropdownItemLeft}>
                  <Building2 size={16} color={selectedCampFilter === camp ? "#4A60D6" : "#64748b"} />
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedCampFilter === camp && styles.dropdownItemTextActive,
                    ]}
                  >
                    {camp}
                  </Text>
                </View>
                {selectedCampFilter === camp && <Check size={16} color="#4A60D6" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Date Range Picker Modal with Visual Date Pickers */}
      <Modal visible={customModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setCustomModalOpen(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Start Date Button */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From Date</Text>
              <TouchableOpacity
                style={[
                  styles.datePickerTrigger,
                  calendarMode === "start" && { borderColor: "#4A60D6", backgroundColor: "#eff6ff" }
                ]}
                onPress={() => {
                  setViewYear(startDateObj.getFullYear());
                  setViewMonth(startDateObj.getMonth());
                  setCalendarMode(calendarMode === "start" ? null : "start");
                }}
              >
                <Calendar size={16} color="#4A60D6" />
                <Text style={styles.datePickerTriggerText}>
                  {customStartDate || formatDateYMD(startDateObj)}
                </Text>
                <ChevronDown size={14} color="#64748b" style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>

            {/* End Date Button */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>To Date</Text>
              <TouchableOpacity
                style={[
                  styles.datePickerTrigger,
                  calendarMode === "end" && { borderColor: "#4A60D6", backgroundColor: "#eff6ff" }
                ]}
                onPress={() => {
                  setViewYear(endDateObj.getFullYear());
                  setViewMonth(endDateObj.getMonth());
                  setCalendarMode(calendarMode === "end" ? null : "end");
                }}
              >
                <Calendar size={16} color="#4A60D6" />
                <Text style={styles.datePickerTriggerText}>
                  {customEndDate || formatDateYMD(endDateObj)}
                </Text>
                <ChevronDown size={14} color="#64748b" style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>

            {/* In-Modal Interactive Calendar */}
            {calendarMode !== null && (
              <View style={styles.calendarContainer}>
                {/* Month/Year Nav */}
                <View style={styles.calendarNav}>
                  <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                    <Text style={styles.navBtnText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>
                    {monthNames[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                    <Text style={styles.navBtnText}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* Day Headers */}
                <View style={styles.weekRow}>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <Text key={d} style={styles.weekDayText}>{d}</Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {Array.from({ length: firstDayOfMonth(viewYear, viewMonth) }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCell} />
                  ))}
                  {Array.from({ length: daysInMonth(viewYear, viewMonth) }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSelected = calendarMode === "start"
                      ? customStartDate === dateStr
                      : customEndDate === dateStr;

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                        onPress={() => handleSelectDay(day)}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApplyBtn} onPress={applyCustomDates}>
                <Text style={styles.modalApplyText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topFilterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  filterLoadingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginTop: 2,
  },
  filterLoadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 10,
    paddingRight: 4,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 12.5,
  },
  searchButton: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  searchButtonText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
  filterControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  campSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    maxWidth: 120,
  },
  campSelectText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369a1",
    flexShrink: 1,
  },
  datePillsRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  datePillActive: {
    backgroundColor: "#4A60D6",
    borderColor: "#4A60D6",
  },
  datePillText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748b",
  },
  datePillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContainer: {
    padding: 10,
    paddingBottom: 24,
    gap: 8,
  },
  compactCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  codeText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  priceBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  priceText: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "700",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  campBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  campBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0284c7",
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  metaPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#4f46e5",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  metaTimeText: {
    fontSize: 10.5,
    color: "#94a3b8",
    fontWeight: "500",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 13,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: "#4A60D6",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  emptySubText: {
    color: "#94a3b8",
    fontSize: 11.5,
    marginTop: 3,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  dropdownModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 300,
    gap: 8,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
    marginBottom: 4,
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#eff6ff",
  },
  dropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownItemText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  dropdownItemTextActive: {
    color: "#4A60D6",
    fontWeight: "700",
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  datePickerTriggerText: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "600",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: "#1e293b",
  },
  calendarContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginTop: 4,
    gap: 8,
  },
  calendarNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  weekDayText: {
    width: 32,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: "#4A60D6",
  },
  dayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modalCancelText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  modalApplyBtn: {
    backgroundColor: "#4A60D6",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modalApplyText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
