import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchFromGateway, type MikrotikRouterConfig } from "../lib/api-client";

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
  connectToGateway: (url: string) => Promise<{ success: boolean; routerCount: number }>;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

const STORAGE_GATEWAY_URL = "mikrotik_gateway_url";
const STORAGE_ROUTERS = "mikrotik_routers_list";
const STORAGE_ACTIVE_ROUTER_ID = "mikrotik_active_router_id";

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [gatewayUrl, setGatewayState] = useState<string>("http://localhost:3000");
  const [routers, setRoutersState] = useState<MikrotikRouterConfig[]>([]);
  const [activeRouter, setActiveRouterState] = useState<MikrotikRouterConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncRoutersFromServer = useCallback(async (url: string, activeId: string | null) => {
    try {
      const normalizedUrl = url.replace(/\/+$/, "");
      const result = await fetchFromGateway<{ routers: MikrotikRouterConfig[] }>(
        normalizedUrl,
        "/api/mikrotik/routers?verified=true",
        null,
        { method: "GET" }
      );

      if (result && result.routers) {
        setRoutersState(result.routers);
        await AsyncStorage.setItem(STORAGE_ROUTERS, JSON.stringify(result.routers));

        // Sync active router details if it changed
        const currentActiveId = activeId;
        if (currentActiveId) {
          const updatedActive = result.routers.find((r) => r.id === currentActiveId);
          if (updatedActive) {
            setActiveRouterState(updatedActive);
          }
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
        let normalizedUrl = "http://localhost:3000";
        if (savedGateway) {
          normalizedUrl = savedGateway.replace(/\/+$/, "");
          setGatewayState(normalizedUrl);
        }

        const savedRouters = await AsyncStorage.getItem(STORAGE_ROUTERS);
        let parsedRouters: MikrotikRouterConfig[] = [];
        if (savedRouters) {
          parsedRouters = JSON.parse(savedRouters);
          setRoutersState(parsedRouters);
        }

        const savedActiveId = await AsyncStorage.getItem(STORAGE_ACTIVE_ROUTER_ID);
        if (savedActiveId && parsedRouters.length > 0) {
          const active = parsedRouters.find((r) => r.id === savedActiveId);
          if (active) {
            setActiveRouterState(active);
          }
        }

        // Proactively sync routers from server on boot
        if (normalizedUrl) {
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
    await AsyncStorage.removeItem(STORAGE_ACTIVE_ROUTER_ID);
  };

  const connectToGateway = async (url: string): Promise<{ success: boolean; routerCount: number }> => {
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

      // 2. Fetch the routers list from database
      const response = await fetch(cleanUrl + "/api/mikrotik/routers", {
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        throw new Error("Failed to load routers list from server");
      }
      
      const payload = await response.json();
      const routersList = payload.routers || [];

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
