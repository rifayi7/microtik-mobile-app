import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Search, ShieldAlert, BookOpen, Users, Clock, Zap } from "lucide-react-native";
import { useGateway } from "../../contexts/gateway-context";
import { fetchFromGateway } from "../../lib/api-client";

interface UserProfile {
  id: string;
  name: string;
  sharedUsers: number;
  rateLimit: string;
  sessionTimeout: string;
  idleTimeout: string;
  validity: string;
  price: number;
  currency: string;
  routerCount: number;
}

export default function ProfilesScreen() {
  const { gatewayUrl, activeRouter } = useGateway();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadProfiles = useCallback(async (isRefresh = false) => {
    if (!activeRouter) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const payload = await fetchFromGateway<{ profiles: UserProfile[] }>(
        gatewayUrl,
        "/api/mikrotik/profiles",
        activeRouter
      );
      setProfiles(payload.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user profiles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatewayUrl, activeRouter]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadProfiles(true);
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

  const renderItem = ({ item }: { item: UserProfile }) => {
    return (
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileTitleRow}>
            <View style={styles.avatar}>
              <BookOpen size={16} color="#f5a623" />
            </View>
            <Text style={styles.profileName}>{item.name}</Text>
          </View>
          <View style={styles.sharedBadge}>
            <Users size={12} color="#aaa" />
            <Text style={styles.sharedText}>Shared: {item.sharedUsers}</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailBox}>
            <Zap size={14} color="#888" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Rate Limit</Text>
              <Text style={styles.detailValue}>{item.rateLimit || "Unlimited"}</Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            <Clock size={14} color="#888" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Session Timeout</Text>
              <Text style={styles.detailValue}>{item.sessionTimeout || "None"}</Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            <Clock size={14} color="#888" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Idle Timeout</Text>
              <Text style={styles.detailValue}>{item.idleTimeout || "None"}</Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            <BookOpen size={14} color="#888" />
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Validity Limit</Text>
              <Text style={styles.detailValue}>{item.validity || "None"}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search profiles..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loading && profiles.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f5a623" />
          <Text style={styles.loadingText}>Loading user profiles...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ShieldAlert size={36} color="#ef5350" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadProfiles()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProfiles.length === 0 ? (
        <View style={styles.centered}>
          <BookOpen size={36} color="#444" />
          <Text style={styles.emptyText}>No profiles found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  searchBarContainer: {
    padding: 12,
    backgroundColor: "#1e1e1e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: 8,
  },
  retryBtn: {
    backgroundColor: "#f5a623",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  retryBtnText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 13,
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingBottom: 8,
    marginBottom: 10,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2a2a2c",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sharedText: {
    fontSize: 10,
    color: "#aaa",
    fontWeight: "bold",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailBox: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  detailTexts: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: "#888",
  },
  detailValue: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    marginTop: 1,
  },
});
