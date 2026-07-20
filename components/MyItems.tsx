import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Image, Pressable } from "react-native"
import { getMyItems, updateItem, deleteItem } from "../api/items"
import { ApiError } from "../api/client"
import type { Item, Profile } from "../api/types"
import { Feather } from "@expo/vector-icons"

interface MyItemsProps {
  profile: Profile
}

export default function MyItems({ profile }: MyItemsProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"available" | "unavailable" | "traded">("available")

  useEffect(() => {
    loadMyItems()
  }, [])

  async function loadMyItems() {
    setLoading(true)
    try {
      const data = await getMyItems()
      setItems(data)
    } catch {
      Alert.alert("Error", "Failed to load your items")
    } finally {
      setLoading(false)
    }
  }

  async function toggleItemAvailability(itemId: string, currentAvailability: boolean) {
    const newAvailability = !currentAvailability
    const newStatus = newAvailability ? "available" : "unavailable"
    try {
      await updateItem(itemId, { is_available: newAvailability, status: newStatus })
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_available: newAvailability, status: newStatus } : item,
        ),
      )
      Alert.alert("Success", `Item ${newAvailability ? "reposted" : "taken down"} successfully!`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update item"
      Alert.alert("Error", message)
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteItem(itemId)
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      Alert.alert("Success", "Item deleted successfully!")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete item"
      Alert.alert("Error", message)
    }
  }

  const filteredItems = items.filter((item) => {
    if (activeTab === "available") return item.status === "available" && item.is_available
    if (activeTab === "unavailable") return item.status === "unavailable" && !item.is_available
    return item.status === "traded"
  })

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "available": return { backgroundColor: "#d1fae5", color: "#065f46" }
      case "unavailable": return { backgroundColor: "#fee2e2", color: "#991b1b" }
      case "traded": return { backgroundColor: "#dbeafe", color: "#1e40af" }
      default: return { backgroundColor: "#f3f4f6", color: "#374151" }
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your items...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Items</Text>
        <Text style={styles.subtitle}>Manage your posted items</Text>
        <View style={styles.tabs}>
          {(["available", "unavailable", "traded"] as const).map((tab) => {
            const labels = { available: "Available", unavailable: "Taken Down", traded: "Traded" }
            const count = items.filter((i) => {
              if (tab === "available") return i.status === "available"
              if (tab === "unavailable") return i.status === "unavailable"
              return i.status === "traded"
            }).length
            return (
              <Pressable
                key={tab}
                style={({ pressed }) => [styles.tab, activeTab === tab && styles.activeTab, pressed && styles.tabPressed]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {labels[tab]} ({count})
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const badgeStyle = getStatusBadgeStyle(item.status)
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemImageContainer}>
                    {item.image_urls?.length > 0 ? (
                      <Image source={{ uri: item.image_urls[0] }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.placeholderImage}>
                        <Feather name="image" size={24} color="#94a3b8" />
                      </View>
                    )}
                    {item.image_urls?.length > 1 && (
                      <View style={styles.imageCount}>
                        <Text style={styles.imageCountText}>+{item.image_urls.length - 1}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemValue}>${item.estimated_value}</Text>
                    <Text style={styles.itemCondition}>{item.condition}</Text>
                    <Text style={styles.itemDate}>Posted {formatDate(item.created_at)}</Text>
                  </View>
                  <View style={styles.statusIndicator}>
                    <View style={[styles.statusBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                      <Text style={[styles.statusText, { color: badgeStyle.color }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>

                <View style={styles.itemActions}>
                  {item.status === "traded" ? (
                    <View style={styles.tradedActions}>
                      <Text style={styles.tradedText}>This item has been traded</Text>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.buttonPressed]}
                        onPress={() => handleDeleteItem(item.id)}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionButton,
                          item.is_available ? styles.takeDownButton : styles.repostButton,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => toggleItemAvailability(item.id, item.is_available)}
                      >
                        <Text style={[styles.actionButtonText, item.is_available ? styles.takeDownButtonText : styles.repostButtonText]}>
                          {item.is_available ? "Take Down" : "Repost"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.buttonPressed]}
                        onPress={() => handleDeleteItem(item.id)}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            )
          })
        ) : (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>
              {activeTab === "available" && "No Available Items"}
              {activeTab === "unavailable" && "No Taken Down Items"}
              {activeTab === "traded" && "No Traded Items"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "available" && "Start by adding your first item to trade!"}
              {activeTab === "unavailable" && "Items you take down will appear here."}
              {activeTab === "traded" && "Items traded through the app will appear here."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  loadingText: { fontSize: 18, color: "#64748b" },
  header: { padding: 20, paddingTop: 60, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 16, color: "#64748b", textAlign: "center", marginBottom: 20 },
  tabs: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabPressed: { opacity: 0.7 },
  tabText: { fontSize: 12, fontWeight: "600", color: "#64748b", textAlign: "center" },
  activeTabText: { color: "#3b82f6" },
  content: { flex: 1, padding: 20 },
  itemCard: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  itemHeader: { flexDirection: "row", marginBottom: 12 },
  itemImageContainer: { position: "relative", marginRight: 12 },
  itemImage: { width: 80, height: 80, borderRadius: 12 },
  placeholderImage: { width: 80, height: 80, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center", borderRadius: 12 },
  imageCount: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#3b82f6", borderRadius: 8, padding: 2 },
  imageCountText: { color: "white", fontSize: 10 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  itemValue: { fontSize: 16, color: "#64748b", marginBottom: 4 },
  itemCondition: { fontSize: 14, color: "#94a3b8", marginBottom: 4 },
  itemDate: { fontSize: 12, color: "#64748b" },
  statusIndicator: { alignItems: "flex-end" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "bold" },
  itemDescription: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  itemActions: { flexDirection: "row", justifyContent: "space-between" },
  tradedActions: { flex: 1, alignItems: "center" },
  tradedText: { fontSize: 14, color: "#1e40af", fontStyle: "italic", marginBottom: 12, textAlign: "center" },
  actionButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  takeDownButton: { backgroundColor: "#f87171" },
  repostButton: { backgroundColor: "#6ee7b7" },
  deleteButton: { backgroundColor: "#f87171" },
  buttonPressed: { opacity: 0.7 },
  actionButtonText: { fontSize: 14, fontWeight: "bold", color: "white" },
  takeDownButtonText: { color: "#732d2d" },
  repostButtonText: { color: "#065f46" },
  deleteButtonText: { color: "#732d2d" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#64748b", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
})
