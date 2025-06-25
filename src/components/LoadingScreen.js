import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { globalStyles, colors } from '../styles'

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <View style={globalStyles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={globalStyles.loadingText}>{message}</Text>
    </View>
  )
}
