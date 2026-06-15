import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchFromGateway, type MikrotikRouterConfig } from "../lib/api-client";

interface GatewayContextType {
  gatewayUrl: string;
  routers: MikrotikRouterConfig[];
  activeRouter: MikrotikRouterConfig | null;
  isConnected: boolean;
  loading: boolean;
  setGatewayUrl: (url: string) => Promise<void>;
  addRouter: (router: Omit<MikrotikRouterConfig, "id">) => Promise<void>;
  updateRouter: (router: MikrotikRouterConfig) => Promise<void>;
  deleteRouter: (id: string) => Promise<void>;
  connectRouter: (id: string) => Promise<boolean>;
  disconnectRouter: () => Promise<void>;
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

  // Load configuration from AsyncStorage on mount
  useEffect(() => {
    async function loadStorage() {
      try {
        const savedGateway = await AsyncStorage.getItem(STORAGE_GATEWAY_URL);
        if (savedGateway) {
          setGatewayState(savedGateway);
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
      } catch (e) {
        console.error("Failed to load gateway config", e);
      } finally {
        setLoading(false);
      }
    }
    void loadStorage();
  }, []);

  const setGatewayUrl = async (url: string) => {
    setGatewayState(url);
    await AsyncStorage.setItem(STORAGE_GATEWAY_URL, url);
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
      // Test router connection via the connect endpoint in Next.js
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

  return (
    <GatewayContext.Provider
      value={{
        gatewayUrl,
        routers,
        activeRouter,
        isConnected: activeRouter !== null,
        loading,
        setGatewayUrl,
        addRouter,
        updateRouter,
        deleteRouter,
        connectRouter,
        disconnectRouter,
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
