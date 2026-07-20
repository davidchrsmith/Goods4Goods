import { apiRequest } from "./client"
import type { TradeRequestWithDetails } from "./types"

export async function createTradeRequest(data: {
  requester_item_id: string
  target_item_id: string
}): Promise<TradeRequestWithDetails> {
  return apiRequest<TradeRequestWithDetails>("/trades/", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getIncomingTradeRequests(): Promise<TradeRequestWithDetails[]> {
  return apiRequest<TradeRequestWithDetails[]>("/trades/incoming/")
}

export async function getOutgoingTradeRequests(): Promise<TradeRequestWithDetails[]> {
  return apiRequest<TradeRequestWithDetails[]>("/trades/outgoing/")
}

export async function respondToTradeRequest(
  tradeId: string,
  status: "accepted" | "declined",
): Promise<TradeRequestWithDetails> {
  return apiRequest<TradeRequestWithDetails>(`/trades/${tradeId}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export async function cancelTradeRequest(tradeId: string): Promise<void> {
  return apiRequest<void>(`/trades/${tradeId}/`, { method: "DELETE" })
}
