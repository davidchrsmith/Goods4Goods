"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"
import type { Message, Profile } from "../types/database"
import { Input, Button, Avatar } from "@rneui/themed"
import { Feather } from "@expo/vector-icons"

interface ChatScreenProps {
  session: Session
  conversationId: string
  otherUser: Profile
  onBack: () => void
}

export default function ChatScreen({ session, conversationId, otherUser, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    loadMessages()
    markMessagesAsRead()

    // Subscribe to real-time message updates
    const messagesSubscription = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => [...prev, newMessage])

          // Mark as read if not sent by current user
          if (newMessage.sender_id !== session.user.id) {
            markMessageAsRead(newMessage.id)
          }
        },
      )
      .subscribe()

    return () => {
      messagesSubscription.unsubscribe()
    }
  }, [conversationId])

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  async function loadMessages() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      console.error("Error loading messages:", error)
      Alert.alert("Error", "Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  async function markMessagesAsRead() {
    try {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("is_read", false)
        .neq("sender_id", session.user.id)
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }

  async function markMessageAsRead(messageId: string) {
    try {
      await supabase.from("messages").update({ is_read: true }).eq("id", messageId)
    } catch (error) {
      console.error("Error marking message as read:", error)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || sending) return

    try {
      setSending(true)

      const { error } = await supabase.from("messages").insert([
        {
          conversation_id: conversationId,
          sender_id: session.user.id,
          content: newMessage.trim(),
        },
      ])

      if (error) throw error

      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      Alert.alert("Error", "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString()
    }
  }

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true

    const currentDate = new Date(currentMessage.created_at).toDateString()
    const previousDate = new Date(previousMessage.created_at).toDateString()

    return currentDate !== previousDate
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
      {/* Header */}
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

      {/* Messages */}
      <ScrollView ref={scrollViewRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null
          const isOwnMessage = message.sender_id === session.user.id
          const showDateSeparator = shouldShowDateSeparator(message, previousMessage)

          return (
            <View key={message.id}>
              {showDateSeparator && (
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>{formatDate(message.created_at)}</Text>
                </View>
              )}

              <View
                style={[
                  styles.messageContainer,
                  isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
                ]}
              >
                <View
                  style={[styles.messageBubble, isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble]}
                >
                  <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
                    {message.content}
                  </Text>
                  <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Message Input */}
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
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
          buttonStyle={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          icon={<Feather name="send" size={20} color={!newMessage.trim() || sending ? "#94a3b8" : "white"} />}
        />
      </View>
    </KeyboardAvoidingView>
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
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    backgroundColor: "#e2e8f0",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: "#94a3b8",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessageContainer: {
    alignItems: "flex-end",
  },
  otherMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownMessageBubble: {
    backgroundColor: "#3b82f6",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "#1e293b",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherMessageTime: {
    color: "#94a3b8",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  inputWrapper: {
    flex: 1,
    marginBottom: 0,
  },
  inputField: {
    borderBottomWidth: 0,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  inputText: {
    fontSize: 16,
    color: "#1e293b",
  },
  sendButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 20,
    width: 40,
    height: 40,
    marginLeft: 8,
    marginBottom: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#e2e8f0",
  },
})
