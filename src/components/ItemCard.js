import React from 'react'
import { View, Text, Image, TouchableOpacity } from 'react-native'
import { globalStyles, colors } from '../styles'

export default function ItemCard({ item, onPress, showActions = false, onTradeRequest }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return colors.success
      case 'pending': return colors.warning
      case 'traded': return colors.textSecondary
      default: return colors.textSecondary
    }
  }

  return (
    <TouchableOpacity style={globalStyles.itemCard} onPress={onPress}>
      <View style={globalStyles.itemRow}>
        <Image 
          source={{ uri: item.image_urls?.[0] || 'https://via.placeholder.com/80' }} 
          style={globalStyles.itemImage} 
        />
        <View style={globalStyles.itemInfo}>
          <Text style={globalStyles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={globalStyles.itemValue}>
            ${item.estimated_value?.toFixed(2) || '0.00'}
          </Text>
          {item.users && (
            <Text style={globalStyles.itemUser}>
              by {item.users.username}
            </Text>
          )}
          <View style={[globalStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[globalStyles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      {showActions && (
        <TouchableOpacity 
          style={globalStyles.primaryButton}
          onPress={() => onTradeRequest(item)}
        >
          <Text style={globalStyles.buttonText}>Request Trade</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}