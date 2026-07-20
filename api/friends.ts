import { apiRequest } from "./client"
import type { FriendRequestWithProfile } from "./types"

export async function getIncomingFriendRequests(): Promise<FriendRequestWithProfile[]> {
  return apiRequest<FriendRequestWithProfile[]>("/friends/")
}

export async function getOutgoingFriendRequests(): Promise<FriendRequestWithProfile[]> {
  return apiRequest<FriendRequestWithProfile[]>("/friends/outgoing/")
}

export async function sendFriendRequest(addresseeId: string): Promise<FriendRequestWithProfile> {
  return apiRequest<FriendRequestWithProfile>("/friends/", {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  })
}

export async function respondToFriendRequest(
  friendshipId: string,
  status: "accepted" | "declined",
): Promise<FriendRequestWithProfile> {
  return apiRequest<FriendRequestWithProfile>(`/friends/${friendshipId}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}
