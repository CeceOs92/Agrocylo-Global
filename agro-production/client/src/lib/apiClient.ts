/* Typed API client with centralized error handling and logging
   - Allows injecting a fetch implementation for testing/mocking
*/
export type ApiError = {
  status: number;
  message: string;
  body?: any;
};

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ApiClient {
  private baseUrl: string;
  private fetchImpl?: typeof fetch;

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
    this.fetchImpl = opts.fetchImpl;
  }

  private async request<T = any>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const fetcher = this.fetchImpl ?? fetch.bind(globalThis);
    try {
      console.debug(`[api] ${init?.method ?? "GET"} ${url}`);
      const res = await fetcher(url, init);
      const ct = res.headers.get("content-type") || "";
      let body: any = undefined;
      if (ct.includes("application/json")) {
        body = await res.json().catch(() => null);
      } else {
        body = await res.text().catch(() => null);
      }
      if (!res.ok) {
        const err: ApiError = { status: res.status, message: res.statusText || "Error", body };
        console.error("[api][error]", err, url);
        throw err;
      }
      console.debug("[api][response]", { url, status: res.status, body });
      return body as T;
    } catch (err) {
      console.error("[api][network]", err);
      throw err;
    }
  }

  get<T = any>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  post<T = any>(path: string, data?: any, init?: RequestInit) {
    const headers = { "Content-Type": "application/json", ...(init?.headers as any) };
    return this.request<T>(path, { ...init, method: "POST", headers, body: JSON.stringify(data) });
  }

  put<T = any>(path: string, data?: any, init?: RequestInit) {
    const headers = { "Content-Type": "application/json", ...(init?.headers as any) };
    return this.request<T>(path, { ...init, method: "PUT", headers, body: JSON.stringify(data) });
  }

  delete<T = any>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}

export const api = new ApiClient();

export default api;
