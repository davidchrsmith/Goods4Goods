"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, Dimensions, Animated, Alert, Image, TouchableOpacity, Modal } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Item, Profile } from "../types/database"
import { Button, Slider } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"
import { useLocation } from "../hooks/useLocation"

interface SwipeCardsProps {
  session: Session
}

interface ItemWithProfile extends Item {
  owner_profile?: Profile
  distance?: number
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")
const CARD_WIDTH = screenWidth * 0.9
const CARD_HEIGHT = screenHeight * 0.7

export default function SwipeCards({ session }: SwipeCardsProps) {
  const [items, setItems] = useState<ItemWithProfile[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userItems, setUserItems] = useState<Item[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [maxDistance, setMaxDistance] = useState(50)
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [swipedItemIds, setSwipedItemIds] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>({})

  const { location, loading: locationLoading, requestLocation, updateUserLocation } = useLocation()

  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    loadUserItems()
    loadPotentialMatches()
  }, [maxDistance, locationEnabled])

  useEffect(() => {
    if (location && session) {
      updateUserLocation(session)
      setLocationEnabled(true)
      loadPotentialMatches()
    }
  }, [location])

  async function loadUserItems() {
    try {
      console.log("=== LOADING USER ITEMS ===")
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_available", true)

      if (error) throw error
      setUserItems(data || [])
      console.log("User items loaded:", data?.length || 0)
    } catch (error) {
      console.error("Error loading user items:", error)
    }
  }

  async function loadPotentialMatches() {
    try {
      setLoading(true)
      console.log("=== LOADING POTENTIAL MATCHES ===")
      console.log("Current user ID:", session.user.id)

      const debug: any = {
        currentUserId: session.user.id,
        steps: [],
      }

      // Step 1: Check total items in database
      const { data: allItems, error: allItemsError } = await supabase.from("items").select("*")

      debug.steps.push({
        step: "1. Total items in database",
        count: allItems?.length || 0,
        error: allItemsError,
      })

      // Step 2: Check available items
      const { data: availableItems, error: availableError } = await supabase
        .from("items")
        .select("*")
        .eq("is_available", true)

      debug.steps.push({
        step: "2. Available items",
        count: availableItems?.length || 0,
        error: availableError,
      })

      // Step 3: Check items from other users
      const { data: otherUsersItems, error: otherUsersError } = await supabase
        .from("items")
        .select("*")
        .neq("user_id", session.user.id)
        .eq("is_available", true)

      debug.steps.push({
        step: "3. Items from other users",
        count: otherUsersItems?.length || 0,
        error: otherUsersError,
        sample: otherUsersItems?.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          user_id: item.user_id,
        })),
      })

      // Step 4: Check existing trade requests (both pending and accepted)
      const { data: existingRequests, error: requestsError } = await supabase
        .from("trade_requests")
        .select("target_item_id, status")
        .eq("requester_id", session.user.id)
        .in("status", ["pending", "accepted"]) // Filter out both pending and accepted

      debug.steps.push({
        step: "4. Existing trade requests (pending + accepted)",
        count: existingRequests?.length || 0,
        error: requestsError,
        requestedItemIds: existingRequests?.map((req) => req.target_item_id),
        statuses: existingRequests?.map((req) => req.status),
      })

      // Step 4.5: Check which specific items are involved in accepted trades (both as requester and target)
      const userItemIds = userItems.map((item) => item.id)
      const { data: acceptedTrades, error: acceptedTradesError } = await supabase
        .from("trade_requests")
        .select("requester_item_id, target_item_id")
        .or(`requester_item_id.in.(${userItemIds.join(",")}),target_item_id.in.(${userItemIds.join(",")})`)
        .eq("status", "accepted")

      debug.steps.push({
        step: "4.5. Items involved in accepted trades",
        count: acceptedTrades?.length || 0,
        error: acceptedTradesError,
        trades: acceptedTrades,
      })

      // Get all item IDs that are involved in accepted trades
      const acceptedTradeItemIds = new Set()
      acceptedTrades?.forEach((trade) => {
        acceptedTradeItemIds.add(trade.requester_item_id)
        acceptedTradeItemIds.add(trade.target_item_id)
      })

      // Step 5: Apply filtering (updated to only filter specific items, not all items from trading users)
      const requestedItemIds = new Set(existingRequests?.map((req) => req.target_item_id) || [])
      const filteredItems =
        otherUsersItems?.filter((item) => {
          const isSwipedItem = swipedItemIds.has(item.id)
          const isRequestedItem = requestedItemIds.has(item.id)
          const isInAcceptedTrade = acceptedTradeItemIds.has(item.id)
          return !isSwipedItem && !isRequestedItem && !isInAcceptedTrade
        }) || []

      debug.steps.push({
        step: "5. After filtering (updated - specific items only)",
        count: filteredItems.length,
        swipedItemsCount: swipedItemIds.size,
        requestedItemsCount: requestedItemIds.size,
        acceptedTradeItemsCount: acceptedTradeItemIds.size,
        acceptedTradeItems: Array.from(acceptedTradeItemIds),
      })

      // Step 6: Get profiles
      if (filteredItems.length > 0) {
        const userIds = [...new Set(filteredItems.map((item) => item.user_id))]
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").in("id", userIds)

        debug.steps.push({
          step: "6. Profiles loaded",
          userIds: userIds,
          profilesCount: profiles?.length || 0,
          error: profilesError,
        })

        // Combine items with profiles
        const itemsWithProfiles: ItemWithProfile[] = filteredItems.map((item) => {
          const ownerProfile = profiles?.find((profile) => profile.id === item.user_id)
          return {
            ...item,
            owner_profile: ownerProfile || {
              id: item.user_id,
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
          }
        })

        setItems(itemsWithProfiles)
      } else {
        setItems([])
      }

      setDebugInfo(debug)
      console.log("=== DEBUG INFO ===", debug)
    } catch (error) {
      console.error("Error loading matches:", error)
      Alert.alert("Error", "Failed to load potential matches")
    } finally {
      setLoading(false)
    }
  }

  const handleEnableLocation = async () => {
    await requestLocation()
  }

  const handleSwipe = (direction: "left" | "right") => {
    if (currentIndex >= items.length) return

    const currentItem = items[currentIndex]

    // Add item to swiped items set immediately
    setSwipedItemIds((prev) => new Set(prev).add(currentItem.id))

    if (direction === "right") {
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

      // If we just sent a trade request, reload the potential matches
      // to update the filtering logic
      if (direction === "right") {
        loadPotentialMatches()
      }
    })
  }

  async function sendTradeRequest(targetItem: ItemWithProfile) {
    try {
      if (userItems.length === 0) {
        Alert.alert("No Items", "You need to add items before making trade requests")
        return
      }

      const userItem = userItems[0]

      console.log("=== SENDING TRADE REQUEST ===")
      console.log("User item:", userItem.title)
      console.log("Target item:", targetItem.title)
      console.log("Target user:", targetItem.user_id)

      // Add debugging alert
      alert(`Sending trade request: ${userItem.title} for ${targetItem.title}`)

      const tradeRequest = {
        requester_id: session.user.id,
        requester_item_id: userItem.id,
        target_user_id: targetItem.user_id,
        target_item_id: targetItem.id,
        status: "pending" as const,
      }

      const { data, error } = await supabase.from("trade_requests").insert([tradeRequest]).select()

      if (error) {
        console.error("Trade request error:", error)
        alert(`Trade request error: ${error.message}`)

        // Check if it's a duplicate request
        if (error.code === "23505") {
          Alert.alert("Already Requested", "You've already sent a trade request for this item")
        } else {
          throw error
        }
        return
      }

      console.log("Trade request sent successfully:", data)
      alert(`Trade request sent successfully! Request ID: ${data[0]?.id}`)
      Alert.alert("Trade Request Sent!", `You've requested to trade your ${userItem.title} for ${targetItem.title}`)

      // Remove the item from the current items list since we now have a trade request for it
      setItems((prevItems) => prevItems.filter((item) => item.id !== targetItem.id))
    } catch (error) {
      console.error("Error sending trade request:", error)
      alert(`Exception sending trade request: ${error.message}`)
      Alert.alert("Error", "Failed to send trade request")
    }
  }

  async function resetTradeRequests() {
    try {
      Alert.alert(
        "Reset Trade Requests",
        "This will delete all your outgoing trade requests so you can see items again. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: async () => {
              const { error } = await supabase.from("trade_requests").delete().eq("requester_id", session.user.id)

              if (error) {
                console.error("Error resetting trade requests:", error)
                Alert.alert("Error", "Failed to reset trade requests")
                return
              }

              Alert.alert("Success", "Trade requests reset! Refreshing items...")
              setCurrentIndex(0)
              setSwipedItemIds(new Set())
              loadPotentialMatches()
            },
          },
        ],
      )
    } catch (error) {
      console.error("Error resetting trade requests:", error)
      Alert.alert("Error", "Failed to reset trade requests")
    }
  }

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return "< 1 mile away"
    } else if (distance < 10) {
      return `${distance.toFixed(1)} miles away`
    } else {
      return `${Math.round(distance)} miles away`
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
        <Text style={styles.emptySubtitle}>
          {items.length === 0
            ? "No items available for trading right now. Check back later!"
            : "You've seen all available items. Check back later for new items to trade!"}
        </Text>
        <Button
          title="Refresh"
          onPress={() => {
            setCurrentIndex(0)
            setSwipedItemIds(new Set()) // Clear swiped items when refreshing
            loadPotentialMatches()
          }}
          buttonStyle={styles.refreshButton}
        />

        {/* Enhanced Debug info */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Debug Info:</Text>
          <Text style={styles.debugText}>Current User: {session.user.id.substring(0, 8)}...</Text>
          <Text style={styles.debugText}>Items Found: {items.length}</Text>
          <Text style={styles.debugText}>User Items: {userItems.length}</Text>
          <Text style={styles.debugText}>Swiped Items: {swipedItemIds.size}</Text>
          <Text style={styles.debugText}>Current Index: {currentIndex}</Text>

          {debugInfo.steps && (
            <View style={styles.debugSteps}>
              <Text style={styles.debugText}>Detailed Steps:</Text>
              {debugInfo.steps.map((step: any, index: number) => (
                <View key={index} style={styles.debugStep}>
                  <Text style={styles.debugStepText}>
                    {step.step}: {step.count || 0}
                  </Text>
                  {step.error && <Text style={styles.debugErrorText}>Error: {step.error.message}</Text>}
                  {step.sample && <Text style={styles.debugText}>Sample: {JSON.stringify(step.sample, null, 2)}</Text>}
                </View>
              ))}
            </View>
          )}

          <Button
            title="Reset Swiped Items"
            onPress={() => {
              setSwipedItemIds(new Set())
              setCurrentIndex(0)
              loadPotentialMatches()
            }}
            buttonStyle={[styles.refreshButton, { marginTop: 10 }]}
          />

          <Button
            title="Show Debug Details"
            onPress={() => {
              Alert.alert("Debug Info", JSON.stringify(debugInfo, null, 2))
            }}
            buttonStyle={[styles.refreshButton, { marginTop: 10, backgroundColor: "#f59e0b" }]}
          />
          <Button
            title="Reset Trade Requests"
            onPress={resetTradeRequests}
            buttonStyle={[styles.refreshButton, { marginTop: 10, backgroundColor: "#ef4444" }]}
          />
        </View>
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
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterButton}>
          <Feather name="filter" size={24} color="#3b82f6" />
        </TouchableOpacity>
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
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>By {currentItem.owner_profile?.full_name || "Anonymous"}</Text>
              {currentItem.distance !== undefined && (
                <Text style={styles.distanceText}>{formatDistance(currentItem.distance)}</Text>
              )}
            </View>
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

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Feather name="x" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Location</Text>
              {!locationEnabled ? (
                <View style={styles.locationPrompt}>
                  <Text style={styles.locationPromptText}>Enable location to find items near you</Text>
                  <Button
                    title={locationLoading ? "Getting Location..." : "Enable Location"}
                    onPress={handleEnableLocation}
                    disabled={locationLoading}
                    buttonStyle={styles.enableLocationButton}
                  />
                </View>
              ) : (
                <View style={styles.distanceFilter}>
                  <Text style={styles.distanceLabel}>Maximum Distance: {maxDistance} miles</Text>
                  <Slider
                    value={maxDistance}
                    onValueChange={setMaxDistance}
                    minimumValue={1}
                    maximumValue={100}
                    step={1}
                    thumbStyle={styles.sliderThumb}
                    trackStyle={styles.sliderTrack}
                    minimumTrackTintColor="#3b82f6"
                  />
                  <View style={styles.distanceLabels}>
                    <Text style={styles.distanceLabelText}>1 mile</Text>
                    <Text style={styles.distanceLabelText}>100 miles</Text>
                  </View>
                </View>
              )}
            </View>

            <Button
              title="Apply Filters"
              onPress={() => {
                setShowFilters(false)
                setCurrentIndex(0)
                loadPotentialMatches()
              }}
              buttonStyle={styles.applyButton}
            />
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
    marginBottom: 10,
  },
  debugInfo: {
    backgroundColor: "#f1f5f9",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    maxHeight: 400,
  },
  debugText: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  debugSteps: {
    marginTop: 10,
    width: "100%",
  },
  debugStep: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  debugStepText: {
    fontSize: 11,
    color: "#1e293b",
    fontWeight: "600",
  },
  debugErrorText: {
    fontSize: 10,
    color: "#ef4444",
    marginTop: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  filterButton: {
    padding: 8,
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
  ownerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ownerName: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  distanceText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 16,
  },
  locationPrompt: {
    alignItems: "center",
    paddingVertical: 20,
  },
  locationPromptText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  enableLocationButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingHorizontal: 24,
  },
  distanceFilter: {
    paddingVertical: 10,
  },
  distanceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 20,
    textAlign: "center",
  },
  sliderThumb: {
    backgroundColor: "#3b82f6",
    width: 20,
    height: 20,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  distanceLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  distanceLabelText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  applyButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
  },
})
