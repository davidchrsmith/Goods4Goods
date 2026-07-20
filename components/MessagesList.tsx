import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from "react-native"
import {
  getConversations,
  getOrCreateConversation,
  sendMessage,
  markConversationRead,
  hideConversation,
} from "../api/messages"
import { getIncomingTradeRequests, getOutgoingTradeRequests, respondToTradeRequest } from "../api/trades"
import { getIncomingFriendRequests, getOutgoingFriendRequests, respondToFriendRequest } from "../api/friends"
import { ApiError } from "../api/client"
import type {
  Profile, ConversationWithDetails, TradeRequestWithDetails,
  FriendRequestWithProfile,
} from "../api/types"
import { Avatar, Button } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"
import FriendSearch from "./FriendSearch"

interface MessagesListProps {
  profile: Profile
  onConversationSelect: (conversation: ConversationWithDetails) => void
  shouldRefresh?: boolean
  onRefreshComplete?: () => void
}

const POLL_INTERVAL = 5000

export default function MessagesList({
  profile,
  onConversationSelect,
  shouldRefresh,
  onRefreshComplete,
}: MessagesListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequestWithProfile[]>([])
  const [incomingTradeRequests, setIncomingTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [outgoingTradeRequests, setOutgoingTradeRequests] = useState<TradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showFriendSearch, setShowFriendSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<"messages" | "requests">("messages")
  const [requestsSubTab, setRequestsSubTab] = useState<"incoming" | "outgoing">("incoming")
  const [showHideModal, setShowHideModal] = useState(false)
  const [conversationToHide, setConversationToHide] = useState<ConversationWithDetails | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadAll()
    pollRef.current = setInterval(loadAll, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (shouldRefresh) {
      loadAll().then(() => onRefreshComplete?.())
    }
  }, [shouldRefresh])

  async function loadAll() {
    try {
      const [convs, inFriend, outFriend, inTrade, outTrade] = await Promise.all([
        getConversations(),
        getIncomingFriendRequests(),
        getOutgoingFriendRequests(),
        getIncomingTradeRequests(),
        getOutgoingTradeRequests(),
      ])
      setConversations(convs)
      setIncomingFriendRequests(inFriend)
      setOutgoingFriendRequests(outFriend)
      setIncomingTradeRequests(inTrade)
      setOutgoingTradeRequests(outTrade)
    } catch {
      // Silently fail on poll errors
    } finally {
      setLoading(false)
    }
  }

  async function handleRespondToFriendRequest(requestId: string, status: "accepted" | "declined") {
    try {
      await respondToFriendRequest(requestId, status)
      setIncomingFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
      if (status === "accepted") loadAll()
    } catch {
      Alert.alert("Error", "Failed to respond to friend request")
    }
  }

  async function handleRespondToTradeRequest(requestId: string, status: "accepted" | "declined") {
    try {
      const request = incomingTradeRequests.find((r) => r.id === requestId)
      await respondToTradeRequest(requestId, status)
      setIncomingTradeRequests((prev) => prev.filter((r) => r.id !== requestId))

      if (status === "accepted" && request) {
        const conv = await getOrCreateConversation(request.requester_id)
        const msg = `Great news! I've accepted your trade request. You offered your "${request.requester_item.title}" for my "${request.target_item.title}". Let's discuss the details!`
        await sendMessage(conv.id, msg)
        loadAll()
      }
    } catch {
      Alert.alert("Error", "Failed to respond to trade request")
    }
  }

  async function handleHideConversation(conversationId: string) {
    try {
      await hideConversation(conversationId)
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      setShowHideModal(false)
      setConversationToHide(null)
    } catch {
      Alert.alert("Error", "Failed to hide conversation")
    }
  }

  async function handleConversationSelect(conv: ConversationWithDetails) {
    if (conv.unread_count > 0) {
      markConversationRead(conv.id).catch(() => {})
    }
    onConversationSelect({ ...conv, unread_count: 0 })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    return date.toLocaleDateString()
  }

  const unreadCount = conversations.filter((c) => c.unread_count > 0).length
  const requestCount = incomingFriendRequests.length + incomingTradeRequests.length

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity onPress={() => setShowFriendSearch(true)} style={styles.addButton}>
          <Feather name="user-plus" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "messages" && styles.activeTab]}
          onPress={() => setActiveTab("messages")}
        >
          <Text style={[styles.tabText, activeTab === "messages" && styles.activeTabText]}>
            Messages {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "requests" && styles.activeTab]}
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" && styles.activeTabText]}>
            Requests {requestCount > 0 && `(${requestCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "messages" && (
          <>
            {conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="message-circle" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Messages Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a conversation by adding friends or accepting trade requests
                </Text>
              </View>
            ) : (
              conversations.map((conv) => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.conversationCard}
                  onPress={() => handleConversationSelect(conv)}
                  onLongPress={() => {
                    setConversationToHide(conv)
                    setShowHideModal(true)
                  }}
                >
                  <Avatar
                    size={50}
                    rounded
                    source={conv.other_user.avatar_url ? { uri: conv.other_user.avatar_url } : undefined}
                    icon={!conv.other_user.avatar_url ? { name: "user", type: "feather" } : undefined}
                    containerStyle={styles.avatar}
                  />
                  <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName}>
                        {conv.other_user.full_name || "Unknown User"}
                      </Text>
                      {conv.last_message && (
                        <Text style={styles.conversationTime}>
                          {formatTime(conv.last_message.created_at)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {conv.last_message ? conv.last_message.content : "No messages yet"}
                      </Text>
                      {conv.unread_count > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{conv.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {activeTab === "requests" && (
          <>
            <View style={styles.subTabBar}>
              {(["incoming", "outgoing"] as const).map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.subTab, requestsSubTab === sub && styles.activeSubTab]}
                  onPress={() => setRequestsSubTab(sub)}
                >
                  <Text style={[styles.subTabText, requestsSubTab === sub && styles.activeSubTabText]}>
                    {sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {requestsSubTab === "incoming" ? (
              <>
                {incomingFriendRequests.length === 0 && incomingTradeRequests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="inbox" size={48} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No Incoming Requests</Text>
                  </View>
                ) : (
                  <>
                    {incomingFriendRequests.map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <Avatar
                          size={45}
                          rounded
                          source={req.requester_profile.avatar_url ? { uri: req.requester_profile.avatar_url } : undefined}
                          icon={!req.requester_profile.avatar_url ? { name: "user", type: "feather" } : undefined}
                          containerStyle={styles.requestAvatar}
                        />
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestTitle}>
                            {req.requester_profile.full_name || "Unknown"} wants to be friends
                          </Text>
                          <Text style={styles.requestSubtitle}>
                            @{req.requester_profile.username || "unknown"}
                          </Text>
                          <View style={styles.requestActions}>
                            <Button
                              title="Accept"
                              onPress={() => handleRespondToFriendRequest(req.id, "accepted")}
                              buttonStyle={styles.acceptButton}
                              titleStyle={styles.acceptButtonText}
                              size="sm"
                            />
                            <Button
                              title="Decline"
                              onPress={() => handleRespondToFriendRequest(req.id, "declined")}
                              buttonStyle={styles.declineButton}
                              titleStyle={styles.declineButtonText}
                              size="sm"
                            />
                          </View>
                        </View>
                      </View>
                    ))}

                    {incomingTradeRequests.map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestTitle}>Incoming Trade Request</Text>
                          <Text style={styles.requestSubtitle}>
                            {req.requester_profile?.full_name || "Someone"} wants to trade:
                          </Text>
                          <Text style={styles.tradeDetail}>
                            Their: {req.requester_item.title} (${req.requester_item.estimated_value})
                          </Text>
                          <Text style={styles.tradeDetail}>
                            For your: {req.target_item.title} (${req.target_item.estimated_value})
                          </Text>
                          <View style={styles.requestActions}>
                            <Button
                              title="Accept"
                              onPress={() => handleRespondToTradeRequest(req.id, "accepted")}
                              buttonStyle={styles.acceptButton}
                              titleStyle={styles.acceptButtonText}
                              size="sm"
                            />
                            <Button
                              title="Decline"
                              onPress={() => handleRespondToTradeRequest(req.id, "declined")}
                              buttonStyle={styles.declineButton}
                              titleStyle={styles.declineButtonText}
                              size="sm"
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {outgoingFriendRequests.length === 0 && outgoingTradeRequests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="send" size={48} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No Outgoing Requests</Text>
                  </View>
                ) : (
                  <>
                    {outgoingFriendRequests.map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestTitle}>Friend Request Sent</Text>
                          <Text style={styles.requestSubtitle}>
                            To: {req.addressee_profile?.full_name || "Unknown"} — Pending
                          </Text>
                        </View>
                      </View>
                    ))}
                    {outgoingTradeRequests.map((req) => (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestTitle}>Trade Request Sent</Text>
                          <Text style={styles.requestSubtitle}>
                            Your: {req.requester_item.title} → Their: {req.target_item.title}
                          </Text>
                          <Text style={styles.tradeDetail}>Status: Pending</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Hide conversation modal */}
      <Modal visible={showHideModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hide Conversation?</Text>
            <Text style={styles.modalSubtitle}>
              This conversation will be hidden. It will reappear if you receive new messages.
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => { setShowHideModal(false); setConversationToHide(null) }}
                buttonStyle={styles.cancelButton}
                titleStyle={styles.cancelButtonText}
              />
              <Button
                title="Hide"
                onPress={() => conversationToHide && handleHideConversation(conversationToHide.id)}
                buttonStyle={styles.hideButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Friend search modal */}
      <Modal visible={showFriendSearch} animationType="slide">
        <FriendSearch profile={profile} onBack={() => setShowFriendSearch(false)} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#64748b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  addButton: { padding: 8 },
  tabBar: { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#3b82f6" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  activeTabText: { color: "#3b82f6" },
  content: { flex: 1 },
  conversationCard: { flexDirection: "row", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", alignItems: "center" },
  avatar: { marginRight: 12 },
  conversationInfo: { flex: 1 },
  conversationHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  conversationName: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  conversationTime: { fontSize: 12, color: "#94a3b8" },
  conversationFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { flex: 1, fontSize: 14, color: "#64748b" },
  unreadBadge: { backgroundColor: "#3b82f6", borderRadius: 12, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 6, marginLeft: 8 },
  unreadText: { color: "white", fontSize: 11, fontWeight: "bold" },
  subTabBar: { flexDirection: "row", backgroundColor: "#f8fafc", padding: 8, gap: 8 },
  subTab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  activeSubTab: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  subTabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  activeSubTabText: { color: "#3b82f6" },
  requestCard: { flexDirection: "row", backgroundColor: "white", margin: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  requestAvatar: { marginRight: 12 },
  requestInfo: { flex: 1 },
  requestTitle: { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  requestSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  tradeDetail: { fontSize: 12, color: "#94a3b8", marginBottom: 2 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  acceptButton: { backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 16 },
  acceptButtonText: { fontWeight: "600" },
  declineButton: { backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 16 },
  declineButtonText: { color: "#64748b", fontWeight: "600" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#64748b", marginTop: 12, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "white", borderRadius: 16, padding: 24, margin: 20, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelButton: { flex: 1, backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 },
  cancelButtonText: { color: "#64748b" },
  hideButton: { flex: 1, backgroundColor: "#ef4444", borderRadius: 8 },
})
