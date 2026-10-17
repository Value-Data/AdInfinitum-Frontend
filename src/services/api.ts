import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ProjectAccess } from '../types';
import type {
  LoginRequest,
  Project,
  TokenResponse,
  UserCreate,
  UserResponse,
  UserUpdate,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request interceptor: attach JWT ----

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---- Response interceptor: handle 401 ----
// Con un 401 se intenta una vez renovar el token con /auth/refresh y repetir el
// pedido; si no se puede, se cierra la sesión. Varios pedidos que fallan juntos
// comparten una sola renovación.

let refreshing: Promise<string | null> | null = null;

async function renewAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  try {
    const { data } = await axios.post<TokenResponse>(`${BASE_URL}/auth/refresh`, {
      refresh_token: refresh,
    });
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function logout(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  // Avoid redirect loops on the login page itself
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const esAuth = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && original && !original._retried && !esAuth) {
      original._retried = true;
      refreshing = refreshing ?? renewAccessToken().finally(() => { refreshing = null; });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      logout();
    } else if (error.response?.status === 401 && !esAuth) {
      logout();
    }
    return Promise.reject(error);
  },
);

// ============================================================
// Auth
// ============================================================

export async function login(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', {
    username,
    password,
  } as LoginRequest);
  return data;
}

export async function refreshToken(
  refresh_token: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/refresh', {
    refresh_token,
  });
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
}

// ============================================================
// Users (Admin only)
// ============================================================

export async function getUsers(): Promise<UserResponse[]> {
  const { data } = await api.get<UserResponse[]>('/users');
  return data;
}

export async function createUser(
  userData: UserCreate,
): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>('/users', userData);
  return data;
}

export async function updateUser(
  id: string,
  userData: UserUpdate,
): Promise<UserResponse> {
  const { data } = await api.put<UserResponse>(`/users/${id}`, userData);
  return data;
}

export async function getUserProjects(userId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/users/${userId}/projects`);
  return data;
}

/** F7: los proyectos del usuario con su rol en cada uno. */
export async function getUserAccesses(userId: string): Promise<ProjectAccess[]> {
  const { data } = await api.get<ProjectAccess[]>(`/users/${userId}/accesses`);
  return data;
}

/** F7: reemplaza los accesos del usuario (los que no van, se quitan). */
export async function setUserAccesses(userId: string, accesses: ProjectAccess[]): Promise<string[]> {
  const { data } = await api.put<string[]>(`/users/${userId}/projects`, { accesses });
  return data;
}

export async function setUserProjects(
  userId: string,
  projectIds: string[],
): Promise<string[]> {
  const { data } = await api.put<string[]>(`/users/${userId}/projects`, {
    project_ids: projectIds,
  });
  return data;
}

// ============================================================
// Projects
// ============================================================

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects');
  return data;
}

// ---- Project Config ----

// ============================================================
// Executions
// ============================================================

// ---- Dynamic execution artifacts ----

export async function listExecutionFiles(
  id: string,
): Promise<{ name: string; size_bytes: number }[]> {
  const { data } = await api.get<{ name: string; size_bytes: number }[]>(
    `/executions/${id}/files`,
  );
  return data;
}

export async function downloadExecutionFile(
  id: string,
  name: string,
): Promise<Blob> {
  const { data } = await api.get(`/executions/${id}/files/${encodeURIComponent(name)}`, {
    responseType: 'blob',
  });
  return data;
}

export default api;
