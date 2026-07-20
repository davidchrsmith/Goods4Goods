import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from "react-native"
import { searchUsers } from "../api/auth"
import { sendFriendRequest } from "../api/friends"
import { ApiError } from "../api/client"
import type { Profile } from "../api/types"
import { Button, Avatar } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"

interface FriendSearchProps {
  profile: Profile
  onBack: () => void
}

export default function FriendSearch({ profile, onBack }: FriendSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<Set<string>>(new Set())

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const data = await searchUsers(searchQuery)
      setResults(data)
    } catch {
      Alert.alert("Error", "Failed to search users")
    } finally {
      setLoading(false)
    }
  }

  const handleSendRequest = async (addresseeId: string) => {
    setSending((prev) => new Set(prev).add(addresseeId))
    try {
      await sendFriendRequest(addresseeId)
      Alert.alert("Friend Request Sent!", "Your friend request has been sent successfully")
      setResults((prev) => prev.filter((u) => u.id !== addresseeId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("Already Connected", "You already have a connection with this user")
      } else {
        Alert.alert("Error", "Failed to send friend request")
      }
    } finally {
      setSending((prev) => {
        const next = new Set(prev)
        next.delete(addresseeId)
        return next
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
            onSubmitEditing={handleSearch}
          />
        </View>
        <Button
          title="Search"
          onPress={handleSearch}
          disabled={loading || !searchQuery.trim()}
          buttonStyle={styles.searchButton}
        />
      </View>

      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : results.length > 0 ? (
          results.map((user) => (
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
                title={sending.has(user.id) ? "Sending..." : "Add Friend"}
                onPress={() => handleSendRequest(user.id)}
                disabled={sending.has(user.id)}
                buttonStyle={styles.addButton}
                size="sm"
              />
            </View>
          ))
        ) : searchQuery.trim() && !loading ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No users found for "{searchQuery}"</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backButton: { marginRight: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e293b" },
  searchContainer: { flexDirection: "row", padding: 16, gap: 12 },
  searchInputContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: "#1e293b" },
  searchButton: { backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 20 },
  resultsContainer: { flex: 1, padding: 16 },
  loadingContainer: { alignItems: "center", paddingVertical: 20 },
  loadingText: { fontSize: 16, color: "#64748b" },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  userAvatar: { marginRight: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  userUsername: { fontSize: 13, color: "#64748b" },
  addButton: { backgroundColor: "#3b82f6", borderRadius: 8 },
  noResults: { alignItems: "center", paddingVertical: 20 },
  noResultsText: { fontSize: 14, color: "#64748b" },
})
