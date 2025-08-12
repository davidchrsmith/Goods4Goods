"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Conversation, Profile, Message, Friendship, TradeRequest, Item } from "../types/database"
import { Avatar, Button } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"
import FriendSearch from "./FriendSearch"

interface MessagesListProps {
  session: Session
  onConversationSelect: (conversation: ConversationWithDetails) => void
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

export default function MessagesList({ session, onConversationSelect }: MessagesListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [tradeRequests, setTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [outgoingTradeRequests, setOutgoingTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showFriendSearch, setShowFriendSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<"messages" | "requests">("messages")
  const [requestsSubTab, setRequestsSubTab] = useState<"incoming" | "outgoing">("incoming")

  useEffect(() => {
    loadConversations()
    loadFriendRequests()
    loadTradeRequests()
    loadOutgoingFriendRequests()
    loadOutgoingTradeRequests()

    // Subscribe to real-time updates
    const conversationsSubscription = supabase
      .channel("conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe()

    const messagesSubscription = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadConversations())
      .subscribe()

    const friendshipsSubscription = supabase
      .channel("friendships")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => loadFriendRequests())
      .subscribe()

    const tradeRequestsSubscription = supabase
      .channel("trade_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_requests" }, () => loadTradeRequests())
      .subscribe()

    return () => {
      conversationsSubscription.unsubscribe()
      messagesSubscription.unsubscribe()
      friendshipsSubscription.unsubscribe()
      tradeRequestsSubscription.unsubscribe()
    }
  }, [])

  async function loadConversations() {
    try {
      setLoading(true)

      // Get conversations where user is participant
      const { data: conversationsData, error: conversationsError } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .order("last_message_at", { ascending: false })

      if (conversationsError) throw conversationsError

      if (!conversationsData || conversationsData.length === 0) {
        setConversations([])
        return
      }

      // Get other user profiles and last messages for each conversation
      const conversationsWithDetails = await Promise.all(
        conversationsData.map(async (conversation) => {
          const otherUserId = conversation.user1_id === session.user.id ? conversation.user2_id : conversation.user1_id

          // Get other user's profile
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", otherUserId).single()

          // Get last message
          const { data: lastMessage } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

          // Get unread count
          const { count: unreadCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conversation.id)
            .eq("is_read", false)
            .neq("sender_id", session.user.id)

          return {
            ...conversation,
            other_user: profile || {
              id: otherUserId,
              full_name: "Unknown User",
              username: null,
              phone: null,
              avatar_url: null,
              created_at: "",
              updated_at: "",
            },
            last_message: lastMessage || null,
            unread_count: unreadCount || 0,
          }
        }),
      )

      setConversations(conversationsWithDetails)
    } catch (error) {
      console.error("Error loading conversations:", error)
      Alert.alert("Error", "Failed to load conversations")
    } finally {
      setLoading(false)
    }
  }

  async function loadFriendRequests() {
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select(`
          *,
          requester_profile:profiles!friendships_requester_id_fkey(*)
        `)
        .eq("addressee_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error

      setFriendRequests(data || [])
    } catch (error) {
      console.error("Error loading friend requests:", error)
    }
  }

  async function loadTradeRequests() {
    try {
      const { data, error } = await supabase
        .from("trade_requests")
        .select(`
          *,
          requester_item:items!trade_requests_requester_item_id_fkey(*),
          target_item:items!trade_requests_target_item_id_fkey(*),
          requester_profile:profiles!trade_requests_requester_id_fkey(*)
        `)
        .eq("target_user_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error

      setTradeRequests(data || [])
    } catch (error) {
      console.error("Error loading trade requests:", error)
    }
  }

  async function loadOutgoingFriendRequests() {
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select(`
        *,
        addressee_profile:profiles!friendships_addressee_id_fkey(*)
      `)
        .eq("requester_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error

      setOutgoingFriendRequests(data || [])
    } catch (error) {
      console.error("Error loading outgoing friend requests:", error)
    }
  }

  async function loadOutgoingTradeRequests() {
    try {
      const { data, error } = await supabase
        .from("trade_requests")
        .select(`
        *,
        requester_item:items!trade_requests_requester_item_id_fkey(*),
        target_item:items!trade_requests_target_item_id_fkey(*),
        target_profile:profiles!trade_requests_target_user_id_fkey(*)
      `)
        .eq("requester_id", session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error

      setOutgoingTradeRequests(data || [])
    } catch (error) {
      console.error("Error loading outgoing trade requests:", error)
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

      Alert.alert("Success", status === "accepted" ? "Friend request accepted!" : "Friend request declined")
      loadFriendRequests()
    } catch (error) {
      console.error("Error responding to friend request:", error)
      Alert.alert("Error", "Failed to respond to friend request")
    }
  }

  async function respondToTradeRequest(requestId: string, status: "accepted" | "declined") {
    try {
      const { error } = await supabase
        .from("trade_requests")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) throw error

      Alert.alert("Success", status === "accepted" ? "Trade request accepted!" : "Trade request declined")
      loadTradeRequests()
    } catch (error) {
      console.error("Error responding to trade request:", error)
      Alert.alert("Error", "Failed to respond to trade request")
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
            Messages ({conversations.length})
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
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => onConversationSelect(conversation)}
              >
                <Avatar
                  size={50}
                  rounded
                  source={conversation.other_user.avatar_url ? { uri: conversation.other_user.avatar_url } : undefined}
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
                {/* Existing incoming requests code */}
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
                            {request.requester_profile.full_name} (@{request.requester_profile.username}) wants to be
                            friends
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

                {tradeRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Trade Requests</Text>
                    {tradeRequests.map((request) => (
                      <View key={request.id} style={styles.tradeRequestCard}>
                        <View style={styles.tradeRequestHeader}>
                          <Text style={styles.requestTitle}>Trade Request</Text>
                          <Text style={styles.requestTime}>{formatTime(request.created_at)}</Text>
                        </View>

                        <View style={styles.tradeDetails}>
                          <Text style={styles.tradeText}>
                            {request.requester_profile.full_name} wants to trade their{" "}
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
                      </View>
                    ))}
                  </View>
                )}

                {friendRequests.length === 0 && tradeRequests.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Incoming Requests</Text>
                    <Text style={styles.emptySubtitle}>Friend and trade requests you receive will appear here</Text>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {/* Outgoing requests */}
                {outgoingFriendRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Friend Requests Sent</Text>
                    {outgoingFriendRequests.map((request) => (
                      <View key={request.id} style={styles.requestCard}>
                        <Avatar
                          size={50}
                          rounded
                          source={
                            request.addressee_profile.avatar_url
                              ? { uri: request.addressee_profile.avatar_url }
                              : undefined
                          }
                          icon={!request.addressee_profile.avatar_url ? { name: "user", type: "feather" } : undefined}
                          containerStyle={styles.avatar}
                        />

                        <View style={styles.requestContent}>
                          <Text style={styles.requestTitle}>Friend Request Sent</Text>
                          <Text style={styles.requestUser}>
                            Waiting for {request.addressee_profile.full_name} (@{request.addressee_profile.username}) to
                            respond
                          </Text>
                          <Text style={styles.requestTime}>Sent {formatTime(request.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {outgoingTradeRequests.length > 0 && (
                  <View style={styles.requestSection}>
                    <Text style={styles.sectionTitle}>Trade Requests Sent</Text>
                    {outgoingTradeRequests.map((request) => (
                      <View key={request.id} style={styles.tradeRequestCard}>
                        <View style={styles.tradeRequestHeader}>
                          <Text style={styles.requestTitle}>Trade Request Sent</Text>
                          <Text style={styles.requestTime}>Sent {formatTime(request.created_at)}</Text>
                        </View>

                        <View style={styles.tradeDetails}>
                          <Text style={styles.tradeText}>
                            You offered your <Text style={styles.itemName}>{request.requester_item.title}</Text> for{" "}
                            {request.target_profile.full_name}'s{" "}
                            <Text style={styles.itemName}>{request.target_item.title}</Text>
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {outgoingFriendRequests.length === 0 && outgoingTradeRequests.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Outgoing Requests</Text>
                    <Text style={styles.emptySubtitle}>Friend and trade requests you send will appear here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  conversationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
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
})
