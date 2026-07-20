import { useState, useEffect, useRef } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from "react-native"
import { getMessages, sendMessage, markConversationRead } from "../api/messages"
import { ApiError } from "../api/client"
import type { Message, Profile } from "../api/types"
import { Input, Button, Avatar } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"

interface ChatScreenProps {
  profile: Profile
  conversationId: string
  otherUser: Profile
  onBack: () => void
}

const POLL_INTERVAL = 3000

export default function ChatScreen({ profile, conversationId, otherUser, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initChat()
    pollRef.current = setInterval(pollMessages, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [conversationId])

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  async function initChat() {
    setLoading(true)
    try {
      const data = await getMessages(conversationId)
      setMessages(data)
      await markConversationRead(conversationId)
    } catch {
      Alert.alert("Error", "Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  async function pollMessages() {
    try {
      const data = await getMessages(conversationId)
      setMessages((prev) => {
        if (data.length !== prev.length) {
          markConversationRead(conversationId).catch(() => {})
          return data
        }
        return prev
      })
    } catch {
      // Silently fail on poll errors
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || sending) return
    const content = newMessage.trim()
    const tempId = `temp-${Date.now()}`

    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: profile.id,
      content,
      is_read: true,
      created_at: new Date().toISOString(),
    }

    setSending(true)
    setNewMessage("")
    setMessages((prev) => [...prev, tempMessage])

    try {
      const real = await sendMessage(conversationId, content)
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(content)
      Alert.alert("Error", "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
    return date.toLocaleDateString()
  }

  const shouldShowDateSeparator = (current: Message, previous: Message | null) => {
    if (!previous) return true
    return new Date(current.created_at).toDateString() !== new Date(previous.created_at).toDateString()
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Avatar
            size={40}
            rounded
            source={otherUser.avatar_url ? { uri: otherUser.avatar_url } : undefined}
            icon={!otherUser.avatar_url ? { name: "user", type: "feather" } : undefined}
            containerStyle={styles.headerAvatar}
          />
          <Text style={styles.headerTitle}>{otherUser.full_name || "Unknown User"}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : null
          const isOwn = message.sender_id === profile.id
          return (
            <View key={message.id}>
              {shouldShowDateSeparator(message, previous) && (
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>{formatDate(message.created_at)}</Text>
                </View>
              )}
              <View style={[styles.messageContainer, isOwn ? styles.ownMessageContainer : styles.otherMessageContainer]}>
                <View style={[styles.messageBubble, isOwn ? styles.ownMessageBubble : styles.otherMessageBubble]}>
                  <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
                    {message.content}
                  </Text>
                  <Text style={[styles.messageTime, isOwn ? styles.ownMessageTime : styles.otherMessageTime]}>
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>

      <View style={styles.inputContainer}>
        <Input
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
          containerStyle={styles.inputWrapper}
          inputContainerStyle={styles.inputField}
          inputStyle={styles.inputText}
        />
        <Button
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          buttonStyle={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          icon={<Feather name="send" size={20} color={!newMessage.trim() || sending ? "#94a3b8" : "white"} />}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#64748b" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backButton: { padding: 8, marginRight: 8 },
  headerContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerAvatar: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  dateSeparator: { alignItems: "center", marginVertical: 12 },
  dateSeparatorText: { fontSize: 12, color: "#94a3b8", backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  messageContainer: { marginBottom: 8 },
  ownMessageContainer: { alignItems: "flex-end" },
  otherMessageContainer: { alignItems: "flex-start" },
  messageBubble: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  ownMessageBubble: { backgroundColor: "#3b82f6", borderBottomRightRadius: 4 },
  otherMessageBubble: { backgroundColor: "white", borderBottomLeftRadius: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  messageText: { fontSize: 15, lineHeight: 20 },
  ownMessageText: { color: "white" },
  otherMessageText: { color: "#1e293b" },
  messageTime: { fontSize: 11, marginTop: 4 },
  ownMessageTime: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  otherMessageTime: { color: "#94a3b8" },
  inputContainer: { flexDirection: "row", alignItems: "flex-end", padding: 12, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  inputWrapper: { flex: 1, paddingHorizontal: 0 },
  inputField: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 24, paddingHorizontal: 16, backgroundColor: "#f8fafc" },
  inputText: { fontSize: 15, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#3b82f6", marginLeft: 8, padding: 0 },
  sendButtonDisabled: { backgroundColor: "#e2e8f0" },
})
