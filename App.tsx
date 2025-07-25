"use client"

import { useState, useEffect } from "react"
import { View, StyleSheet } from "react-native"
import { supabase } from "./lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Profile } from "./types/database"

// Components
import Auth from "./components/Auth"
import ProfileComponent from "./components/Profile"
import SwipeCards from "./components/SwipeCards"
import AddItem from "./components/AddItem"
import TradeRequests from "./components/TradeRequests"
import Navigation from "./components/Navigation"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("discover")

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        getProfile(session)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        getProfile(session)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function getProfile(session: Session) {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      setProfile(data)
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileComplete = () => {
    if (session) {
      getProfile(session)
    }
  }

  const handleItemAdded = () => {
    setActiveTab("discover")
  }

  if (loading) {
    return <View style={styles.loading} />
  }

  // Show auth screen if no session
  if (!session) {
    return <Auth />
  }

  // Show profile setup if profile is incomplete
  if (!profile || !profile.full_name) {
    return <ProfileComponent session={session} onProfileComplete={handleProfileComplete} />
  }

  // Main app content
  const renderActiveTab = () => {
    switch (activeTab) {
      case "discover":
        return <SwipeCards session={session} />
      case "add":
        return <AddItem session={session} onItemAdded={handleItemAdded} />
      case "requests":
        return <TradeRequests session={session} />
      case "profile":
        return <ProfileComponent session={session} onProfileComplete={handleProfileComplete} />
      default:
        return <SwipeCards session={session} />
    }
  }

  return (
    <View style={styles.container}>
      {renderActiveTab()}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loading: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
})
