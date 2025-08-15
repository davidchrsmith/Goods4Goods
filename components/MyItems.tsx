"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Image, Pressable } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Item } from "../types/database"
import { Feather } from "@expo/vector-icons"

interface MyItemsProps {
  session: Session
}

export default function MyItems({ session }: MyItemsProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"available" | "unavailable" | "traded">("available")
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Add debug logging function
  const addDebugLog = (message: string) => {
    console.log(message)
    setDebugInfo((prev) => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    loadMyItems()
  }, [])

  async function loadMyItems() {
    try {
      setLoading(true)
      addDebugLog("Loading items...")

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setItems(data || [])
      addDebugLog(`Loaded ${data?.length || 0} items`)
    } catch (error) {
      console.error("Error loading items:", error)
      addDebugLog(`Error loading items: ${error.message}`)
      Alert.alert("Error", "Failed to load your items")
    } finally {
      setLoading(false)
    }
  }

  async function toggleItemAvailability(itemId: string, currentAvailability: boolean) {
    addDebugLog(`toggleItemAvailability called for item ${itemId.substring(0, 8)}`)

    try {
      const action = currentAvailability ? "take down" : "repost"
      const newAvailability = !currentAvailability
      const newStatus = newAvailability ? "available" : "unavailable"

      addDebugLog(`Action: ${action}, New availability: ${newAvailability}, New status: ${newStatus}`)

      // Proceed directly without confirmation
      addDebugLog("Proceeding with Supabase update...")

      // Delete associated trade requests first
      const { error: tradeRequestError } = await supabase
        .from("trade_requests")
        .delete()
        .or(`requester_item_id.eq.${itemId},target_item_id.eq.${itemId}`)

      if (tradeRequestError) {
        addDebugLog(`Trade request cleanup error: ${tradeRequestError.message}`)
        // Continue anyway - this is not critical
      } else {
        addDebugLog("Trade requests cleaned up successfully")
      }

      const { data, error } = await supabase
        .from("items")
        .update({
          is_available: newAvailability,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("user_id", session.user.id)
        .select()

      addDebugLog(`Supabase result: ${error ? "ERROR" : "SUCCESS"}`)

      if (error) {
        addDebugLog(`Database error: ${error.message}`)
        Alert.alert("Database Error", `Failed to ${action} item: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        addDebugLog("No rows updated - permission issue?")
        Alert.alert("Error", "Item not found or you don't have permission to modify it")
        return
      }

      addDebugLog(`Item ${action} successful! Updated ${data.length} rows`)
      Alert.alert("Success", `Item ${action} successful!`)

      // Update local state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                is_available: newAvailability,
                status: newStatus,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      )

      addDebugLog("Local state updated")

      // Reload items
      loadMyItems()
    } catch (error) {
      addDebugLog(`Function error: ${error.message}`)
      Alert.alert("Error", `Function error: ${error.message}`)
    }
  }

  async function deleteItem(itemId: string, imageUrls: string[]) {
    addDebugLog(`deleteItem called for item ${itemId.substring(0, 8)}`)

    try {
      addDebugLog("Proceeding with deletion...")

      // Delete associated trade requests first
      const { error: tradeRequestError } = await supabase
        .from("trade_requests")
        .delete()
        .or(`requester_item_id.eq.${itemId},target_item_id.eq.${itemId}`)

      if (tradeRequestError) {
        addDebugLog(`Trade request cleanup error: ${tradeRequestError.message}`)
        // Continue anyway - this is not critical
      } else {
        addDebugLog("Trade requests cleaned up successfully")
      }

      const { data, error } = await supabase
        .from("items")
        .delete()
        .eq("id", itemId)
        .eq("user_id", session.user.id)
        .select()

      addDebugLog(`Delete result: ${error ? "ERROR" : "SUCCESS"}`)

      if (error) {
        addDebugLog(`Delete error: ${error.message}`)
        Alert.alert("Database Error", `Failed to delete item: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        addDebugLog("No rows deleted - permission issue?")
        Alert.alert("Error", "Item not found or you don't have permission to delete it")
        return
      }

      addDebugLog(`Item deleted successfully! Deleted ${data.length} rows`)
      Alert.alert("Success", "Item deleted successfully!")

      // Update local state
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId))

      addDebugLog("Local state updated")

      // Try to delete images from storage
      if (imageUrls && imageUrls.length > 0) {
        try {
          const filePaths = imageUrls
            .map((url) => {
              const urlParts = url.split("/item-images/")
              return urlParts.length > 1 ? urlParts[1] : null
            })
            .filter(Boolean) as string[]

          if (filePaths.length > 0) {
            const { error: storageError } = await supabase.storage.from("item-images").remove(filePaths)
            if (storageError) {
              addDebugLog(`Image cleanup error: ${storageError.message}`)
            } else {
              addDebugLog("Images deleted successfully")
            }
          }
        } catch (imageError) {
          addDebugLog(`Error processing images: ${imageError.message}`)
        }
      }

      // Reload items
      loadMyItems()
    } catch (error) {
      addDebugLog(`Delete error: ${error.message}`)
      Alert.alert("Error", `Unexpected error: ${error.message}`)
    }
  }

  const getFilteredItems = () => {
    switch (activeTab) {
      case "available":
        return items.filter((item) => item.status === "available" && item.is_available)
      case "unavailable":
        return items.filter((item) => item.status === "unavailable" && !item.is_available)
      case "traded":
        return items.filter((item) => item.status === "traded")
      default:
        return []
    }
  }

  const filteredItems = getFilteredItems()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "available":
        return { backgroundColor: "#d1fae5", color: "#065f46" }
      case "unavailable":
        return { backgroundColor: "#fee2e2", color: "#991b1b" }
      case "traded":
        return { backgroundColor: "#dbeafe", color: "#1e40af" }
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" }
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
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              activeTab === "available" && styles.activeTab,
              pressed && styles.tabPressed,
            ]}
            onPress={() => {
              addDebugLog("Available tab pressed")
              setActiveTab("available")
            }}
          >
            <Text style={[styles.tabText, activeTab === "available" && styles.activeTabText]}>
              Available ({items.filter((item) => item.status === "available").length})
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              activeTab === "unavailable" && styles.activeTab,
              pressed && styles.tabPressed,
            ]}
            onPress={() => {
              addDebugLog("Unavailable tab pressed")
              setActiveTab("unavailable")
            }}
          >
            <Text style={[styles.tabText, activeTab === "unavailable" && styles.activeTabText]}>
              Taken Down ({items.filter((item) => item.status === "unavailable").length})
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              activeTab === "traded" && styles.activeTab,
              pressed && styles.tabPressed,
            ]}
            onPress={() => {
              addDebugLog("Traded tab pressed")
              setActiveTab("traded")
            }}
          >
            <Text style={[styles.tabText, activeTab === "traded" && styles.activeTabText]}>
              Traded ({items.filter((item) => item.status === "traded").length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Debug info panel */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>Debug Log:</Text>
        {debugInfo.map((log, index) => (
          <Text key={index} style={styles.debugText}>
            {log}
          </Text>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemImageContainer}>
                  {item.image_urls && item.image_urls.length > 0 ? (
                    <Image source={{ uri: item.image_urls[0] }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Feather name="image" size={24} color="#94a3b8" />
                    </View>
                  )}
                  {item.image_urls && item.image_urls.length > 1 && (
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
                  <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
                    <Text style={[styles.statusText, { color: getStatusBadgeStyle(item.status).color }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.itemActions}>
                {item.status === "traded" ? (
                  <View style={styles.tradedActions}>
                    <Text style={styles.tradedText}>This item has been traded</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        addDebugLog(`Delete button pressed for traded item ${item.title}`)
                        deleteItem(item.id, item.image_urls)
                      }}
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
                      onPress={() => {
                        addDebugLog(`${item.is_available ? "Take down" : "Repost"} button pressed for ${item.title}`)
                        toggleItemAvailability(item.id, item.is_available)
                      }}
                    >
                      <Text
                        style={[
                          styles.actionButtonText,
                          item.is_available ? styles.takeDownButtonText : styles.repostButtonText,
                        ]}
                      >
                        {item.is_available ? "Take Down" : "Repost"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        addDebugLog(`Delete button pressed for ${item.title}`)
                        deleteItem(item.id, item.image_urls)
                      }}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ))
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
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
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
  tabPressed: {
    opacity: 0.7,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  activeTabText: {
    color: "#3b82f6",
  },
  debugPanel: {
    backgroundColor: "#f1f5f9",
    padding: 10,
    margin: 10,
    borderRadius: 8,
    maxHeight: 120,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  itemImageContainer: {
    position: "relative",
    marginRight: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  imageCount: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 2,
  },
  imageCountText: {
    color: "white",
    fontSize: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 4,
  },
  itemCondition: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: "#64748b",
  },
  statusIndicator: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  itemDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  itemActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tradedActions: {
    flex: 1,
    alignItems: "center",
  },
  tradedText: {
    fontSize: 14,
    color: "#1e40af",
    fontStyle: "italic",
    marginBottom: 12,
    textAlign: "center",
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  takeDownButton: {
    backgroundColor: "#f87171",
  },
  repostButton: {
    backgroundColor: "#6ee7b7",
  },
  deleteButton: {
    backgroundColor: "#f87171",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  takeDownButtonText: {
    color: "#732d2d",
  },
  repostButtonText: {
    color: "#065f46",
  },
  deleteButtonText: {
    color: "#732d2d",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#64748b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
})
