import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../config/supabase'
import { globalStyles, colors } from '../styles'
import { handleError, showError } from '../utils/errorHandler'
import LoadingScreen from '../components/LoadingScreen'

export default function ChatScreen({ route, navigation }) {
  const { tradeRequest } = route.params
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    getCurrentUser()
    fetchMessages()
    subscribeToMessages()
    
    // Set navigation header
    navigation.setOptions({
      title: `Chat with ${getOtherUser()?.username || 'User'}`
    })
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const getOtherUser = () => {
    if (!currentUser) return null
    return tradeRequest.requester_id === currentUser.id 
      ? tradeRequest.recipient 
      : tradeRequest.requester
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, username)
        `)
        .eq('trade_request_id', tradeRequest.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      showError(error, 'Fetching messages')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trade_request_id=eq.${tradeRequest.id}`
      }, (payload) => {
        // Fetch the new message with sender info
        fetchNewMessage(payload.new.id)
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }

  const fetchNewMessage = async (messageId) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, username)
        `)
        .eq('id', messageId)
        .single()

      if (error) throw error

      setMessages(prev => [...prev, data])
    } catch (error) {
      console.error('Error fetching new message:', error)
    }
  }

  const sendMessage = async () => {
    const messageText = newMessage.trim()
    if (!messageText || !currentUser) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          trade_request_id: tradeRequest.id,
          sender_id: currentUser.id,
          message: messageText
        })

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      showError(error, 'Sending message')
    }
  }

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === currentUser?.id
    
    return (
      <View style={[
        globalStyles.messageContainer,
        isMyMessage ? globalStyles.myMessage : globalStyles.otherMessage
      ]}>
        <Text style={[
          globalStyles.messageText,
          isMyMessage ? globalStyles.myMessageText : globalStyles.otherMessageText
        ]}>
          {item.message}
        </Text>
        <Text style={[
          globalStyles.messageTime,
          isMyMessage ? globalStyles.myMessageText : globalStyles.otherMessageText
        ]}>
          {new Date(item.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    )
  }

  if (loading) {
    return <LoadingScreen message="Loading chat..." />
  }

  return (
    <KeyboardAvoidingView 
      style={globalStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        style={globalStyles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          // Auto-scroll to bottom on new messages
          if (messages.length > 0) {
            setTimeout(() => {
              try {
                // This will scroll to the end
              } catch (e) {
                // Ignore scroll errors
              }
            }, 100)
          }
        }}
        ListEmptyComponent={
          <View style={globalStyles.emptyContainer}>
            <Text style={globalStyles.emptyText}>
              Start the conversation!
            </Text>
            <Text style={globalStyles.captionText}>
              Send a message to begin trading discussions
            </Text>
          </View>
        }
      />
      
      <View style={globalStyles.inputContainer}>
        <TextInput
          style={globalStyles.messageInput}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={[
            globalStyles.sendButton,
            { opacity: newMessage.trim() ? 1 : 0.5 }
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={globalStyles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}