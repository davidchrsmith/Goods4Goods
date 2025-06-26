import React, { useState, useEffect } from 'react'
import { View, FlatList, RefreshControl, Text, TouchableOpacity } from 'react-native'
import { supabase } from '../config/supabase'
import { globalStyles } from '../styles'
import ItemCard from '../components/ItemCard'
import LoadingScreen from '../components/LoadingScreen'
import { handleError, showError } from '../utils/errorHandler'

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    getCurrentUser()
    fetchItems()
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const fetchItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch items from other users that are available for trade
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          users (
            id,
            username
          )
        `)
        .eq('status', 'available')
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      showError(error, 'Fetching items')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchItems()
  }

  const handleItemPress = (item) => {
    navigation.navigate('ItemDetail', { item })
  }

  const handleTradeRequest = async (item) => {
    try {
      // Get user's available items for trade selection
      const { data: userItems, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('status', 'available')

      if (error) throw error

      if (!userItems || userItems.length === 0) {
        showError(new Error('You need to upload items to trade'), 'Trade Request')
        return
      }

      // Navigate to item detail where user can select their item to trade
      navigation.navigate('ItemDetail', { 
        item, 
        userItems,
        mode: 'trade' 
      })
    } catch (error) {
      showError(error, 'Trade Request')
    }
  }

  const renderItem = ({ item }) => (
    <ItemCard 
      item={item}
      onPress={() => handleItemPress(item)}
      showActions={true}
      onTradeRequest={handleTradeRequest}
    />
  )

  if (loading) {
    return <LoadingScreen message="Loading items..." />
  }

  return (
    <View style={globalStyles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={globalStyles.emptyContainer}>
            <Text style={globalStyles.emptyText}>
              No items available for trade yet.
            </Text>
            <Text style={globalStyles.captionText}>
              Be the first to upload something!
            </Text>
          </View>
        }
      />
    </View>
  )
}