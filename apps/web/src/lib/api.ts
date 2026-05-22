import axios, { AxiosError } from 'axios';

const baseURL =
  (typeof window === 'undefined'
    ? process.env.API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: false,
});

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (typeof window !== 'undefined') {
    if (tokens) {
      localStorage.setItem('leadflow.tokens', JSON.stringify(tokens));
    } else {
      localStorage.removeItem('leadflow.tokens');
    }
  }
}

export function loadTokens() {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem('leadflow.tokens');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    accessToken = parsed.accessToken;
    refreshToken = parsed.refreshToken;
  } catch {
    /* ignore */
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as any;
    if (status === 401 && refreshToken && !original?._retry) {
      original._retry = true;
      refreshing ??= (async () => {
        const { data } = await axios.post(`${baseURL}/api/auth/refresh`, { refreshToken });
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      })().finally(() => {
        refreshing = null;
      });
      await refreshing;
      return api(original);
    }
    return Promise.reject(err);
  },
);
