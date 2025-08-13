"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Pressable } from "react-native"
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
  const [activeTab, setActiveTab] = useState<"available" | "unavailable">("available")
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

      addDebugLog(`Action: ${action}, New availability: ${newAvailability}`)

      // For web testing, let's skip the confirmation dialog initially
      try {
        addDebugLog("Proceeding with Supabase update...")

        const { data, error } = await supabase
          .from("items")
          .update({
            is_available: newAvailability,
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

        addDebugLog(`Item ${action} successful!`)
        Alert.alert("Success", `Item ${action} successful!`)

        // Update local state
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemId
              ? { ...item, is_available: newAvailability, updated_at: new Date().toISOString() }
              : item,
          ),
        )

        // Reload items
        loadMyItems()
      } catch (error) {
        addDebugLog(`Unexpected error: ${error.message}`)
        Alert.alert("Error", `Unexpected error: ${error.message}`)
      }
    } catch (error) {
      addDebugLog(`Function error: ${error.message}`)
      Alert.alert("Error", `Function error: ${error.message}`)
    }
  }

  async function deleteItem(itemId: string, imageUrls: string[]) {
    addDebugLog(`deleteItem called for item ${itemId.substring(0, 8)}`)

    // For web testing, let's skip the confirmation dialog initially
    try {
      addDebugLog("Proceeding with deletion...")

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

      addDebugLog("Item deleted successfully!")
      Alert.alert("Success", "Item deleted successfully!")

      // Update local state
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId))

      // Reload items
      loadMyItems()
    } catch (error) {
      addDebugLog(`Delete error: ${error.message}`)
      Alert.alert("Error", `Unexpected error: ${error.message}`)
    }
  }

  const filteredItems = items.filter((item) => (activeTab === "available" ? item.is_available : !item.is_available))

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
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
          <TouchableOpacity
            style={[styles.tab, activeTab === "available" && styles.activeTab]}
            onPress={() => {
              addDebugLog("Available tab pressed")
              setActiveTab("available")
            }}
          >
            <Text style={[styles.tabText, activeTab === "available" && styles.activeTabText]}>
              Available ({items.filter((item) => item.is_available).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "unavailable" && styles.activeTab]}
            onPress={() => {
              addDebugLog("Unavailable tab pressed")
              setActiveTab("unavailable")
            }}
          >
            <Text style={[styles.tabText, activeTab === "unavailable" && styles.activeTabText]}>
              Taken Down ({items.filter((item) => !item.is_available).length})
            </Text>
          </TouchableOpacity>
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
                  <View
                    style={[styles.statusBadge, item.is_available ? styles.availableBadge : styles.unavailableBadge]}
                  >
                    <Text
                      style={[styles.statusText, item.is_available ? styles.availableText : styles.unavailableText]}
                    >
                      {item.is_available ? "Available" : "Taken Down"}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.itemActions}>
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
                  style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.buttonPressed]}
                  onPress={() => {
                    addDebugLog(`Delete button pressed for ${item.title}`)
                    deleteItem(item.id, item.image_urls)
                  }}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>
              {activeTab === "available" ? "No Available Items" : "No Taken Down Items"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "available"
                ? "Start by adding your first item to trade!"
                : "Items you take down will appear here."}
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
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
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
  availableBadge: {
    backgroundColor: "#6ee7b7",
  },
  unavailableBadge: {
    backgroundColor: "#f87171",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  availableText: {
    color: "#065f46",
  },
  unavailableText: {
    color: "#732d2d",
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
