import React from 'react'
import { View, Text, TouchableOpacity, Image } from 'react-native'
import { globalStyles, colors } from '../styles'

export default function TradeRequestCard({ 
  tradeRequest, 
  onAccept, 
  onDecline, 
  onChat,
  currentUserId 
}) {
  const isRequester = tradeRequest.requester_id === currentUserId
  const otherUser = isRequester ? tradeRequest.recipient : tradeRequest.requester
  const myItem = isRequester ? tradeRequest.requester_item : tradeRequest.recipient_item
  const theirItem = isRequester ? tradeRequest.recipient_item : tradeRequest.requester_item

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.warning
      case 'accepted': return colors.success
      case 'declined': return colors.danger
      case 'completed': return colors.textSecondary
      default: return colors.textSecondary
    }
  }

  return (
    <View style={globalStyles.card}>
      <View style={[globalStyles.statusBadge, { backgroundColor: getStatusColor(tradeRequest.status) + '20' }]}>
        <Text style={[globalStyles.statusText, { color: getStatusColor(tradeRequest.status) }]}>
          {tradeRequest.status.toUpperCase()}
        </Text>
      </View>

      <Text style={globalStyles.subtitle}>
        {isRequester ? 'Your Request' : 'Incoming Request'}
      </Text>

      <View style={globalStyles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={globalStyles.captionText}>Your Item:</Text>
          <View style={globalStyles.itemRow}>
            <Image 
              source={{ uri: myItem?.image_urls?.[0] || 'https://via.placeholder.com/50' }} 
              style={{ width: 50, height: 50, borderRadius: 4, marginRight: 8 }}
            />
            <View>
              <Text style={globalStyles.bodyText}>{myItem?.title}</Text>
              <Text style={globalStyles.captionText}>${myItem?.estimated_value?.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <Text style={{ fontSize: 24, color: colors.textSecondary, marginHorizontal: 10 }}>↔</Text>

        <View style={{ flex: 1 }}>
          <Text style={globalStyles.captionText}>Their Item:</Text>
          <View style={globalStyles.itemRow}>
            <Image 
              source={{ uri: theirItem?.image_urls?.[0] || 'https://via.placeholder.com/50' }} 
              style={{ width: 50, height: 50, borderRadius: 4, marginRight: 8 }}
            />
            <View>
              <Text style={globalStyles.bodyText}>{theirItem?.title}</Text>
              <Text style={globalStyles.captionText}>${theirItem?.estimated_value?.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={globalStyles.captionText}>
        {isRequester ? `To: ${otherUser?.username}` : `From: ${otherUser?.username}`}
      </Text>

      {tradeRequest.message && (
        <Text style={globalStyles.bodyText}>"{tradeRequest.message}"</Text>
      )}

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <TouchableOpacity 
          style={[globalStyles.secondaryButton, { flex: 1, marginRight: 8 }]}
          onPress={() => onChat(tradeRequest)}
        >
          <Text style={globalStyles.secondaryButtonText}>Chat</Text>
        </TouchableOpacity>

        {tradeRequest.status === 'pending' && !isRequester && (
          <>
            <TouchableOpacity 
              style={[globalStyles.dangerButton, { flex: 1, marginRight: 8 }]}
              onPress={() => onDecline(tradeRequest.id)}
            >
              <Text style={globalStyles.buttonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[globalStyles.primaryButton, { flex: 1 }]}
              onPress={() => onAccept(tradeRequest.id)}
            >
              <Text style={globalStyles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}