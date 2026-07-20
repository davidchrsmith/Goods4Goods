import { apiRequest } from "./client"
import type { ConversationWithDetails, Message } from "./types"

export async function getConversations(): Promise<ConversationWithDetails[]> {
  return apiRequest<ConversationWithDetails[]>("/conversations/")
}

export async function getOrCreateConversation(otherUserId: string): Promise<ConversationWithDetails> {
  return apiRequest<ConversationWithDetails>("/conversations/", {
    method: "POST",
    body: JSON.stringify({ other_user_id: otherUserId }),
  })
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return apiRequest<Message[]>(`/conversations/${conversationId}/messages/`)
}

export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  return apiRequest<Message>(`/conversations/${conversationId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

export async function markConversationRead(conversationId: string): Promise<void> {
  return apiRequest<void>(`/conversations/${conversationId}/read/`, { method: "POST" })
}

export async function hideConversation(conversationId: string): Promise<void> {
  return apiRequest<void>(`/conversations/${conversationId}/hide/`, { method: "POST" })
}
