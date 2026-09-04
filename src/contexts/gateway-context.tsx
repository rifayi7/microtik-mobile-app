import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchFromGateway, type MikrotikRouterConfig } from "../lib/api-client";
import { DEFAULT_GATEWAY_URL } from "../constants/config";

interface GatewayContextType {
  gatewayUrl: string;
  routers: MikrotikRouterConfig[];
  activeRouter: MikrotikRouterConfig | null;
  isConnected: boolean;
  loading: boolean;
  setGatewayUrl: (url: string) => Promise<void>;
  syncRouters: () => Promise<void>;
  addRouter: (router: Omit<MikrotikRouterConfig, "id">) => Promise<void>;
  updateRouter: (router: MikrotikRouterConfig) => Promise<void>;
  deleteRouter: (id: string) => Promise<void>;
  connectRouter: (id: string) => Promise<boolean>;
  disconnectRouter: () => Promise<void>;
  connectToGateway: (
    url: string,
    overrideToken?: string,
    overrideAllowedCamps?: string[]
  ) => Promise<{ success: boolean; routerCount: number }>;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

const STORAGE_GATEWAY_URL = "mikrotik_gateway_url";
const STORAGE_ROUTERS = "mikrotik_routers_list";
const STORAGE_ACTIVE_ROUTER_ID = "mikrotik_active_router_id";

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [gatewayUrl, setGatewayState] = useState<string>(DEFAULT_GATEWAY_URL);
  const [routers, setRoutersState] = useState<MikrotikRouterConfig[]>([]);
  const [activeRouter, setActiveRouterState] = useState<MikrotikRouterConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncRoutersFromServer = useCallback(async (url: string, activeId: string | null) => {
    try {
      const normalizedUrl = url.replace(/\/+$/, "");
      const token = await AsyncStorage.getItem("auth_token");
      const storedName = await AsyncStorage.getItem("salesperson_name");
      const storedUserId = await AsyncStorage.getItem("salesperson_id");
      const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");

      // DO NOT make unauthenticated router fetch on boot if user is not logged in!
      if (!token && !storedUserId && (!storedName || storedName === "Unknown")) {
        setRoutersState([]);
        setActiveRouterState(null);
        return;
      }

      let allowedCamps: string[] = [];
      if (allowedStr) {
        try {
          const parsed = JSON.parse(allowedStr);
          if (Array.isArray(parsed)) allowedCamps = parsed.map((c) => String(c).toLowerCase());
        } catch {}
      }

      let routerPath = "/api/mikrotik/routers?verified=true";
      if (storedUserId) {
        routerPath += `&salesPersonId=${encodeURIComponent(storedUserId)}`;
      } else if (storedName && storedName !== "Unknown") {
        routerPath += `&salesperson=${encodeURIComponent(storedName)}`;
      }

      const result = await fetchFromGateway<{ routers: MikrotikRouterConfig[] }>(
        normalizedUrl,
        routerPath,
        null,
        { method: "GET" }
      );

      if (result && result.routers) {
        const routersList = result.routers;
        const dynamicallyAllowed = routersList.map((r) => r.camp || r.sessionName).filter(Boolean) as string[];
        
        // Keep salesperson_allowed_camps updated with fresh server permissions
        if (dynamicallyAllowed.length > 0) {
          await AsyncStorage.setItem("salesperson_allowed_camps", JSON.stringify(dynamicallyAllowed));
        }

        setRoutersState(routersList);
        await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(routersList));

        // Sync active router details if it changed
        const currentActiveId = activeId;
        if (currentActiveId) {
          const updatedActive = routersList.find((r) => r.id === currentActiveId);
          if (updatedActive) {
            setActiveRouterState(updatedActive);
          } else if (routersList.length > 0) {
            setActiveRouterState(routersList[0]);
          } else {
            setActiveRouterState(null);
          }
        } else if (routersList.length > 0) {
          setActiveRouterState(routersList[0]);
        } else {
          setActiveRouterState(null);
        }
      }
    } catch (e) {
      console.warn("Could not sync routers from central gateway server. Using local offline storage.", e);
    }
  }, []);

  const syncRouters = async () => {
    await syncRoutersFromServer(gatewayUrl, activeRouter?.id || null);
  };

  // Load configuration from AsyncStorage on mount
  useEffect(() => {
    async function loadStorage() {
      try {
        const savedGateway = await AsyncStorage.getItem(STORAGE_GATEWAY_URL);
        let normalizedUrl = DEFAULT_GATEWAY_URL;
        // If savedGateway is present and not an old production URL when DEFAULT_GATEWAY_URL is localhost, respect it
        if (savedGateway && savedGateway.trim() !== "") {
          const cleanSaved = savedGateway.replace(/\/+$/, "");
          if (
            (DEFAULT_GATEWAY_URL.includes("192.168.") || DEFAULT_GATEWAY_URL.includes("localhost")) &&
            (cleanSaved.includes("vercel.app") || cleanSaved.includes("localhost"))
          ) {
            normalizedUrl = DEFAULT_GATEWAY_URL;
            await AsyncStorage.setItem(STORAGE_GATEWAY_URL, DEFAULT_GATEWAY_URL);
          } else {
            normalizedUrl = cleanSaved;
          }
        } else {
          await AsyncStorage.setItem(STORAGE_GATEWAY_URL, DEFAULT_GATEWAY_URL);
        }
        setGatewayState(normalizedUrl);

        const storedUser = await AsyncStorage.getItem("salesperson_name");
        const storedToken = await AsyncStorage.getItem("auth_token");
        const isLoggedIn = !!(storedToken || (storedUser && storedUser !== "Unknown"));

        if (!isLoggedIn) {
          setRoutersState([]);
          setActiveRouterState(null);
          return;
        }

        const savedRouters = await AsyncStorage.getItem(STORAGE_ROUTERS);
        const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");
        let allowedCamps: string[] = [];
        if (allowedStr) {
          try {
            const parsed = JSON.parse(allowedStr);
            if (Array.isArray(parsed)) allowedCamps = parsed.map((c) => String(c).toLowerCase());
          } catch {}
        }

        let parsedRouters: MikrotikRouterConfig[] = [];
        if (savedRouters) {
          parsedRouters = JSON.parse(savedRouters);
          if (allowedCamps.length > 0) {
            parsedRouters = parsedRouters.filter((r) => {
              const campName = (r.camp || r.sessionName || "").toLowerCase();
              return allowedCamps.includes(campName);
            });
          }
          setRoutersState(parsedRouters);
        }

        const savedActiveId = await AsyncStorage.getItem(STORAGE_ACTIVE_ROUTER_ID);
        if (savedActiveId && parsedRouters.length > 0) {
          const active = parsedRouters.find((r) => r.id === savedActiveId);
          if (active) {
            setActiveRouterState(active);
          } else if (parsedRouters.length > 0) {
            setActiveRouterState(parsedRouters[0]);
          }
        } else if (parsedRouters.length > 0) {
          setActiveRouterState(parsedRouters[0]);
        }

        // Proactively sync routers from server on boot ONLY IF user is logged in
        if (normalizedUrl && isLoggedIn) {
          void syncRoutersFromServer(normalizedUrl, savedActiveId || null);
        }
      } catch (e) {
        console.error("Failed to load gateway config", e);
      } finally {
        setLoading(false);
      }
    }
    void loadStorage();
  }, [syncRoutersFromServer]);

  const setGatewayUrl = async (url: string) => {
    const normalized = url.replace(/\/+$/, "");
    setGatewayState(normalized);
    await AsyncStorage.setItem(STORAGE_GATEWAY_URL, normalized);
    await syncRoutersFromServer(normalized, activeRouter?.id || null);
  };

  const addRouter = async (router: Omit<MikrotikRouterConfig, "id">) => {
    const newRouter: MikrotikRouterConfig = {
      ...router,
      id: `router-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    const updated = [...routers, newRouter];
    setRoutersState(updated);
    await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(updated));
  };

  const updateRouter = async (router: MikrotikRouterConfig) => {
    const updated = routers.map((r) => (r.id === router.id ? router : r));
    setRoutersState(updated);
    await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(updated));

    if (activeRouter && activeRouter.id === router.id) {
      setActiveRouterState(router);
    }
  };

  const deleteRouter = async (id: string) => {
    const updated = routers.filter((r) => r.id !== id);
    setRoutersState(updated);
    await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(updated));

    if (activeRouter && activeRouter.id === id) {
      setActiveRouterState(null);
      await AsyncStorage.removeItem(STORAGE_ACTIVE_ROUTER_ID);
    }
  };

  const connectRouter = async (id: string): Promise<boolean> => {
    const target = routers.find((r) => r.id === id);
    if (!target) return false;

    try {
      const result = await fetchFromGateway<{ success: boolean; error?: string }>(
        gatewayUrl,
        "/api/mikrotik/connect",
        target
      );

      if (result.success) {
        setActiveRouterState(target);
        await AsyncStorage.setItem(STORAGE_ACTIVE_ROUTER_ID, id);
        return true;
      } else {
        throw new Error(result.error ?? "Connection failed");
      }
    } catch (error) {
      throw error;
    }
  };

  const disconnectRouter = async () => {
    setActiveRouterState(null);
    setRoutersState([]);
    try {
      await AsyncStorage.multiRemove([
        STORAGE_ACTIVE_ROUTER_ID,
        STORAGE_ROUTERS,
      ]);
    } catch {}
  };

  const connectToGateway = async (
    url: string,
    overrideToken?: string,
    overrideAllowedCamps?: string[]
  ): Promise<{ success: boolean; routerCount: number }> => {
    try {
      const cleanUrl = url.trim().replace(/\/+$/, "");

      // 1. Verify backend server and database health first
      const healthResponse = await fetch(cleanUrl + "/api/mikrotik/health", {
        headers: { "Content-Type": "application/json" }
      });

      if (!healthResponse.ok) {
        throw new Error("Backend server is not running or database connection failed");
      }

      const healthPayload = await healthResponse.json();
      if (!healthPayload.success) {
        throw new Error(healthPayload.error ?? "Database connectivity issue on backend");
      }

      // 2. Fetch the routers list from database with auth headers
      const token = overrideToken || (await AsyncStorage.getItem("auth_token"));
      let allowedCamps: string[] = [];
      if (overrideAllowedCamps && Array.isArray(overrideAllowedCamps)) {
        allowedCamps = overrideAllowedCamps.map((c) => String(c).toLowerCase());
      } else {
        const allowedStr = await AsyncStorage.getItem("salesperson_allowed_camps");
        if (allowedStr) {
          try {
            const parsed = JSON.parse(allowedStr);
            if (Array.isArray(parsed)) allowedCamps = parsed.map((c) => String(c).toLowerCase());
          } catch {}
        }
      }

      const storedName = await AsyncStorage.getItem("salesperson_name");
      const storedUserId = await AsyncStorage.getItem("salesperson_id");
      let routersPath = cleanUrl + "/api/mikrotik/routers?verified=true";
      if (storedUserId) {
        routersPath += `&salesPersonId=${encodeURIComponent(storedUserId)}`;
      } else if (storedName && storedName !== "Unknown") {
        routersPath += `&salesperson=${encodeURIComponent(storedName)}`;
      }

      const response = await fetch(routersPath, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load routers list from server");
      }
      
      const payload = await response.json();
      let routersList: MikrotikRouterConfig[] = payload.routers || [];

      if (allowedCamps.length > 0) {
        routersList = routersList.filter((r) => {
          const campName = (r.camp || r.sessionName || "").toLowerCase();
          return allowedCamps.includes(campName);
        });
      }

      // Save gateway URL
      setGatewayState(cleanUrl);
      await AsyncStorage.setItem(STORAGE_GATEWAY_URL, cleanUrl);

      // Save routers list
      setRoutersState(routersList);
      await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(routersList));

      // Automatically set the first router as active if available
      if (routersList.length > 0) {
        const defaultRouter = routersList[0];
        setActiveRouterState(defaultRouter);
        await AsyncStorage.setItem(STORAGE_ACTIVE_ROUTER_ID, defaultRouter.id);
      } else {
        setActiveRouterState(null);
        await AsyncStorage.removeItem(STORAGE_ACTIVE_ROUTER_ID);
      }

      return { success: true, routerCount: routersList.length };
    } catch (e) {
      console.error("Failed to connect to gateway", e);
      throw e;
    }
  };

  return (
    <GatewayContext.Provider
      value={{
        gatewayUrl,
        routers,
        activeRouter,
        isConnected: !!gatewayUrl,
        loading,
        setGatewayUrl,
        syncRouters,
        addRouter,
        updateRouter,
        deleteRouter,
        connectRouter,
        disconnectRouter,
        connectToGateway,
      }}
    >
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  const context = useContext(GatewayContext);
  if (context === undefined) {
    throw new Error("useGateway must be used within a GatewayProvider");
  }
  return context;
}
