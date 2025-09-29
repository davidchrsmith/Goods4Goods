"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Conversation, Profile, Message, Friendship, TradeRequest, Item } from "../types/database"
import { Avatar, Button } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"
import FriendSearch from "./FriendSearch"

interface MessagesListProps {
  session: Session
  onConversationSelect: (conversation: ConversationWithDetails) => void
  shouldRefresh?: boolean
  onRefreshComplete?: () => void
}

interface ConversationWithDetails extends Conversation {
  other_user: Profile
  last_message: Message | null
  unread_count: number
}

interface FriendRequestWithProfile extends Friendship {
  requester_profile: Profile
  addressee_profile?: Profile
}

interface TradeRequestWithDetails extends TradeRequest {
  requester_item: Item
  target_item: Item
  requester_profile?: Profile
  target_profile?: Profile
}

export default function MessagesList({
  session,
  onConversationSelect,
  shouldRefresh,
  onRefreshComplete,
}: MessagesListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [tradeRequests, setTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [outgoingTradeRequests, setOutgoingTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showFriendSearch, setShowFriendSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<"messages" | "requests">("messages")
  const [requestsSubTab, setRequestsSubTab] = useState<"incoming" | "outgoing">("incoming")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationWithDetails | null>(null)
  const [deleting, setDeleting] = useState(false)

  const unreadConversationsCount = conversations.filter((conv) => conv.unread_count > 0).length

  useEffect(() => {
    loadConversations()
    loadFriendRequests()
    loadTradeRequests()
    loadOutgoingFriendRequests()
    loadOutgoingTradeRequests()

    // Subscribe to real-time updates
    const conversationsSubscription = supabase
      .channel("conversations-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        console.log("Conversations updated, reloading...")
        loadConversations()
      })
      .subscribe()

    const messagesSubscription = supabase
      .channel("messages-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        console.log("New message inserted, reloading conversations...")
        loadConversations()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        console.log("Message updated (possibly read status), reloading conversations...")
        loadConversations()
      })
      .subscribe()

    const friendshipsSubscription = supabase
      .channel("friendships-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        loadFriendRequests()
        loadOutgoingFriendRequests()
      })
      .subscribe()

    const tradeRequestsSubscription = supabase
      .channel("trade-requests-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_requests" }, () => {
        loadTradeRequests()
        loadOutgoingTradeRequests()
      })
      .subscribe()

    return () => {
      conversationsSubscription.unsubscribe()
      messagesSubscription.unsubscribe()
      friendshipsSubscription.unsubscribe()
      tradeRequestsSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (shouldRefresh) {
      console.log("Refreshing conversations after returning from chat...")
      loadConversations().then(() => {
        onRefreshComplete?.()
      })
    }
  }, [shouldRefresh])

  async function loadConversations() {
    try {
      setLoading(true)
      console.log("=== LOADING CONVERSATIONS ===")
      console.log("Current user ID:", session.user.id)

      // First, get all conversations where user is a participant
      const { data: allConversations, error: conversationsError } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .order("last_message_at", { ascending: false })

      if (conversationsError) {
        console.error("Error loading conversations:", conversationsError)
        throw conversationsError
      }

      console.log(`Found ${allConversations?.length || 0} total conversations`)

      // Get hidden conversations for current user
      const { data: hiddenConversations, error: hiddenError } = await supabase
        .from("hidden_conversations")
        .select("conversation_id")
        .eq("user_id", session.user.id)

      if (hiddenError) {
        console.error("Error loading hidden conversations:", hiddenError)
        // Continue anyway, just don't filter
      }

      const hiddenConversationIds = new Set(hiddenConversations?.map((h) => h.conversation_id) || [])
      console.log(
        `Found ${hiddenConversationIds.size} hidden conversations for current user:`,
        Array.from(hiddenConversationIds),
      )

      // Filter out hidden conversations
      const filteredConversations =
        allConversations?.filter((conv) => {
          const isHidden = hiddenConversationIds.has(conv.id)
          if (isHidden) {
            console.log(`Filtering out hidden conversation: ${conv.id}`)
          }
          return !isHidden
        }) || []

      console.log(`After filtering: ${filteredConversations.length} visible conversations`)

      if (filteredConversations.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      // Get other user profiles and last messages for each conversation
      const conversationsWithDetails = await Promise.all(
        filteredConversations.map(async (conversation) => {
          const otherUserId = conversation.user1_id === session.user.id ? conversation.user2_id : conversation.user1_id

          // Get other user's profile
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", otherUserId).single()

          // Get last message - handle 406 errors gracefully
          let lastMessage = null
          try {
            const { data: lastMessageData, error: lastMessageError } = await supabase
              .from("messages")
              .select("*")
              .eq("conversation_id", conversation.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()

            if (lastMessageError && lastMessageError.code !== "PGRST116") {
              console.warn(`Error fetching last message for conversation ${conversation.id}:`, lastMessageError)
            } else {
              lastMessage = lastMessageData
            }
          } catch (error) {
            console.warn(`Failed to fetch last message for conversation ${conversation.id}:`, error)
          }

          // Get unread count with better error handling
          let unreadCount = 0
          try {
            const { data: unreadMessages, error: unreadError } = await supabase
              .from("messages")
              .select("id")
              .eq("conversation_id", conversation.id)
              .eq("is_read", false)
              .neq("sender_id", session.user.id)

            if (unreadError) {
              console.error("Error fetching unread messages for conversation", conversation.id, unreadError)
            } else {
              unreadCount = unreadMessages?.length || 0
            }
          } catch (error) {
            console.warn(`Failed to get unread count for conversation ${conversation.id}:`, error)
          }

          return {
            ...conversation,
            other_user: profile || {
              id: otherUserId,
              full_name: "Unknown User",
              username: null,
              phone: null,
              avatar_url: null,
              latitude: null,
              longitude: null,
              location_name: null,
              location_updated_at: null,
              created_at: "",
              updated_at: "",
            },
            last_message: lastMessage,
            unread_count: unreadCount,
          }
        }),
      )

      console.log(`Setting ${conversationsWithDetails.length} conversations in state`)
      setConversations(conversationsWithDetails)
    } catch (error) {
      console.error("Error loading conversations:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadFriendRequests() {
    try {
      // Use simpler query without joins first to test
      const { data: friendshipData, error: friendshipError } = await supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (friendshipError) {
        console.error("Error loading friendships:", friendshipError)
        setFriendRequests([])
        return
      }

      // Get profiles separately
      if (friendshipData && friendshipData.length > 0) {
        const requesterIds = friendshipData.map((req) => req.requester_id)
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", requesterIds)

        if (profilesError) {
          console.error("Error loading requester profiles:", profilesError)
          setFriendRequests([])
          return
        }

        // Combine data
        const friendRequestsWithProfiles = friendshipData.map((request) => ({
          ...request,
          requester_profile: profiles?.find((p) => p.id === request.requester_id) || {
            id: request.requester_id,
            full_name: "Unknown User",
            username: null,
            phone: null,
            avatar_url: null,
            latitude: null,
            longitude: null,
            location_name: null,
            location_updated_at: null,
            created_at: "",
            updated_at: "",
          },
        }))

        setFriendRequests(friendRequestsWithProfiles)
      } else {
        setFriendRequests([])
      }
    } catch (error) {
      console.error("Error loading friend requests:", error)
    }
  }

  async function loadTradeRequests() {
    try {
      console.log("=== LOADING INCOMING TRADE REQUESTS ===")
      console.log("Current user ID:", session.user.id)

      // Use simpler query without joins first to test
      const { data: tradeRequestData, error: tradeRequestError } = await supabase
        .from("trade_requests")
        .select("*")
        .eq("target_user_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (tradeRequestError) {
        console.error("Error loading trade requests:", tradeRequestError)
        setTradeRequests([])
        return
      }

      if (!tradeRequestData || tradeRequestData.length === 0) {
        setTradeRequests([])
        return
      }

      // Get related data separately
      const requesterIds = tradeRequestData.map((req) => req.requester_id)
      const requesterItemIds = tradeRequestData.map((req) => req.requester_item_id)
      const targetItemIds = tradeRequestData.map((req) => req.target_item_id)

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", requesterIds)

      // Get items
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .in("id", [...requesterItemIds, ...targetItemIds])

      if (profilesError || itemsError) {
        console.error("Error loading related data:", { profilesError, itemsError })
        setTradeRequests([])
        return
      }

      // Combine data
      const tradeRequestsWithDetails = tradeRequestData.map((request) => ({
        ...request,
        requester_profile: profiles?.find((p) => p.id === request.requester_id),
        requester_item: items?.find((i) => i.id === request.requester_item_id)!,
        target_item: items?.find((i) => i.id === request.target_item_id)!,
      }))

      setTradeRequests(tradeRequestsWithDetails)
    } catch (error) {
      console.error("Error loading trade requests:", error)
    }
  }

  async function loadOutgoingTradeRequests() {
    try {
      console.log("=== LOADING OUTGOING TRADE REQUESTS ===")
      console.log("Current user ID:", session.user.id)

      // Use simpler query without joins first to test
      const { data: tradeRequestData, error: tradeRequestError } = await supabase
        .from("trade_requests")
        .select("*")
        .eq("requester_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (tradeRequestError) {
        console.error("Error loading outgoing trade requests:", tradeRequestError)
        setOutgoingTradeRequests([])
        return
      }

      if (!tradeRequestData || tradeRequestData.length === 0) {
        setOutgoingTradeRequests([])
        return
      }

      // Get related data separately
      const targetUserIds = tradeRequestData.map((req) => req.target_user_id)
      const requesterItemIds = tradeRequestData.map((req) => req.requester_item_id)
      const targetItemIds = tradeRequestData.map((req) => req.target_item_id)

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", targetUserIds)

      // Get items
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .in("id", [...requesterItemIds, ...targetItemIds])

      if (profilesError || itemsError) {
        console.error("Error loading related data:", { profilesError, itemsError })
        setOutgoingTradeRequests([])
        return
      }

      // Combine data
      const tradeRequestsWithDetails = tradeRequestData.map((request) => ({
        ...request,
        target_profile: profiles?.find((p) => p.id === request.target_user_id),
        requester_item: items?.find((i) => i.id === request.requester_item_id)!,
        target_item: items?.find((i) => i.id === request.target_item_id)!,
      }))

      setOutgoingTradeRequests(tradeRequestsWithDetails)
    } catch (error) {
      console.error("Error loading outgoing trade requests:", error)
    }
  }

  async function loadOutgoingFriendRequests() {
    try {
      // Use simpler query without joins first to test
      const { data: friendshipData, error: friendshipError } = await supabase
        .from("friendships")
        .select("*")
        .eq("requester_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (friendshipError) {
        console.error("Error loading outgoing friendships:", friendshipError)
        setOutgoingFriendRequests([])
        return
      }

      // Get profiles separately
      if (friendshipData && friendshipData.length > 0) {
        const addresseeIds = friendshipData.map((req) => req.addressee_id)
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", addresseeIds)

        if (profilesError) {
          console.error("Error loading addressee profiles:", profilesError)
          setOutgoingFriendRequests([])
          return
        }

        // Combine data
        const friendRequestsWithProfiles = friendshipData.map((request) => ({
          ...request,
          addressee_profile: profiles?.find((p) => p.id === request.addressee_id) || {
            id: request.addressee_id,
            full_name: "Unknown User",
            username: null,
            phone: null,
            avatar_url: null,
            latitude: null,
            longitude: null,
            location_name: null,
            location_updated_at: null,
            created_at: "",
            updated_at: "",
          },
        }))

        setOutgoingFriendRequests(friendRequestsWithProfiles)
      } else {
        setOutgoingFriendRequests([])
      }
    } catch (error) {
      console.error("Error loading outgoing friend requests:", error)
    }
  }

  async function createOrGetConversation(otherUserId: string): Promise<string | null> {
    try {
      // Ensure user1_id is always smaller than user2_id for consistency
      const user1Id = session.user.id < otherUserId ? session.user.id : otherUserId
      const user2Id = session.user.id < otherUserId ? otherUserId : session.user.id

      // Check if conversation already exists
      const { data: existingConversation, error: searchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user1_id", user1Id)
        .eq("user2_id", user2Id)
        .single()

      if (searchError && searchError.code !== "PGRST116") {
        throw searchError
      }

      if (existingConversation) {
        // If conversation exists but was hidden by current user, unhide it
        await supabase.rpc("unhide_conversation_for_user", {
          p_conversation_id: existingConversation.id,
          p_user_id: session.user.id,
        })

        return existingConversation.id
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert([
          {
            user1_id: user1Id,
            user2_id: user2Id,
          },
        ])
        .select()
        .single()

      if (createError) throw createError

      return newConversation.id
    } catch (error) {
      console.error("Error creating/getting conversation:", error)
      return null
    }
  }

  async function sendAutomaticMessage(conversationId: string, message: string) {
    try {
      const { error } = await supabase.from("messages").insert([
        {
          conversation_id: conversationId,
          sender_id: session.user.id,
          content: message,
        },
      ])

      if (error) throw error
    } catch (error) {
      console.error("Error sending automatic message:", error)
    }
  }

  async function respondToFriendRequest(requestId: string, status: "accepted" | "declined") {
    try {
      const { error } = await supabase
        .from("friendships")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) throw error

      // Remove the request from local state immediately for better UX
      setFriendRequests((prev) => prev.filter((req) => req.id !== requestId))

      // Reload to ensure consistency
      loadFriendRequests()
    } catch (error) {
      console.error("Error responding to friend request:", error)
    }
  }

  async function respondToTradeRequest(requestId: string, status: "accepted" | "declined") {
    try {
      console.log(`=== RESPONDING TO TRADE REQUEST: ${status.toUpperCase()} ===`)

      // Find the request in our local state to get details
      const request = tradeRequests.find((req) => req.id === requestId)
      if (!request) {
        console.error("Trade request not found")
        return
      }

      // Update the trade request status
      const { error } = await supabase
        .from("trade_requests")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) throw error

      // Remove the request from local state immediately for better UX
      setTradeRequests((prev) => prev.filter((req) => req.id !== requestId))

      if (status === "accepted") {
        console.log("Trade request accepted, creating conversation and sending message...")

        // Create or get conversation with the requester
        const conversationId = await createOrGetConversation(request.requester_id)

        if (conversationId) {
          // Send automatic message
          const message = `Great news! I've accepted your trade request. You offered your "${request.requester_item.title}" for my "${request.target_item.title}". Let's discuss the details!`

          await sendAutomaticMessage(conversationId, message)

          // Reload conversations to show the new message
          loadConversations()
        }
      }

      // Reload to ensure consistency
      loadTradeRequests()
      loadOutgoingTradeRequests()
    } catch (error) {
      console.error("Error responding to trade request:", error)
    }
  }

  async function hideConversation(conversationId: string) {
    try {
      setDeleting(true)
      console.log(`=== HIDING CONVERSATION FOR USER ===`)
      console.log(`Conversation ID: ${conversationId}`)
      console.log(`User ID: ${session.user.id}`)

      // Use the RPC function to hide the conversation
      const { data, error } = await supabase.rpc("hide_conversation_for_user", {
        p_conversation_id: conversationId,
        p_user_id: session.user.id,
      })

      if (error) {
        console.error("Error hiding conversation:", error)
        throw error
      }

      console.log("RPC function returned:", data)
      console.log("Conversation hidden successfully for current user")

      // Verify the hide was successful by checking the database
      const { data: verifyData, error: verifyError } = await supabase
        .from("hidden_conversations")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", session.user.id)
        .single()

      if (verifyError) {
        console.error("Error verifying hidden conversation:", verifyError)
      } else {
        console.log("Verified hidden conversation in database:", verifyData)
      }

      // Update local state immediately
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId))

      setShowDeleteModal(false)
      setConversationToDelete(null)

      // Reload conversations to ensure consistency
      await loadConversations()
    } catch (error) {
      console.error("Error hiding conversation:", error)
      // For web compatibility, we'll use a simple alert fallback
      if (typeof window !== "undefined" && window.alert) {
        window.alert("Failed to hide conversation. Please try again.")
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteConversation = (conversation: ConversationWithDetails) => {
    console.log("Hide button clicked for conversation:", conversation.id)
    setConversationToDelete(conversation)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (conversationToDelete) {
      hideConversation(conversationToDelete.id)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setConversationToDelete(null)
  }

  async function handleConversationSelect(conversation: ConversationWithDetails) {
    console.log(`=== SELECTING CONVERSATION ===`)
    console.log(`Conversation ID: ${conversation.id}`)
    console.log(`Current unread count: ${conversation.unread_count}`)

    // Update local state immediately for better UX - set to 0 permanently
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversation.id) {
          console.log(`Setting unread count to 0 for conversation ${conv.id}`)
          return { ...conv, unread_count: 0 }
        }
        return conv
      }),
    )

    // Navigate to chat immediately
    const updatedConversation = { ...conversation, unread_count: 0 }
    console.log("Navigating to chat with updated conversation:", updatedConversation.unread_count)
    onConversationSelect(updatedConversation)

    // Try multiple approaches to mark messages as read in the background
    if (conversation.unread_count > 0) {
      console.log("Background: Attempting to mark messages as read...")

      // Approach 1: Try using RPC function (we'll create this)
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc("mark_conversation_messages_read", {
          conv_id: conversation.id,
          user_id: session.user.id,
        })

        if (rpcError) {
          console.log("RPC approach failed:", rpcError.message)
        } else {
          console.log("RPC approach succeeded:", rpcResult)
          return // Success, no need to try other approaches
        }
      } catch (error) {
        console.log("RPC approach error:", error)
      }

      // Approach 2: Direct update with conversation_id and sender_id
      try {
        const { data: directUpdate, error: directError } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversation.id)
          .neq("sender_id", session.user.id)
          .eq("is_read", false)
          .select()

        if (directError) {
          console.log("Direct update failed:", directError.message)
        } else {
          console.log(`Direct update succeeded: marked ${directUpdate?.length || 0} messages as read`)
          return // Success
        }
      } catch (error) {
        console.log("Direct update error:", error)
      }

      // Approach 3: Update each message individually
      try {
        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("is_read", false)
          .neq("sender_id", session.user.id)

        if (unreadMessages && unreadMessages.length > 0) {
          console.log("Individual update: found messages to update:", unreadMessages.length)

          for (const message of unreadMessages) {
            try {
              const { error: individualError } = await supabase
                .from("messages")
                .update({ is_read: true })
                .eq("id", message.id)

              if (individualError) {
                console.log(`Failed to update message ${message.id}:`, individualError.message)
              } else {
                console.log(`Successfully updated message ${message.id}`)
              }
            } catch (error) {
              console.log(`Error updating message ${message.id}:`, error)
            }
          }
        }
      } catch (error) {
        console.log("Individual update error:", error)
      }
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else {
      return date.toLocaleDateString()
    }
  }

  // Only count pending requests for the badge
  const totalRequests =
    friendRequests.length + tradeRequests.length + outgoingFriendRequests.length + outgoingTradeRequests.length

  if (showFriendSearch) {
    return <FriendSearch session={session} onBack={() => setShowFriendSearch(false)} />
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>

        <TouchableOpacity onPress={() => setShowFriendSearch(true)} style={styles.addFriendButton}>
          <Feather name="user-plus" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "messages" && styles.activeTab]}
          onPress={() => setActiveTab("messages")}
        >
          <Text style={[styles.tabText, activeTab === "messages" && styles.activeTabText]}>
            Messages ({unreadConversationsCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "requests" && styles.activeTab]}
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" && styles.activeTabText]}>
            Requests ({totalRequests})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "messages" ? (
          conversations.length > 0 ? (
            conversations.map((conversation) => (
              <View key={conversation.id} style={styles.conversationWrapper}>
                <TouchableOpacity
                  style={styles.conversationItem}
                  onPress={() => handleConversationSelect(conversation)}
                >
                  <Avatar
                    size={50}
                    rounded
                    source={
                      conversation.other_user.avatar_url ? { uri: conversation.other_user.avatar_url } : undefined
                    }
                    icon={!conversation.other_user.avatar_url ? { name: "user", type: "feather" } : undefined}
                    containerStyle={styles.avatar}
                  />

                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.userName}>{conversation.other_user.full_name || "Unknown User"}</Text>
                      {conversation.last_message && (
                        <Text style={styles.timestamp}>{formatTime(conversation.last_message.created_at)}</Text>
                      )}
                    </View>

                    <View style={styles.messagePreview}>
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {conversation.last_message?.content || "No messages yet"}
                      </Text>
                      {conversation.unread_count > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadCount}>{conversation.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteConversation(conversation)}>
                  <Feather name="trash-2" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Messages Yet</Text>
              <Text style={styles.emptySubtitle}>Start trading or add friends to begin conversations!</Text>
            </View>
          )
        ) : (
          <View>
            <View style={styles.subTabs}>
              <TouchableOpacity
                style={[styles.subTab, requestsSubTab === "incoming" && styles.activeSubTab]}
                onPress={() => setRequestsSubTab("incoming")}
              >
                <Text style={[styles.subTabText, requestsSubTab === "incoming" && styles.activeSubTabText]}>
                  Incoming ({friendRequests.length + tradeRequests.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, requestsSubTab === "outgoing" && styles.activeSubTab]}
                onPress={() => setRequestsSubTab("outgoing")}
              >
                <Text style={[styles.subTabText, requestsSubTab === "outgoing" && styles.activeSubTabText]}>
                  Outgoing ({outgoingFriendRequests.length + outgoingTradeRequests.length})
                </Text>
              </TouchableOpacity>
            </View>

            {requestsSubTab === "incoming" ? (
              <View>
                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Friend Requests</Text>
                    {friendRequests.map((request) => (
                      <View key={request.id} style={styles.requestCard}>
                        <Avatar
                          size={50}
                          rounded
                          source={
                            request.requester_profile.avatar_url
                              ? { uri: request.requester_profile.avatar_url }
                              : undefined
                          }
                          icon={!request.requester_profile.avatar_url ? { name: "user", type: "feather" } : undefined}
                          containerStyle={styles.avatar}
                        />

                        <View style={styles.requestContent}>
                          <Text style={styles.requestTitle}>Friend Request</Text>
                          <Text style={styles.requestUser}>
                            {request.requester_profile?.full_name || "Someone"} wants to be friends
                          </Text>
                          <Text style={styles.requestTime}>{formatTime(request.created_at)}</Text>

                          <View style={styles.requestActions}>
                            <Button
                              title="Decline"
                              onPress={() => respondToFriendRequest(request.id, "declined")}
                              buttonStyle={styles.declineButton}
                              titleStyle={styles.declineButtonText}
                            />
                            <Button
                              title="Accept"
                              onPress={() => respondToFriendRequest(request.id, "accepted")}
                              buttonStyle={styles.acceptButton}
                              titleStyle={styles.acceptButtonText}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Trade Requests */}
                {tradeRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Trade Requests</Text>
                    {tradeRequests.map((request) => (
                      <View key={request.id} style={styles.tradeRequestCard}>
                        <View style={styles.tradeRequestHeader}>
                          <Text style={styles.requestTitle}>Trade Request</Text>
                          <View style={[styles.statusBadge, styles.statuspending]}>
                            <Text style={styles.statusText}>PENDING</Text>
                          </View>
                        </View>

                        <View style={styles.tradeDetails}>
                          <Text style={styles.tradeText}>
                            {request.requester_profile?.full_name || "Someone"} wants to trade their{" "}
                            <Text style={styles.itemName}>{request.requester_item.title}</Text> for your{" "}
                            <Text style={styles.itemName}>{request.target_item.title}</Text>
                          </Text>
                        </View>

                        <View style={styles.requestActions}>
                          <Button
                            title="Decline"
                            onPress={() => respondToTradeRequest(request.id, "declined")}
                            buttonStyle={styles.declineButton}
                            titleStyle={styles.declineButtonText}
                          />
                          <Button
                            title="Accept"
                            onPress={() => respondToTradeRequest(request.id, "accepted")}
                            buttonStyle={styles.acceptButton}
                            titleStyle={styles.acceptButtonText}
                          />
                        </View>

                        <Text style={styles.requestTime}>{formatTime(request.created_at)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {friendRequests.length === 0 && tradeRequests.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Pending Requests</Text>
                    <Text style={styles.emptySubtitle}>New friend and trade requests will appear here</Text>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {/* Outgoing Friend Requests */}
                {outgoingFriendRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Friend Requests Sent</Text>
                    {outgoingFriendRequests.map((request) => (
                      <View key={request.id} style={styles.requestCard}>
                        <Avatar
                          size={50}
                          rounded
                          source={
                            request.addressee_profile?.avatar_url
                              ? { uri: request.addressee_profile.avatar_url }
                              : undefined
                          }
                          icon={!request.addressee_profile?.avatar_url ? { name: "user", type: "feather" } : undefined}
                          containerStyle={styles.avatar}
                        />

                        <View style={styles.requestContent}>
                          <Text style={styles.requestTitle}>Friend Request Sent</Text>
                          <Text style={styles.requestUser}>
                            Waiting for {request.addressee_profile?.full_name} (@{request.addressee_profile?.username})
                            to respond
                          </Text>
                          <Text style={styles.requestTime}>Sent {formatTime(request.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Outgoing Trade Requests */}
                {outgoingTradeRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Trade Requests Sent</Text>
                    {outgoingTradeRequests.map((request) => (
                      <View key={request.id} style={styles.tradeRequestCard}>
                        <View style={styles.tradeRequestHeader}>
                          <Text style={styles.requestTitle}>Trade Request Sent</Text>
                          <View style={[styles.statusBadge, styles.statuspending]}>
                            <Text style={styles.statusText}>PENDING</Text>
                          </View>
                        </View>

                        <View style={styles.tradeDetails}>
                          <Text style={styles.tradeText}>
                            You offered your <Text style={styles.itemName}>{request.requester_item.title}</Text> for{" "}
                            {request.target_profile?.full_name || "someone"}'s{" "}
                            <Text style={styles.itemName}>{request.target_item.title}</Text>
                          </Text>
                        </View>
                        <Text style={styles.requestTime}>Sent {formatTime(request.created_at)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {outgoingFriendRequests.length === 0 && outgoingTradeRequests.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Pending Outgoing Requests</Text>
                    <Text style={styles.emptySubtitle}>Friend and trade requests you send will appear here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Hide Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hide Conversation</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Are you sure you want to hide your conversation with{" "}
                <Text style={styles.modalUserName}>{conversationToDelete?.other_user.full_name || "this user"}</Text>?
              </Text>
              <Text style={styles.modalSubtext}>
                This will only hide it for you. {conversationToDelete?.other_user.full_name || "The other user"} will
                still be able to see the conversation and send you messages.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={cancelDelete} disabled={deleting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalDeleteButton} onPress={confirmDelete} disabled={deleting}>
                <Text style={styles.modalDeleteText}>{deleting ? "Hiding..." : "Hide"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    fontSize: 18,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  addFriendButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    margin: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  activeTabText: {
    color: "#3b82f6",
  },
  content: {
    flex: 1,
  },
  conversationWrapper: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  conversationItem: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
  },
  avatar: {
    backgroundColor: "#e2e8f0",
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  timestamp: {
    fontSize: 12,
    color: "#94a3b8",
  },
  messagePreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  unreadCount: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  requestSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  requestCard: {
    flexDirection: "row",
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tradeRequestCard: {
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tradeRequestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestContent: {
    flex: 1,
    marginLeft: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  requestUser: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 12,
  },
  tradeDetails: {
    marginBottom: 16,
  },
  tradeText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  itemName: {
    fontWeight: "600",
    color: "#1e293b",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  declineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  declineButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  acceptButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acceptButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  subTabs: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    padding: 2,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  activeSubTab: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  activeSubTabText: {
    color: "#3b82f6",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statuspending: {
    backgroundColor: "#fef3c7",
  },
  statusaccepted: {
    backgroundColor: "#d1fae5",
  },
  statusdeclined: {
    backgroundColor: "#fee2e2",
  },
  statuscompleted: {
    backgroundColor: "#dbeafe",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  deleteButton: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderLeftWidth: 1,
    borderLeftColor: "#fecaca",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
  },
  modalBody: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 12,
  },
  modalUserName: {
    fontWeight: "600",
    color: "#1e293b",
  },
  modalSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  modalDeleteButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fef2f2",
  },
  modalDeleteText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
})
