import type { AuthResponse, BoardData, BoardSummary } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function registerRequest(email: string, password: string, name: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function loginRequest(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listBoards(token: string): Promise<BoardSummary[]> {
  return request<BoardSummary[]>("/boards", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createBoard(token: string, name: string): Promise<BoardData> {
  return request<BoardData>("/boards", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

export function fetchBoard(token: string, boardId: string): Promise<BoardData> {
  return request<BoardData>(`/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getInviteLink(token: string, boardId: string): Promise<{ token: string }> {
  return request<{ token: string }>(`/boards/${boardId}/invite`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function regenerateInviteLink(token: string, boardId: string): Promise<{ token: string }> {
  return request<{ token: string }>(`/boards/${boardId}/invite/regenerate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function acceptInvite(token: string, inviteToken: string): Promise<BoardData> {
  return request<BoardData>(`/invites/${inviteToken}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function leaveBoard(token: string, boardId: string): Promise<void> {
  return request<void>(`/boards/${boardId}/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteBoard(token: string, boardId: string): Promise<void> {
  return request<void>(`/boards/${boardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
