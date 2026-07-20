import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Image } from "react-native"
import { getIncomingTradeRequests, getOutgoingTradeRequests, respondToTradeRequest } from "../api/trades"
import { ApiError } from "../api/client"
import type { Profile, TradeRequestWithDetails } from "../api/types"
import { Button } from "@rneui/themed"

interface TradeRequestsProps {
  profile: Profile
}

export default function TradeRequests({ profile }: TradeRequestsProps) {
  const [incoming, setIncoming] = useState<TradeRequestWithDetails[]>([])
  const [outgoing, setOutgoing] = useState<TradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming")

  useEffect(() => {
    loadTradeRequests()
  }, [])

  async function loadTradeRequests() {
    setLoading(true)
    try {
      const [inc, out] = await Promise.all([getIncomingTradeRequests(), getOutgoingTradeRequests()])
      setIncoming(inc)
      setOutgoing(out)
    } catch {
      Alert.alert("Error", "Failed to load trade requests")
    } finally {
      setLoading(false)
    }
  }

  async function handleRespond(requestId: string, status: "accepted" | "declined") {
    try {
      await respondToTradeRequest(requestId, status)
      Alert.alert("Success", status === "accepted" ? "Trade request accepted!" : "Trade request declined")
      loadTradeRequests()
    } catch {
      Alert.alert("Error", "Failed to respond to trade request")
    }
  }

  const renderRequest = (request: TradeRequestWithDetails, isIncoming: boolean) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestTitle}>
          {isIncoming ? "Incoming Trade Request" : "Outgoing Trade Request"}
        </Text>
        <View style={[styles.statusBadge, styles[`status_${request.status}` as keyof typeof styles] as any]}>
          <Text style={styles.statusText}>{request.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.tradeDetails}>
        <View style={styles.itemSection}>
          <Text style={styles.sectionLabel}>{isIncoming ? "They want your:" : "You want their:"}</Text>
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
          <Text style={styles.sectionLabel}>{isIncoming ? "In exchange for:" : "You offered:"}</Text>
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
            onPress={() => handleRespond(request.id, "declined")}
            buttonStyle={styles.declineButton}
            titleStyle={styles.declineButtonText}
          />
          <Button
            title="Accept"
            onPress={() => handleRespond(request.id, "accepted")}
            buttonStyle={styles.acceptButton}
          />
        </View>
      )}
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading trade requests...</Text>
      </View>
    )
  }

  const list = activeTab === "incoming" ? incoming : outgoing

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trade Requests</Text>
        <View style={styles.tabs}>
          {(["incoming", "outgoing"] as const).map((tab) => (
            <View
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
              <Text
                style={[styles.tabText, activeTab === tab && styles.activeTabText]}
                onPress={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} (
                {tab === "incoming" ? incoming.length : outgoing.length})
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {list.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No {activeTab} trade requests</Text>
          </View>
        ) : (
          list.map((req) => renderRequest(req, activeTab === "incoming"))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#64748b" },
  header: { padding: 20, paddingTop: 60, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 16, textAlign: "center" },
  tabs: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: "white" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  activeTabText: { color: "#3b82f6" },
  content: { flex: 1, padding: 16 },
  requestCard: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  requestTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  status_pending: { backgroundColor: "#fef3c7" },
  status_accepted: { backgroundColor: "#d1fae5" },
  status_declined: { backgroundColor: "#fee2e2" },
  statusText: { fontSize: 11, fontWeight: "bold", color: "#374151" },
  tradeDetails: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemSection: { flex: 1 },
  sectionLabel: { fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: "600" },
  itemCard: { backgroundColor: "#f8fafc", borderRadius: 8, padding: 8 },
  itemImage: { width: "100%", height: 80, borderRadius: 6, marginBottom: 8, resizeMode: "cover" },
  placeholderImage: { width: "100%", height: 80, backgroundColor: "#e2e8f0", borderRadius: 6, marginBottom: 8 },
  itemInfo: {},
  itemTitle: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  itemValue: { fontSize: 12, color: "#059669", fontWeight: "600" },
  itemCondition: { fontSize: 11, color: "#94a3b8" },
  tradeArrow: { width: 30, alignItems: "center" },
  arrowText: { fontSize: 24, color: "#64748b" },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  acceptButton: { flex: 1, backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 12 },
  declineButton: { flex: 1, backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingVertical: 12 },
  declineButtonText: { color: "#64748b" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: "#64748b" },
})
