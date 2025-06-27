import React, { useState, useEffect } from 'react'
import { View, FlatList, RefreshControl, Text, Alert } from 'react-native'
import { supabase } from '../config/supabase'
import { globalStyles } from '../styles'
import TradeRequestCard from '../components/TradeRequestCard'
import LoadingScreen from '../components/LoadingScreen'
import { handleError, showError, showSuccess, showConfirmation } from '../utils/errorHandler'

export default function TradeRequestsScreen({ navigation }) {
  const [tradeRequests, setTradeRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    getCurrentUser()
    fetchTradeRequests()
    subscribeToTradeRequests()
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const fetchTradeRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('trade_requests')
        .select(`
          *,
          requester:users!trade_requests_requester_id_fkey(id, username),
          recipient:users!trade_requests_recipient_id_fkey(id, username),
          requester_item:items!trade_requests_requester_item_id_fkey(
            id, title, estimated_value, image_urls, condition
          ),
          recipient_item:items!trade_requests_recipient_item_id_fkey(
            id, title, estimated_value, image_urls, condition
          )
        `)
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      setTradeRequests(data || [])
    } catch (error) {
      showError(error, 'Fetching trade requests')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const subscribeToTradeRequests = () => {
    const subscription = supabase
      .channel('trade_requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_requests'
      }, () => {
        fetchTradeRequests()
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTradeRequests()
  }

  const handleAcceptTrade = async (tradeRequestId) => {
    showConfirmation(
      'Accept Trade Request',
      'Are you sure you want to accept this trade? This action cannot be undone.',
      async () => {
        try {
          // Update trade request status
          const { error: updateError } = await supabase
            .from('trade_requests')
            .update({ status: 'accepted' })
            .eq('id', tradeRequestId)

          if (updateError) throw updateError

          // Update both items status to 'pending' (reserved for this trade)
          const tradeRequest = tradeRequests.find(tr => tr.id === tradeRequestId)
          if (tradeRequest) {
            const { error: itemsError } = await supabase
              .from('items')
              .update({ status: 'pending' })
              .in('id', [tradeRequest.requester_item_id, tradeRequest.recipient_item_id])

            if (itemsError) throw itemsError
          }

          showSuccess('Trade request accepted!')
          fetchTradeRequests()
        } catch (error) {
          showError(error, 'Accept Trade')
        }
      }
    )
  }

  const handleDeclineTrade = async (tradeRequestId) => {
    showConfirmation(
      'Decline Trade Request',
      'Are you sure you want to decline this trade request?',
      async () => {
        try {
          const { error } = await supabase
            .from('trade_requests')
            .update({ status: 'declined' })
            .eq('id', tradeRequestId)

          if (error) throw error

          showSuccess('Trade request declined')
          fetchTradeRequests()
        } catch (error) {
          showError(error, 'Decline Trade')
        }
      }
    )
  }

  const handleOpenChat = (tradeRequest) => {
    navigation.navigate('Chat', { tradeRequest })
  }

  const renderTradeRequest = ({ item }) => (
    <TradeRequestCard
      tradeRequest={item}
      currentUserId={currentUser?.id}
      onAccept={handleAcceptTrade}
      onDecline={handleDeclineTrade}
      onChat={handleOpenChat}
    />
  )

  if (loading) {
    return <LoadingScreen message="Loading trade requests..." />
  }

  return (
    <View style={globalStyles.container}>
      <FlatList
        data={tradeRequests}
        renderItem={renderTradeRequest}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={globalStyles.emptyContainer}>
            <Text style={globalStyles.emptyText}>
              No trade requests yet
            </Text>
            <Text style={globalStyles.captionText}>
              Start browsing items to send trade requests!
            </Text>
          </View>
        }
      />
    </View>
  )
}