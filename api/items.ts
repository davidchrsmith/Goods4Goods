import { apiRequest, apiUpload } from "./client"
import type { Item } from "./types"

export async function getMyItems(): Promise<Item[]> {
  return apiRequest<Item[]>("/items/")
}

export async function getDiscoverItems(): Promise<Item[]> {
  return apiRequest<Item[]>("/items/discover/")
}

export async function createItem(data: {
  title: string
  description: string
  condition: string
  estimated_value: number
  image_urls: string[]
}): Promise<Item> {
  return apiRequest<Item>("/items/", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateItem(
  itemId: string,
  data: Partial<Pick<Item, "title" | "description" | "condition" | "estimated_value" | "image_urls" | "is_available" | "status">>,
): Promise<Item> {
  return apiRequest<Item>(`/items/${itemId}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteItem(itemId: string): Promise<void> {
  return apiRequest<void>(`/items/${itemId}/`, { method: "DELETE" })
}

export async function uploadImage(uri: string): Promise<string> {
  const formData = new FormData()
  formData.append("file", { uri, name: "image.jpg", type: "image/jpeg" } as any)
  const result = await apiUpload<{ url: string }>("/items/upload-image/", formData)
  return result.url
}
