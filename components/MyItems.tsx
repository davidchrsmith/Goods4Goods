"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Item } from "../types/database"
import { Button } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"

interface MyItemsProps {
  session: Session
}

export default function MyItems({ session }: MyItemsProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"available" | "unavailable">("available")

  useEffect(() => {
    loadMyItems()
  }, [])

  async function loadMyItems() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      console.error("Error loading items:", error)
      Alert.alert("Error", "Failed to load your items")
    } finally {
      setLoading(false)
    }
  }

  async function toggleItemAvailability(itemId: string, currentAvailability: boolean) {
    try {
      const action = currentAvailability ? "take down" : "repost"

      Alert.alert(
        `${currentAvailability ? "Take Down" : "Repost"} Item`,
        `Are you sure you want to ${action} this item?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: currentAvailability ? "Take Down" : "Repost",
            style: currentAvailability ? "destructive" : "default",
            onPress: async () => {
              const { error } = await supabase
                .from("items")
                .update({
                  is_available: !currentAvailability,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", itemId)

              if (error) {
                Alert.alert("Error", `Failed to ${action} item`)
                return
              }

              Alert.alert("Success", `Item ${currentAvailability ? "taken down" : "reposted"} successfully!`)
              loadMyItems()
            },
          },
        ],
      )
    } catch (error) {
      console.error("Error updating item:", error)
      Alert.alert("Error", "Failed to update item")
    }
  }

  async function deleteItem(itemId: string, imageUrls: string[]) {
    Alert.alert("Delete Item", "Are you sure you want to permanently delete this item? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            // Delete images from storage first
            if (imageUrls && imageUrls.length > 0) {
              const filePaths = imageUrls
                .map((url) => {
                  const urlParts = url.split("/item-images/")
                  return urlParts.length > 1 ? urlParts[1] : null
                })
                .filter(Boolean)

              if (filePaths.length > 0) {
                await supabase.storage.from("item-images").remove(filePaths)
              }
            }

            // Delete item from database
            const { error } = await supabase.from("items").delete().eq("id", itemId)

            if (error) throw error

            Alert.alert("Success", "Item deleted successfully!")
            loadMyItems()
          } catch (error) {
            console.error("Error deleting item:", error)
            Alert.alert("Error", "Failed to delete item")
          }
        },
      },
    ])
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
            onPress={() => setActiveTab("available")}
          >
            <Text style={[styles.tabText, activeTab === "available" && styles.activeTabText]}>
              Available ({items.filter((item) => item.is_available).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "unavailable" && styles.activeTab]}
            onPress={() => setActiveTab("unavailable")}
          >
            <Text style={[styles.tabText, activeTab === "unavailable" && styles.activeTabText]}>
              Taken Down ({items.filter((item) => !item.is_available).length})
            </Text>
          </TouchableOpacity>
        </View>
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
                <Button
                  title={item.is_available ? "Take Down" : "Repost"}
                  onPress={() => toggleItemAvailability(item.id, item.is_available)}
                  buttonStyle={[styles.actionButton, item.is_available ? styles.takeDownButton : styles.repostButton]}
                  titleStyle={[
                    styles.actionButtonText,
                    item.is_available ? styles.takeDownButtonText : styles.repostButtonText,
                  ]}
                />

                <Button
                  title="Delete"
                  onPress={() => deleteItem(item.id, item.image_urls)}
                  buttonStyle={[styles.actionButton, styles.deleteButton]}
                  titleStyle={styles.deleteButtonText}
                />
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
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  imageCount: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  imageCountText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  itemInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 2,
  },
  itemCondition: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statusIndicator: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  availableBadge: {
    backgroundColor: "#d1fae5",
  },
  unavailableBadge: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  availableText: {
    color: "#065f46",
  },
  unavailableText: {
    color: "#991b1b",
  },
  itemDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 16,
  },
  itemActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  takeDownButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  repostButton: {
    backgroundColor: "#22c55e",
  },
  deleteButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  takeDownButtonText: {
    color: "#f59e0b",
  },
  repostButtonText: {
    color: "white",
  },
  deleteButtonText: {
    color: "#ef4444",
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 20,
  },
})
