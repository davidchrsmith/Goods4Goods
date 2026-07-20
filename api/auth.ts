import { apiRequest, setTokens, clearTokens } from "./client"
import type { Profile } from "./types"

interface AuthResponse {
  access: string
  refresh: string
  user: Profile
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  await setTokens(data.access, data.refresh)
  return data
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  await setTokens(data.access, data.refresh)
  return data
}

export async function lookupEmailByUsername(username: string): Promise<string | null> {
  const data = await apiRequest<{ email: string | null }>(
    `/auth/lookup/?username=${encodeURIComponent(username.trim().toLowerCase())}`,
  )
  return data.email
}

export async function getMyProfile(): Promise<Profile> {
  return apiRequest<Profile>("/auth/profile/")
}

export async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  return apiRequest<Profile>("/auth/profile/", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function searchUsers(query: string): Promise<Profile[]> {
  return apiRequest<Profile[]>(`/auth/users/search/?q=${encodeURIComponent(query.trim())}`)
}

export async function getUserProfile(userId: string): Promise<Profile> {
  return apiRequest<Profile>(`/auth/profile/${userId}/`)
}

export async function logout(): Promise<void> {
  await clearTokens()
}
