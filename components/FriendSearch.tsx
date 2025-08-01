"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Profile } from "../types/database"
import { Button, Avatar } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"

interface FriendSearchProps {
  session: Session
  onBack: () => void
}

export default function FriendSearch({ session, onBack }: FriendSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set())

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${searchQuery.trim()}%`)
        .neq("id", session.user.id)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error) {
      console.error("Error searching users:", error)
      Alert.alert("Error", "Failed to search users")
    } finally {
      setLoading(false)
    }
  }

  const sendFriendRequest = async (addresseeId: string) => {
    try {
      setSendingRequests((prev) => new Set(prev).add(addresseeId))

      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${session.user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${session.user.id})`,
        )
        .single()

      if (existingFriendship) {
        Alert.alert("Already Connected", "You already have a connection with this user")
        return
      }

      const { error } = await supabase.from("friendships").insert([
        {
          requester_id: session.user.id,
          addressee_id: addresseeId,
          status: "pending",
        },
      ])

      if (error) throw error

      Alert.alert("Friend Request Sent!", "Your friend request has been sent successfully")

      // Remove from search results
      setSearchResults((prev) => prev.filter((user) => user.id !== addresseeId))
    } catch (error) {
      console.error("Error sending friend request:", error)
      Alert.alert("Error", "Failed to send friend request")
    } finally {
      setSendingRequests((prev) => {
        const newSet = new Set(prev)
        newSet.delete(addresseeId)
        return newSet
      })
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Find Friends</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by username..."
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            onSubmitEditing={searchUsers}
          />
        </View>

        <Button
          title="Search"
          onPress={searchUsers}
          disabled={loading || !searchQuery.trim()}
          buttonStyle={styles.searchButton}
          titleStyle={styles.searchButtonText}
        />
      </View>

      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          searchResults.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <Avatar
                size={50}
                rounded
                source={user.avatar_url ? { uri: user.avatar_url } : undefined}
                icon={!user.avatar_url ? { name: "user", type: "feather" } : undefined}
                containerStyle={styles.userAvatar}
              />

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.userUsername}>@{user.username}</Text>
              </View>

              <Button
                title={sendingRequests.has(user.id) ? "Sending..." : "Add Friend"}
                onPress={() => sendFriendRequest(user.id)}
                disabled={sendingRequests.has(user.id)}
                buttonStyle={styles.addButton}
                titleStyle={styles.addButtonText}
              />
            </View>
          ))
        ) : searchQuery.trim() && !loading ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptySubtitle}>Try searching with a different username</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Search for Friends</Text>
            <Text style={styles.emptySubtitle}>Enter a username to find other users</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
  },
  searchContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    backgroundColor: "white",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userAvatar: {
    backgroundColor: "#e2e8f0",
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: "#64748b",
  },
  addButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
  },
})
