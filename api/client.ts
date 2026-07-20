import AsyncStorage from "@react-native-async-storage/async-storage"

// On Android emulator, localhost maps to 10.0.2.2
// On physical device / Expo Go, use your machine's LAN IP instead
export const BASE_URL = __DEV__ ? "http://localhost:8000/api" : "https://yourprod.com/api"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(ACCESS_TOKEN_KEY, access),
    AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh),
  ])
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
  ])
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message =
      body.detail ||
      Object.values(body as Record<string, string[]>)
        .flat()
        .join(" ") ||
      "Request failed"
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return null as T
  return response.json()
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(body.detail || "Upload failed", response.status)
  }

  return response.json()
}
