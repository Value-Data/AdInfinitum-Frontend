import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Execution,
  ExecutionCreate,
  ExecutionResult,
  ExecutionStatusResponse,
  LoginRequest,
  Project,
  ProjectConfig,
  ProjectConfigDefaults,
  ProjectConfigUpdate,
  ProjectCreate,
  ProjectUpdate,
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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear stored tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // Avoid redirect loops on the login page itself
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
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

export async function createProject(
  projectData: ProjectCreate,
): Promise<Project> {
  const { data } = await api.post<Project>('/projects', projectData);
  return data;
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${id}`);
  return data;
}

export async function updateProject(
  id: string,
  projectData: ProjectUpdate,
): Promise<Project> {
  const { data } = await api.put<Project>(`/projects/${id}`, projectData);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// ---- Project Config ----

export async function getProjectConfig(
  projectId: string,
): Promise<ProjectConfig> {
  const { data } = await api.get<ProjectConfig>(
    `/projects/${projectId}/config`,
  );
  return data;
}

export async function updateProjectConfig(
  projectId: string,
  configData: ProjectConfigUpdate,
): Promise<ProjectConfig> {
  const { data } = await api.put<ProjectConfig>(
    `/projects/${projectId}/config`,
    configData,
  );
  return data;
}

export async function getProjectConfigDefaults(
  projectId: string,
): Promise<ProjectConfigDefaults> {
  const { data } = await api.get<ProjectConfigDefaults>(
    `/projects/${projectId}/config/defaults`,
  );
  return data;
}

// ============================================================
// Executions
// ============================================================

export async function getExecutions(
  projectId: string,
): Promise<Execution[]> {
  const { data } = await api.get<Execution[]>(
    `/projects/${projectId}/executions`,
  );
  return data;
}

export async function createExecution(
  projectId: string,
  execData: ExecutionCreate,
): Promise<Execution> {
  const { data } = await api.post<Execution>(
    `/projects/${projectId}/executions`,
    execData,
  );
  return data;
}

export async function getExecution(id: string): Promise<ExecutionResult> {
  const { data } = await api.get<ExecutionResult>(`/executions/${id}`);
  return data;
}

export async function getExecutionStatus(
  id: string,
): Promise<ExecutionStatusResponse> {
  const { data } = await api.get<ExecutionStatusResponse>(
    `/executions/${id}/status`,
  );
  return data;
}

export async function deleteExecution(id: string): Promise<void> {
  await api.delete(`/executions/${id}`);
}

export async function exportExecution(id: string): Promise<Blob> {
  const { data } = await api.get(`/executions/${id}/export`, {
    responseType: 'blob',
  });
  return data;
}

export default api;
