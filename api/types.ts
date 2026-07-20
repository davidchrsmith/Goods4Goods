export interface Profile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  latitude: number | null
  longitude: number | null
  location_name: string | null
  location_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  user_id: string
  owner_profile?: Profile
  title: string
  description: string
  condition: "New" | "Like New" | "Good" | "Fair" | "Poor"
  estimated_value: number
  image_urls: string[]
  is_available: boolean
  status: "available" | "traded" | "unavailable"
  created_at: string
  updated_at: string
}

export interface TradeRequest {
  id: string
  requester_id: string
  requester_item_id: string
  target_user_id: string
  target_item_id: string
  status: "pending" | "accepted" | "declined" | "completed"
  created_at: string
  updated_at: string
}

export interface TradeRequestWithDetails extends TradeRequest {
  requester_item: Item
  target_item: Item
  requester_profile?: Profile
  target_profile?: Profile
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  created_at: string
}

export interface ConversationWithDetails extends Conversation {
  other_user: Profile
  last_message: Message | null
  unread_count: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted" | "declined"
  created_at: string
  updated_at: string
}

export interface FriendRequestWithProfile extends Friendship {
  requester_profile: Profile
  addressee_profile?: Profile
}
