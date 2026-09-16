import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  token: string | null;
  userId: string | null;
  username: string;
  displayName: string;
  companyId: string | null;
  companyName: string | null;
  companyTimezone: string;
  allowedCamps: string[];
  isLoggedIn: boolean;
}

interface AuthContextType extends AuthState {
  /** Load user session from AsyncStorage (call once at app boot) */
  loadSession: () => Promise<void>;
  /** Save full login payload to memory + AsyncStorage */
  saveLogin: (data: {
    token?: string;
    userId?: number;
    username: string;
    displayName?: string;
    companyId?: number;
    companyName?: string;
    companyTimezone?: string;
    allowedCamps?: string[];
  }) => Promise<void>;
  /** Update specific profile fields (from live profile sync) */
  updateProfile: (data: {
    displayName?: string;
    companyName?: string;
    companyTimezone?: string;
    companyId?: number;
    allowedCamps?: string[];
  }) => Promise<void>;
  /** Clear all auth state and storage (logout) */
  clearSession: () => Promise<void>;
  /** Get the current token from memory (no disk I/O) */
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-memory token cache — avoids AsyncStorage disk reads on every API call
let inMemoryToken: string | null = null;

/** Get the auth token from memory without React hooks (for use in api-client.ts) */
export function getAuthTokenSync(): string | null {
  return inMemoryToken;
}

const AUTH_STORAGE_KEYS = [
  "auth_token",
  "salesperson_name",
  "salesperson_display_name",
  "salesperson_id",
  "salesperson_company",
  "salesperson_company_id",
  "salesperson_company_timezone",
  "salesperson_allowed_camps",
] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    username: "",
    displayName: "Salesperson",
    companyId: null,
    companyName: null,
    companyTimezone: "Asia/Dubai",
    allowedCamps: [],
    isLoggedIn: false,
  });

  const loadSession = useCallback(async () => {
    try {
      const [
        token, username, displayName, userId,
        companyName, companyId, companyTimezone, allowedCampsStr,
      ] = await AsyncStorage.multiGet(AUTH_STORAGE_KEYS as unknown as string[]).then(
        (pairs) => pairs.map(([, v]) => v)
      );

      // Update in-memory cache
      inMemoryToken = token || null;

      const isLoggedIn = !!(token || (username && username !== "Unknown"));

      let allowedCamps: string[] = [];
      if (allowedCampsStr) {
        try {
          const parsed = JSON.parse(allowedCampsStr);
          if (Array.isArray(parsed)) allowedCamps = parsed;
        } catch {}
      }

      setState({
        token: token || null,
        userId: userId || null,
        username: username || "",
        displayName: displayName || username || "Salesperson",
        companyId: companyId || null,
        companyName: companyName || null,
        companyTimezone: companyTimezone || "Asia/Dubai",
        allowedCamps,
        isLoggedIn,
      });
    } catch (e) {
      console.error("AuthContext: Failed to load session", e);
    }
  }, []);

  const saveLogin = useCallback(async (data: {
    token?: string;
    userId?: number;
    username: string;
    displayName?: string;
    companyId?: number;
    companyName?: string;
    companyTimezone?: string;
    allowedCamps?: string[];
  }) => {
    const dName = data.displayName || data.username;
    const token = data.token || null;

    // Update in-memory token cache immediately
    inMemoryToken = token;

    // Persist to AsyncStorage
    const pairs: [string, string][] = [
      ["salesperson_name", data.username],
      ["salesperson_display_name", dName],
    ];
    if (token) pairs.push(["auth_token", token]);
    if (data.userId) pairs.push(["salesperson_id", String(data.userId)]);
    if (data.companyId) pairs.push(["salesperson_company_id", String(data.companyId)]);
    if (data.companyName) pairs.push(["salesperson_company", data.companyName]);
    if (data.companyTimezone) pairs.push(["salesperson_company_timezone", data.companyTimezone]);
    if (data.allowedCamps) {
      pairs.push(["salesperson_allowed_camps", JSON.stringify(data.allowedCamps)]);
    }

    await AsyncStorage.multiSet(pairs);

    setState({
      token,
      userId: data.userId ? String(data.userId) : null,
      username: data.username,
      displayName: dName,
      companyId: data.companyId ? String(data.companyId) : null,
      companyName: data.companyName || null,
      companyTimezone: data.companyTimezone || "Asia/Dubai",
      allowedCamps: data.allowedCamps || [],
      isLoggedIn: true,
    });
  }, []);

  const updateProfile = useCallback(async (data: {
    displayName?: string;
    companyName?: string;
    companyTimezone?: string;
    companyId?: number;
    allowedCamps?: string[];
  }) => {
    const pairs: [string, string][] = [];
    if (data.displayName) pairs.push(["salesperson_display_name", data.displayName]);
    if (data.companyName) pairs.push(["salesperson_company", data.companyName]);
    if (data.companyTimezone) pairs.push(["salesperson_company_timezone", data.companyTimezone]);
    if (data.companyId) pairs.push(["salesperson_company_id", String(data.companyId)]);
    if (data.allowedCamps) {
      pairs.push(["salesperson_allowed_camps", JSON.stringify(data.allowedCamps)]);
    }

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }

    setState((prev) => ({
      ...prev,
      ...(data.displayName && { displayName: data.displayName }),
      ...(data.companyName && { companyName: data.companyName }),
      ...(data.companyTimezone && { companyTimezone: data.companyTimezone }),
      ...(data.companyId && { companyId: String(data.companyId) }),
      ...(data.allowedCamps && { allowedCamps: data.allowedCamps }),
    }));
  }, []);

  const clearSession = useCallback(async () => {
    inMemoryToken = null;
    await AsyncStorage.multiRemove([
      "auth_token",
      "salesperson_name",
      "salesperson_display_name",
      "salesperson_id",
      "salesperson_company",
      "salesperson_company_id",
      "salesperson_company_timezone",
      "salesperson_allowed_camps",
      "mikrotik_routers_list",
      "mikrotik_active_router_id",
    ]);
    setState({
      token: null,
      userId: null,
      username: "",
      displayName: "Salesperson",
      companyId: null,
      companyName: null,
      companyTimezone: "Asia/Dubai",
      allowedCamps: [],
      isLoggedIn: false,
    });
  }, []);

  const getToken = useCallback(() => inMemoryToken, []);

  const contextValue = useMemo<AuthContextType>(() => ({
    ...state,
    loadSession,
    saveLogin,
    updateProfile,
    clearSession,
    getToken,
  }), [state, loadSession, saveLogin, updateProfile, clearSession, getToken]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
