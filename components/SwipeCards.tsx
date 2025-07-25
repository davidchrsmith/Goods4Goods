"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, Dimensions, Animated, Alert, Image, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Item, Profile } from "../types/database"
import { Button } from "@rneui/themed"

interface SwipeCardsProps {
  session: Session
}

interface ItemWithProfile extends Item {
  profiles: Profile
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")
const CARD_WIDTH = screenWidth * 0.9
const CARD_HEIGHT = screenHeight * 0.7

export default function SwipeCards({ session }: SwipeCardsProps) {
  const [items, setItems] = useState<ItemWithProfile[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userItems, setUserItems] = useState<Item[]>([])

  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    loadUserItems()
    loadPotentialMatches()
  }, [])

  async function loadUserItems() {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_available", true)

      if (error) throw error
      setUserItems(data || [])
    } catch (error) {
      console.error("Error loading user items:", error)
    }
  }

  async function loadPotentialMatches() {
    try {
      setLoading(true)

      // TODO: Implement intelligent matching algorithm
      // The matching logic should:
      // 1. Get user's available items and their estimated values
      // 2. Find items from other users within value tolerance (e.g., ±20%)
      // 3. Exclude items user has already swiped on
      // 4. Consider user preferences, location, item categories
      // 5. Use ML to improve matching over time based on user behavior

      const { data, error } = await supabase
        .from("items")
        .select(`
          *,
          profiles (*)
        `)
        .neq("user_id", session.user.id)
        .eq("is_available", true)
        .limit(20)

      if (error) throw error

      // Simple value-based filtering for now
      // TODO: Replace with sophisticated matching algorithm
      const filteredItems = (data || []).filter((item) => {
        if (userItems.length === 0) return true

        // Check if item value is within range of any user item
        return userItems.some((userItem) => {
          const valueDiff = Math.abs(item.estimated_value - userItem.estimated_value)
          const tolerance = Math.max(userItem.estimated_value * 0.3, 10) // 30% tolerance or $10 minimum
          return valueDiff <= tolerance
        })
      })

      setItems(filteredItems)
    } catch (error) {
      console.error("Error loading matches:", error)
      Alert.alert("Error", "Failed to load potential matches")
    } finally {
      setLoading(false)
    }
  }

  const handleSwipe = (direction: "left" | "right") => {
    if (currentIndex >= items.length) return

    const currentItem = items[currentIndex]

    if (direction === "right") {
      // Send trade request
      sendTradeRequest(currentItem)
    }

    // Animate card out
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: direction === "right" ? screenWidth : -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: direction === "right" ? 1 : -1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset animations and move to next card
      translateX.setValue(0)
      translateY.setValue(0)
      rotate.setValue(0)
      setCurrentIndex(currentIndex + 1)
    })
  }

  async function sendTradeRequest(targetItem: ItemWithProfile) {
    try {
      if (userItems.length === 0) {
        Alert.alert("No Items", "You need to add items before making trade requests")
        return
      }

      // For now, use the first available item
      // TODO: Let user select which item to offer in trade
      const userItem = userItems[0]

      const tradeRequest = {
        requester_id: session.user.id,
        requester_item_id: userItem.id,
        target_user_id: targetItem.user_id,
        target_item_id: targetItem.id,
        status: "pending" as const,
      }

      const { error } = await supabase.from("trade_requests").insert([tradeRequest])

      if (error) throw error

      Alert.alert("Trade Request Sent!", `You've requested to trade your ${userItem.title} for ${targetItem.title}`)
    } catch (error) {
      console.error("Error sending trade request:", error)
      Alert.alert("Error", "Failed to send trade request")
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding potential matches...</Text>
      </View>
    )
  }

  if (currentIndex >= items.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No More Items</Text>
        <Text style={styles.emptySubtitle}>Check back later for new items to trade!</Text>
        <Button
          title="Refresh"
          onPress={() => {
            setCurrentIndex(0)
            loadPotentialMatches()
          }}
          buttonStyle={styles.refreshButton}
        />
      </View>
    )
  }

  const currentItem = items[currentIndex]
  const rotateInterpolate = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-10deg", "0deg", "10deg"],
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover Items</Text>
        <Text style={styles.subtitle}>Swipe right to request a trade</Text>
      </View>

      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX }, { translateY }, { rotate: rotateInterpolate }],
            },
          ]}
        >
          <View style={styles.imageContainer}>
            {currentItem.image_urls && currentItem.image_urls.length > 0 ? (
              <Image source={{ uri: currentItem.image_urls[0] }} style={styles.itemImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.itemTitle}>{currentItem.title}</Text>
            <Text style={styles.itemValue}>${currentItem.estimated_value}</Text>
            <Text style={styles.itemCondition}>{currentItem.condition}</Text>
            <Text style={styles.itemDescription} numberOfLines={3}>
              {currentItem.description}
            </Text>
            <Text style={styles.ownerName}>By {currentItem.profiles?.full_name || "Anonymous"}</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.passButton]} onPress={() => handleSwipe("left")}>
          <Text style={styles.passButtonText}>Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.tradeButton]} onPress={() => handleSwipe("right")}>
          <Text style={styles.tradeButtonText}>Trade</Text>
        </TouchableOpacity>
      </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "white",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  imageContainer: {
    height: "60%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#94a3b8",
    fontSize: 16,
  },
  cardContent: {
    padding: 20,
    height: "40%",
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 4,
  },
  itemCondition: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 8,
  },
  ownerName: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  passButton: {
    backgroundColor: "#ef4444",
  },
  tradeButton: {
    backgroundColor: "#22c55e",
  },
  passButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  tradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})
