import { useState, useEffect } from "react"
import { View, StyleSheet } from "react-native"
import { getMyProfile } from "./api/auth"
import { getAccessToken } from "./api/client"
import type { Profile } from "./api/types"

// Components
import Auth from "./components/Auth"
import ProfileComponent from "./components/Profile"
import SwipeCards from "./components/SwipeCards"
import AddItem from "./components/AddItem"
import MyItems from "./components/MyItems"
import MessagesList from "./components/MessagesList"
import ChatScreen from "./components/ChatScreen"
import Navigation from "./components/Navigation"
import type { ConversationWithDetails } from "./api/types"

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("discover")
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null)
  const [shouldRefreshMessages, setShouldRefreshMessages] = useState(false)

  useEffect(() => {
    restoreSession()
  }, [])

  async function restoreSession() {
    try {
      const token = await getAccessToken()
      if (token) {
        const data = await getMyProfile()
        setProfile(data)
      }
    } catch {
      // Token expired or invalid — stay on auth screen
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (p: Profile) => setProfile(p)

  const handleProfileComplete = async () => {
    const data = await getMyProfile()
    setProfile(data)
  }

  const handleItemAdded = () => setActiveTab("my-items")

  const handleConversationSelect = (conversation: ConversationWithDetails) =>
    setSelectedConversation(conversation)

  const handleBackToMessages = () => {
    setSelectedConversation(null)
    setShouldRefreshMessages(true)
  }

  if (loading) {
    return <View style={styles.loading} />
  }

  if (!profile) {
    return <Auth onLogin={handleLogin} />
  }

  if (!profile.full_name || !profile.username) {
    return <ProfileComponent profile={profile} onProfileComplete={handleProfileComplete} />
  }

  if (selectedConversation) {
    return (
      <ChatScreen
        profile={profile}
        conversationId={selectedConversation.id}
        otherUser={selectedConversation.other_user}
        onBack={handleBackToMessages}
      />
    )
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "discover":
        return <SwipeCards profile={profile} />
      case "add":
        return <AddItem profile={profile} onItemAdded={handleItemAdded} />
      case "my-items":
        return <MyItems profile={profile} />
      case "messages":
        return (
          <MessagesList
            profile={profile}
            onConversationSelect={handleConversationSelect}
            shouldRefresh={shouldRefreshMessages}
            onRefreshComplete={() => setShouldRefreshMessages(false)}
          />
        )
      case "profile":
        return <ProfileComponent profile={profile} onProfileComplete={handleProfileComplete} />
      default:
        return <SwipeCards profile={profile} />
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
