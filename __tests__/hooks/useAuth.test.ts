/**
 * Tests for the useAuth hook (via AuthContext).
 *
 * Verifies token persistence in localStorage and session restoration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for api module
// ---------------------------------------------------------------------------

const mockApiLogin = vi.fn();
const mockGetMe = vi.fn();

vi.mock('../../src/services/api', () => ({
  login: (...args: unknown[]) => mockApiLogin(...args),
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

// ---------------------------------------------------------------------------
// localStorage mock (JSDOM provides one, but we want to spy on it)
// ---------------------------------------------------------------------------

let storageStore: Record<string, string> = {};

beforeEach(() => {
  storageStore = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
    (key: string) => storageStore[key] ?? null,
  );
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
    (key: string, value: string) => {
      storageStore[key] = value;
    },
  );
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
    (key: string) => {
      delete storageStore[key];
    },
  );
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// We test the AuthProvider behavior by importing the context module
// and using React testing utilities.
// ---------------------------------------------------------------------------

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// We need a fresh import of the context each time to avoid stale state.
// But since vi.mock is hoisted, we can import normally.
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  it('stores tokens on login', async () => {
    mockApiLogin.mockResolvedValue({
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      token_type: 'bearer',
    });
    mockGetMe.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial loading to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('admin', 'admin123');
    });

    expect(storageStore['access_token']).toBe('access-abc');
    expect(storageStore['refresh_token']).toBe('refresh-xyz');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('admin');
  });

  it('clears tokens on logout', async () => {
    // Pre-populate storage so restoreSession finds no token (we control getItem)
    mockApiLogin.mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      token_type: 'bearer',
    });
    mockGetMe.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Login first
    await act(async () => {
      await result.current.login('admin', 'pass');
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(storageStore['access_token']).toBeUndefined();
    expect(storageStore['refresh_token']).toBeUndefined();
  });

  it('restores session from localStorage', async () => {
    // Simulate existing token in storage
    storageStore['access_token'] = 'existing-token';

    mockGetMe.mockResolvedValue({
      id: 'u2',
      username: 'restored_user',
      role: 'user',
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('restored_user');
    expect(mockGetMe).toHaveBeenCalled();
  });
});
