import { useState, useEffect } from "react"
import {
  Alert, StyleSheet, View, Text, ScrollView,
  TouchableOpacity, TextInput,
} from "react-native"
import { getMyProfile, updateProfile, logout } from "../api/auth"
import { uploadImage } from "../api/items"
import { ApiError } from "../api/client"
import { Button, Avatar } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"
import type { Profile } from "../api/types"

interface ProfileProps {
  profile: Profile
  onProfileComplete: () => void
  onLogout?: () => void
}

export default function ProfileComponent({ profile, onProfileComplete, onLogout }: ProfileProps) {
  const [showSettings, setShowSettings] = useState(false)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString()

  if (!profile.full_name || !profile.username) {
    return (
      <ProfileSettings
        profile={profile}
        onBack={() => {}}
        onProfileUpdated={onProfileComplete}
        isFirstTime
      />
    )
  }

  if (showSettings) {
    return (
      <ProfileSettings
        profile={profile}
        onBack={() => setShowSettings(false)}
        onProfileUpdated={() => {
          onProfileComplete()
          setShowSettings(false)
        }}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileImageContainer}>
          <Avatar
            size={120}
            rounded
            source={profile.avatar_url ? { uri: profile.avatar_url } : undefined}
            icon={!profile.avatar_url ? { name: "user", type: "feather", size: 60 } : undefined}
            containerStyle={styles.profileAvatar}
          />
        </View>
        <Text style={styles.profileName}>{profile.full_name}</Text>
        <Text style={styles.profileUsername}>@{profile.username}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Items Posted</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Trades Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoItem}>
            <Feather name="calendar" size={20} color="#64748b" />
            <Text style={styles.infoText}>Joined {formatDate(profile.created_at)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="at-sign" size={20} color="#64748b" />
            <Text style={styles.infoText}>@{profile.username}</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="mail" size={20} color="#64748b" />
            <Text style={styles.infoText}>{profile.email}</Text>
          </View>
          {profile.phone && (
            <View style={styles.infoItem}>
              <Feather name="phone" size={20} color="#64748b" />
              <Text style={styles.infoText}>{profile.phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsSection}>
          <Button
            title="Edit Profile"
            onPress={() => setShowSettings(true)}
            buttonStyle={styles.editButton}
            titleStyle={styles.editButtonText}
            icon={<Feather name="edit-2" size={20} color="#3b82f6" style={{ marginRight: 8 }} />}
          />
          <Button
            title="Sign Out"
            onPress={async () => {
              await logout()
              onLogout?.()
            }}
            buttonStyle={styles.signOutButton}
            titleStyle={styles.signOutButtonText}
            icon={<Feather name="log-out" size={20} color="#ef4444" style={{ marginRight: 8 }} />}
          />
        </View>
      </View>
    </ScrollView>
  )
}

function ProfileSettings({
  profile,
  onBack,
  onProfileUpdated,
  isFirstTime = false,
}: {
  profile: Profile | null
  onBack: () => void
  onProfileUpdated: () => void
  isFirstTime?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [username, setUsername] = useState(profile?.username || "")
  const [phone, setPhone] = useState(profile?.phone || "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [usernameError, setUsernameError] = useState("")

  const validateUsername = (text: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, "")
    setUsername(clean)
    if (clean.length > 0 && clean.length < 3) {
      setUsernameError("Username must be at least 3 characters")
    } else if (clean.length > 20) {
      setUsernameError("Username must be 20 characters or fewer")
    } else {
      setUsernameError("")
    }
  }

  const pickAndUploadAvatar = async () => {
    try {
      const ImagePicker = await import("expo-image-picker")
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
      if (result.canceled || !result.assets[0]) return

      setUploading(true)
      const url = await uploadImage(result.assets[0].uri)
      setAvatarUrl(url)
    } catch (err) {
      Alert.alert("Upload Error", "Failed to upload profile picture. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    if (!fullName.trim()) {
      Alert.alert("Error", "Full name is required")
      return
    }
    if (!username.trim()) {
      Alert.alert("Error", "Username is required")
      return
    }
    if (usernameError) {
      Alert.alert("Error", usernameError)
      return
    }

    setLoading(true)
    try {
      await updateProfile({
        full_name: fullName.trim(),
        username: username.trim(),
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
      })
      Alert.alert("Success", "Profile updated successfully!")
      onProfileUpdated()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update profile"
      Alert.alert("Error", message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.settingsHeader}>
        {!isFirstTime && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#1e293b" />
          </TouchableOpacity>
        )}
        <Text style={styles.settingsTitle}>
          {isFirstTime ? "Complete Your Profile" : "Edit Profile"}
        </Text>
        {isFirstTime && (
          <Text style={styles.settingsSubtitle}>Tell us a bit about yourself</Text>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.avatarSection}>
          <Text style={styles.sectionLabel}>Profile Picture</Text>
          <TouchableOpacity
            onPress={pickAndUploadAvatar}
            disabled={uploading}
            style={styles.avatarUploadContainer}
          >
            <Avatar
              size={100}
              rounded
              source={avatarUrl ? { uri: avatarUrl } : undefined}
              icon={!avatarUrl ? { name: "user", type: "feather", size: 40 } : undefined}
              containerStyle={styles.avatarUpload}
            />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Feather name="camera" size={16} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change profile picture</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Full Name *</Text>
          <View style={styles.inputContainer}>
            <Feather name="user" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Username *</Text>
          <View style={[styles.inputContainer, usernameError ? styles.errorInput : null]}>
            <Feather name="at-sign" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={username}
              onChangeText={validateUsername}
              placeholder="Choose a unique username"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              maxLength={20}
            />
          </View>
          {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
          <Text style={styles.inputHint}>
            Letters, numbers, and underscores only. 3-20 characters.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <Feather name="phone" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <Button
          title={loading ? "Saving..." : isFirstTime ? "Complete Profile" : "Save Changes"}
          disabled={loading || uploading}
          onPress={saveProfile}
          buttonStyle={styles.saveButton}
          titleStyle={styles.saveButtonText}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#64748b" },
  header: { alignItems: "center", paddingTop: 60, paddingBottom: 24, backgroundColor: "white" },
  profileImageContainer: { marginBottom: 16 },
  profileAvatar: { borderWidth: 3, borderColor: "#e2e8f0" },
  profileName: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  profileUsername: { fontSize: 16, color: "#64748b" },
  content: { padding: 20 },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },
  statDivider: { width: 1, backgroundColor: "#e2e8f0" },
  infoSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1e293b", marginBottom: 16 },
  infoItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  infoText: { fontSize: 14, color: "#374151", marginLeft: 12 },
  actionsSection: { gap: 12 },
  editButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
  },
  editButtonText: { color: "#3b82f6", fontWeight: "600" },
  signOutButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
  },
  signOutButtonText: { color: "#ef4444", fontWeight: "600" },
  settingsHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
  backButton: { marginBottom: 16 },
  settingsTitle: { fontSize: 28, fontWeight: "bold", color: "#1e293b" },
  settingsSubtitle: { fontSize: 16, color: "#64748b", marginTop: 4 },
  form: { padding: 20 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 12 },
  avatarUploadContainer: { position: "relative" },
  avatarUpload: { borderWidth: 3, borderColor: "#e2e8f0" },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: { color: "white", fontSize: 12 },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3b82f6",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarHint: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
  inputSection: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  errorInput: { borderColor: "#ef4444" },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#1e293b" },
  inputHint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  saveButton: { backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, marginTop: 16 },
  saveButtonText: { fontSize: 16, fontWeight: "600" },
})
