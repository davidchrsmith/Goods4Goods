import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  FlatList
} from 'react-native'
import { supabase } from '../config/supabase'
import { globalStyles, colors } from '../styles'
import { handleError, showError, showSuccess } from '../utils/errorHandler'
import LoadingScreen from '../components/LoadingScreen'

const { width } = Dimensions.get('window')

export default function ItemDetailScreen({ route, navigation }) {
  const { item, userItems, mode } = route.params
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedUserItem, setSelectedUserItem] = useState(null)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [tradeMessage, setTradeMessage] = useState('')

  useEffect(() => {
    getCurrentUser()
    
    // Set navigation title
    navigation.setOptions({
      title: item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title
    })
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const getConditionLabel = (condition) => {
    const conditions = {
      'new': 'New',
      'like_new': 'Like New',
      'good': 'Good',
      'fair': 'Fair',
      'poor': 'Poor'
    }
    return conditions[condition] || condition
  }

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'new': return colors.success
      case 'like_new': return colors.success
      case 'good': return colors.warning
      case 'fair': return colors.warning
      case 'poor': return colors.danger
      default: return colors.textSecondary
    }
  }

  const handleTradeRequest = () => {
    if (!userItems || userItems.length === 0) {
      Alert.alert(
        'No Items Available',
        'You need to upload items before you can request trades.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upload Item', onPress: () => navigation.navigate('Upload') }
        ]
      )
      return
    }
    setShowTradeModal(true)
  }

  const submitTradeRequest = async () => {
    if (!selectedUserItem) {
      Alert.alert('Error', 'Please select an item to trade')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('trade_requests')
        .insert({
          requester_id: currentUser.id,
          recipient_id: item.user_id,
          requester_item_id: selectedUserItem.id,
          recipient_item_id: item.id,
          message: tradeMessage.trim() || null,
          status: 'pending'
        })

      if (error) throw error

      showSuccess('Trade request sent!')
      setShowTradeModal(false)
      navigation.goBack()
    } catch (error) {
      showError(error, 'Trade Request')
    } finally {
      setLoading(false)
    }
  }

  const renderUserItem = ({ item: userItem }) => (
    <TouchableOpacity
      style={[
        globalStyles.itemCard,
        {
          borderWidth: selectedUserItem?.id === userItem.id ? 2 : 0,
          borderColor: colors.primary,
          marginHorizontal: 8
        }
      ]}
      onPress={() => setSelectedUserItem(userItem)}
    >
      <View style={globalStyles.itemRow}>
        <Image 
          source={{ uri: userItem.image_urls?.[0] || 'https://via.placeholder.com/60' }} 
          style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={globalStyles.itemTitle} numberOfLines={2}>
            {userItem.title}
          </Text>
          <Text style={globalStyles.itemValue}>
            ${userItem.estimated_value?.toFixed(2) || '0.00'}
          </Text>
          <Text style={[globalStyles.captionText, { color: getConditionColor(userItem.condition) }]}>
            {getConditionLabel(userItem.condition)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderImage = ({ item: imageUrl, index }) => (
    <Image 
      source={{ uri: imageUrl }}
      style={{ 
        width: width - 32, 
        height: 300, 
        borderRadius: 12,
        marginRight: 16
      }}
      resizeMode="cover"
    />
  )

  if (loading) {
    return <LoadingScreen message="Processing trade request..." />
  }

  return (
    <ScrollView style={globalStyles.container}>
      <View style={globalStyles.screenContainer}>
        {/* Image Gallery */}
        {item.image_urls && item.image_urls.length > 0 && (
          <FlatList
            data={item.image_urls}
            renderItem={renderImage}
            keyExtractor={(url, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Item Info */}
        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>{item.title}</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={globalStyles.itemValue}>
              ${item.estimated_value?.toFixed(2) || '0.00'}
            </Text>
            <View style={[globalStyles.statusBadge, { backgroundColor: getConditionColor(item.condition) + '20' }]}>
              <Text style={[globalStyles.statusText, { color: getConditionColor(item.condition) }]}>
                {getConditionLabel(item.condition)}
              </Text>
            </View>
          </View>

          {item.description && (
            <View style={{ marginBottom: 16 }}>
              <Text style={globalStyles.bodyText}>{item.description}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={globalStyles.captionText}>
              Listed by {item.users?.username || 'Unknown User'}
            </Text>
            <Text style={globalStyles.captionText}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Trade Button */}
        {currentUser?.id !== item.user_id && (
          <TouchableOpacity 
            style={globalStyles.primaryButton}
            onPress={handleTradeRequest}
          >
            <Text style={globalStyles.buttonText}>Request Trade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trade Request Modal */}
      <Modal
        visible={showTradeModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={globalStyles.container}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowTradeModal(false)}>
              <Text style={[globalStyles.bodyText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={globalStyles.subtitle}>Select Item to Trade</Text>
            <TouchableOpacity 
              onPress={submitTradeRequest}
              disabled={!selectedUserItem}
            >
              <Text style={[globalStyles.bodyText, { 
                color: selectedUserItem ? colors.primary : colors.textSecondary 
              }]}>
                Send
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={globalStyles.bodyText}>
              Select one of your items to trade for "{item.title}":
            </Text>

            <FlatList
              data={userItems}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              style={{ marginTop: 16 }}
            />

            {selectedUserItem && (
              <View style={{ marginTop: 24 }}>
                <Text style={globalStyles.bodyText}>Add a message (optional):</Text>
                <TextInput
                  style={globalStyles.textArea}
                  placeholder="Hi! I'd like to trade my item for yours..."
                  value={tradeMessage}
                  onChangeText={setTradeMessage}
                  multiline
                  maxLength={300}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  )
}