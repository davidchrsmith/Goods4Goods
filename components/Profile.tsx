"use client"

import { useState, useEffect } from "react"
import { Alert, StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native"
import { supabase } from "../lib/supabase"
import { Button, Avatar } from "@rneui/themed"
import type { Session } from "@supabase/supabase-js"
import type { Profile } from "../types/database"
import { Feather } from "@expo/vector-icons"

interface ProfileProps {
  session: Session
  onProfileComplete: () => void
}

export default function ProfileComponent({ session, onProfileComplete }: ProfileProps) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (session) getProfile()
  }, [session])

  async function getProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error("No user on the session!")

      const { data, error, status } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setProfile(data)
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    )
  }

  // Show profile setup if profile is incomplete
  if (!profile || !profile.full_name) {
    return <ProfileSetup session={session} onProfileComplete={onProfileComplete} />
  }

  // Show settings if requested
  if (showSettings) {
    return (
      <ProfileSettings
        session={session}
        profile={profile}
        onBack={() => setShowSettings(false)}
        onProfileUpdated={() => {
          getProfile()
          setShowSettings(false)
        }}
      />
    )
  }

  // Main profile view
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
        <Text style={styles.profileEmail}>{session.user.email}</Text>
        {profile.phone && <Text style={styles.profilePhone}>{profile.phone}</Text>}
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
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoItem}>
            <Feather name="calendar" size={20} color="#64748b" />
            <Text style={styles.infoText}>Joined {formatDate(profile.created_at)}</Text>
          </View>

          <View style={styles.infoItem}>
            <Feather name="mail" size={20} color="#64748b" />
            <Text style={styles.infoText}>{session.user.email}</Text>
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
            onPress={() => supabase.auth.signOut()}
            buttonStyle={styles.signOutButton}
            titleStyle={styles.signOutButtonText}
            icon={<Feather name="log-out" size={20} color="#ef4444" style={{ marginRight: 8 }} />}
          />
        </View>
      </View>
    </ScrollView>
  )
}

// Profile Setup Component (for first-time users)
function ProfileSetup({ session, onProfileComplete }: { session: Session; onProfileComplete: () => void }) {
  return (
    <ProfileSettings
      session={session}
      profile={null}
      onBack={() => {}}
      onProfileUpdated={onProfileComplete}
      isFirstTime={true}
    />
  )
}

// Profile Settings Component
function ProfileSettings({
  session,
  profile,
  onBack,
  onProfileUpdated,
  isFirstTime = false,
}: {
  session: Session
  profile: Profile | null
  onBack: () => void
  onProfileUpdated: () => void
  isFirstTime?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [phone, setPhone] = useState(profile?.phone || "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)

  const pickImage = async () => {
    const ImagePicker = await import("expo-image-picker")

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri)
    }
  }

  const uploadAvatar = async (imageUri: string) => {
    try {
      setUploading(true)

      const FileSystem = await import("expo-file-system")
      const { decode } = await import("base64-arraybuffer")

      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Generate unique filename
      const fileName = `${session.user.id}/avatar-${Date.now()}.jpg`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from("item-images").upload(fileName, decode(base64), {
        contentType: "image/jpeg",
        upsert: true,
      })

      if (error) throw error

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("item-images").getPublicUrl(fileName)

      setAvatarUrl(publicUrl)
    } catch (error) {
      console.error("Error uploading avatar:", error)
      Alert.alert("Upload Error", "Failed to upload profile picture. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function updateProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error("No user on the session!")

      const updates = {
        id: session.user.id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("profiles").upsert(updates)

      if (error) {
        throw error
      }

      Alert.alert("Success", "Profile updated successfully!")
      onProfileUpdated()
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message)
      }
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

        <Text style={styles.settingsTitle}>{isFirstTime ? "Complete Your Profile" : "Edit Profile"}</Text>

        {isFirstTime && <Text style={styles.settingsSubtitle}>Tell us a bit about yourself</Text>}
      </View>

      <View style={styles.form}>
        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <Text style={styles.sectionLabel}>Profile Picture</Text>

          <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.avatarUploadContainer}>
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

        {/* Form Fields */}
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
              editable={true}
            />
          </View>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputContainer, styles.disabledInput]}>
            <Feather name="mail" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, styles.disabledText]}
              value={session.user.email || ""}
              editable={false}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <Text style={styles.inputHint}>Email cannot be changed</Text>
        </View>

        <Button
          title={loading ? "Updating..." : isFirstTime ? "Complete Profile" : "Save Changes"}
          onPress={updateProfile}
          disabled={loading || !fullName.trim() || uploading}
          buttonStyle={styles.saveButton}
          titleStyle={styles.saveButtonText}
        />
      </View>
    </ScrollView>
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
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: "white",
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileAvatar: {
    backgroundColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 16,
    color: "#64748b",
  },
  content: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: "row",
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
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 20,
  },
  infoSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoText: {
    fontSize: 16,
    color: "#64748b",
    marginLeft: 12,
  },
  actionsSection: {
    gap: 12,
  },
  editButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
  },
  editButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 16,
  },
  signOutButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  // Settings styles
  settingsHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: "white",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 70,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  settingsSubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  form: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  avatarUploadContainer: {
    position: "relative",
    marginBottom: 8,
  },
  avatarUpload: {
    backgroundColor: "#e2e8f0",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
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
    borderWidth: 3,
    borderColor: "white",
  },
  avatarHint: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  disabledInput: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
  },
  disabledText: {
    color: "#94a3b8",
  },
  inputHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
})
