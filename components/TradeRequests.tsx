"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { TradeRequest, Item, Profile } from "../types/database"
import { Button } from "@rneui/themed"

interface TradeRequestsProps {
  session: Session
}

interface TradeRequestWithDetails extends TradeRequest {
  requester_item: Item
  target_item: Item
  requester_profile: Profile
}

export default function TradeRequests({ session }: TradeRequestsProps) {
  const [incomingRequests, setIncomingRequests] = useState<TradeRequestWithDetails[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<TradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming")

  useEffect(() => {
    loadTradeRequests()
  }, [])

  async function loadTradeRequests() {
    try {
      setLoading(true)

      // Load incoming requests (requests for user's items)
      const { data: incoming, error: incomingError } = await supabase
        .from("trade_requests")
        .select(`
          *,
          requester_item:items!trade_requests_requester_item_id_fkey(*),
          target_item:items!trade_requests_target_item_id_fkey(*),
          requester_profile:profiles!trade_requests_requester_id_fkey(*)
        `)
        .eq("target_user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (incomingError) throw incomingError

      // Load outgoing requests (user's requests for others' items)
      const { data: outgoing, error: outgoingError } = await supabase
        .from("trade_requests")
        .select(`
          *,
          requester_item:items!trade_requests_requester_item_id_fkey(*),
          target_item:items!trade_requests_target_item_id_fkey(*),
          requester_profile:profiles!trade_requests_requester_id_fkey(*)
        `)
        .eq("requester_id", session.user.id)
        .order("created_at", { ascending: false })

      if (outgoingError) throw outgoingError

      setIncomingRequests(incoming || [])
      setOutgoingRequests(outgoing || [])
    } catch (error) {
      console.error("Error loading trade requests:", error)
      Alert.alert("Error", "Failed to load trade requests")
    } finally {
      setLoading(false)
    }
  }

  async function respondToRequest(requestId: string, status: "accepted" | "declined") {
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

      // TODO: If accepted, implement next steps:
      // 1. Mark both items as "pending trade"
      // 2. Create a chat/messaging system for coordination
      // 3. Add meetup location selection
      // 4. Implement trade completion confirmation
      // 5. Add rating/review system after trade completion

      loadTradeRequests()
    } catch (error) {
      console.error("Error responding to request:", error)
      Alert.alert("Error", "Failed to respond to trade request")
    }
  }

  const renderTradeRequest = (request: TradeRequestWithDetails, isIncoming: boolean) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestTitle}>{isIncoming ? "Incoming Trade Request" : "Outgoing Trade Request"}</Text>
        <View style={[styles.statusBadge, styles[`status${request.status}`]]}>
          <Text style={styles.statusText}>{request.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.tradeDetails}>
        <View style={styles.itemSection}>
          <Text style={styles.sectionTitle}>{isIncoming ? "They want your:" : "You want their:"}</Text>
          <View style={styles.itemCard}>
            {request.target_item.image_urls?.[0] ? (
              <Image source={{ uri: request.target_item.image_urls[0] }} style={styles.itemImage} />
            ) : (
              <View style={styles.placeholderImage} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{request.target_item.title}</Text>
              <Text style={styles.itemValue}>${request.target_item.estimated_value}</Text>
              <Text style={styles.itemCondition}>{request.target_item.condition}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tradeArrow}>
          <Text style={styles.arrowText}>⇄</Text>
        </View>

        <View style={styles.itemSection}>
          <Text style={styles.sectionTitle}>{isIncoming ? "In exchange for:" : "You offered:"}</Text>
          <View style={styles.itemCard}>
            {request.requester_item.image_urls?.[0] ? (
              <Image source={{ uri: request.requester_item.image_urls[0] }} style={styles.itemImage} />
            ) : (
              <View style={styles.placeholderImage} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{request.requester_item.title}</Text>
              <Text style={styles.itemValue}>${request.requester_item.estimated_value}</Text>
              <Text style={styles.itemCondition}>{request.requester_item.condition}</Text>
            </View>
          </View>
        </View>
      </View>

      {isIncoming && request.status === "pending" && (
        <View style={styles.actions}>
          <Button
            title="Decline"
            onPress={() => respondToRequest(request.id, "declined")}
            buttonStyle={[styles.actionButton, styles.declineButton]}
            titleStyle={styles.declineButtonText}
          />
          <Button
            title="Accept Trade"
            onPress={() => respondToRequest(request.id, "accepted")}
            buttonStyle={[styles.actionButton, styles.acceptButton]}
            titleStyle={styles.acceptButtonText}
          />
        </View>
      )}

      <Text style={styles.requestDate}>{new Date(request.created_at).toLocaleDateString()}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading trade requests...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trade Requests</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "incoming" && styles.activeTab]}
            onPress={() => setActiveTab("incoming")}
          >
            <Text style={[styles.tabText, activeTab === "incoming" && styles.activeTabText]}>
              Incoming ({incomingRequests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "outgoing" && styles.activeTab]}
            onPress={() => setActiveTab("outgoing")}
          >
            <Text style={[styles.tabText, activeTab === "outgoing" && styles.activeTabText]}>
              Outgoing ({outgoingRequests.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "incoming" ? (
          incomingRequests.length > 0 ? (
            incomingRequests.map((request) => renderTradeRequest(request, true))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Incoming Requests</Text>
              <Text style={styles.emptySubtitle}>When someone wants to trade with you, requests will appear here</Text>
            </View>
          )
        ) : outgoingRequests.length > 0 ? (
          outgoingRequests.map((request) => renderTradeRequest(request, false))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Outgoing Requests</Text>
            <Text style={styles.emptySubtitle}>Start swiping to send trade requests to other users</Text>
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
    marginBottom: 20,
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
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
    padding: 20,
  },
  requestCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
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
  tradeDetails: {
    marginBottom: 16,
  },
  itemSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 2,
  },
  itemCondition: {
    fontSize: 12,
    color: "#64748b",
  },
  tradeArrow: {
    alignItems: "center",
    marginVertical: 8,
  },
  arrowText: {
    fontSize: 24,
    color: "#3b82f6",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  declineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  acceptButton: {
    backgroundColor: "#22c55e",
  },
  declineButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  acceptButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  requestDate: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
    paddingHorizontal: 20,
  },
})
