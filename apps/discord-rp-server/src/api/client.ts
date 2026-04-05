import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class HesoyamApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(baseUrl: string, apiKey: string, timeoutMs = 10_000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new ApiError(
          response.status,
          data,
          `API ${method} ${path} failed: ${response.status} ${response.statusText}`,
        );
      }

      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(0, null, `API ${method} ${path} timed out after ${this.timeoutMs}ms`);
      }

      throw new ApiError(0, null, `API ${method} ${path} failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

let client: HesoyamApiClient | null = null;

export function getApiClient(): HesoyamApiClient {
  if (!client) {
    client = new HesoyamApiClient(env.apiBaseUrl, env.apiKey);
    logger.info('API client initialized', { baseUrl: env.apiBaseUrl });
  }
  return client;
}
