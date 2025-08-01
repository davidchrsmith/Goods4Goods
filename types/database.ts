export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone: string | null
          full_name: string | null
          username: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          condition: "New" | "Like New" | "Good" | "Fair" | "Poor"
          estimated_value: number
          image_urls: string[]
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          condition: "New" | "Like New" | "Good" | "Fair" | "Poor"
          estimated_value: number
          image_urls?: string[]
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          condition?: "New" | "Like New" | "Good" | "Fair" | "Poor"
          estimated_value?: number
          image_urls?: string[]
          is_available?: boolean
          updated_at?: string
        }
      }
      trade_requests: {
        Row: {
          id: string
          requester_id: string
          requester_item_id: string
          target_user_id: string
          target_item_id: string
          status: "pending" | "accepted" | "declined" | "completed"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          requester_item_id: string
          target_user_id: string
          target_item_id: string
          status?: "pending" | "accepted" | "declined" | "completed"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: "pending" | "accepted" | "declined" | "completed"
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          trade_request_id: string | null
          last_message_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          trade_request_id?: string | null
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_message_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          is_read?: boolean
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: "pending" | "accepted" | "declined" | "blocked"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: "pending" | "accepted" | "declined" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: "pending" | "accepted" | "declined" | "blocked"
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Item = Database["public"]["Tables"]["items"]["Row"]
export type TradeRequest = Database["public"]["Tables"]["trade_requests"]["Row"]
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"]
export type Message = Database["public"]["Tables"]["messages"]["Row"]
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"]
