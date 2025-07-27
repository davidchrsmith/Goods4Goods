"use client"

import { useState, useEffect } from "react"
import { Alert, StyleSheet, View, Text } from "react-native"
import { supabase } from "../lib/supabase"
import { Button, Input, Avatar } from "@rneui/themed"
import type { Session } from "@supabase/supabase-js"
import type { Profile } from "../types/database"

interface ProfileProps {
  session: Session
  onProfileComplete: () => void
}

export default function ProfileComponent({ session, onProfileComplete }: ProfileProps) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  // Removed phone state as it's no longer used for authentication/profile update

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
        setFullName(data.full_name || "")
        // Phone is no longer fetched/set here
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error("No user on the session!")

      const updates = {
        id: session.user.id,
        full_name: fullName,
        // Removed phone from updates
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("profiles").upsert(updates)

      if (error) {
        throw error
      }

      Alert.alert("Success", "Profile updated successfully!")
      onProfileComplete()
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar size={80} rounded icon={{ name: "user", type: "feather" }} containerStyle={styles.avatar} />
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          leftIcon={{ type: "feather", name: "user" }}
          containerStyle={styles.inputContainer}
        />

        {/* Removed Phone Number Input Field */}
        {/* <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+1234567890"
          keyboardType="phone-pad"
          leftIcon={{ type: "feather", name: "phone" }}
          containerStyle={styles.inputContainer}
        /> */}

        <Button
          title={loading ? "Updating..." : "Complete Profile"}
          onPress={updateProfile}
          disabled={loading || !fullName.trim()}
          buttonStyle={styles.primaryButton}
          titleStyle={styles.buttonText}
        />

        <Button
          title="Sign Out"
          onPress={() => supabase.auth.signOut()}
          buttonStyle={styles.secondaryButton}
          titleStyle={styles.secondaryButtonText}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 40,
  },
  avatar: {
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
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
    textAlign: "center",
  },
  form: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
})
