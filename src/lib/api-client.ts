import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MikrotikRouterConfig {
  id: string;
  sessionName: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  useTls: boolean;
  hotspotName?: string;
  dnsName?: string;
  currency?: string;
  camp?: string;
  sessionTimeout?: string;
  phone?: string;
  liveReport?: boolean;
}

export async function fetchFromGateway<T>(
  gatewayUrl: string,
  path: string,
  routerConfig: MikrotikRouterConfig | null,
  options: {
    method?: string;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const normalizedBase = gatewayUrl.trim().replace(/\/$/, "");
  const fullUrl = `${normalizedBase}${path}`;

  const requestBody: Record<string, any> = {
    ...options.body,
  };

  if (routerConfig) {
    requestBody.routerId = routerConfig.id;
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const token = await AsyncStorage.getItem("auth_token");

    const fetchOptions: RequestInit = {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    };

    if (fetchOptions.method !== "GET" && fetchOptions.method !== "HEAD") {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const response = await fetch(fullUrl, fetchOptions);
    clearTimeout(timer);

    const text = await response.text();
    let payload: any = {};
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(payload.error ?? payload.message ?? `HTTP error ${response.status}`);
    }

    return payload as T;
  } catch (error: any) {
    clearTimeout(timer);
    if (error?.name === "AbortError" || controller.signal.aborted) {
      throw new Error("Cannot reach backend server. Connection timed out after 8 seconds.");
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Network request failed") || msg.includes("Failed to fetch") || msg.includes("ECONNREFUSED")) {
      throw new Error("Cannot reach backend server. Please check your network connection or verify that the server is running.");
    }
    throw new Error(msg);
  }
}
