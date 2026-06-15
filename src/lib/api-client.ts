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
  } = {}
): Promise<T> {
  const normalizedBase = gatewayUrl.trim().replace(/\/$/, "");
  const fullUrl = `${normalizedBase}${path}`;

  const requestBody: Record<string, any> = {
    ...options.body,
  };

  if (routerConfig) {
    requestBody.router = {
      id: routerConfig.id,
      sessionName: routerConfig.sessionName,
      host: routerConfig.host,
      port: Number(routerConfig.port),
      username: routerConfig.username,
      password: routerConfig.password ?? "",
      useTls: Boolean(routerConfig.useTls),
      hotspotName: routerConfig.hotspotName,
      dnsName: routerConfig.dnsName,
      currency: routerConfig.currency ?? "AED",
      camp: routerConfig.camp,
      sessionTimeout: routerConfig.sessionTimeout,
      phone: routerConfig.phone,
      liveReport: routerConfig.liveReport !== undefined ? Boolean(routerConfig.liveReport) : true,
    };
    requestBody.routerId = routerConfig.id;
  }

  try {
    const response = await fetch(fullUrl, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

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
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Network request failed");
  }
}
