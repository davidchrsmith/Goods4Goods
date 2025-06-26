import React, { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { supabase } from './src/config/supabase'
import { colors } from './src/styles'

// Screens
import AuthScreen from './src/screens/AuthScreen'
import HomeScreen from './src/screens/HomeScreen'
import UploadItemScreen from './src/screens/UploadItemScreen'
import TradeRequestsScreen from './src/screens/TradeRequestsScreen'
import ItemDetailScreen from './src/screens/ItemDetailScreen'
import ChatScreen from './src/screens/ChatScreen'
import LoadingScreen from './src/components/LoadingScreen'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
        options={{ title: 'Available Items' }}
      />
      <Stack.Screen 
        name="ItemDetail" 
        component={ItemDetailScreen} 
        options={{ title: 'Item Details' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  )
}

function TradeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="TradeMain" 
        component={TradeRequestsScreen} 
        options={{ title: 'Trade Requests' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack}
        options={{
          tabBarLabel: 'Browse',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Upload" 
        component={UploadItemScreen}
        options={{
          tabBarLabel: 'Upload',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>📤</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Trades" 
        component={TradeStack}
        options={{
          tabBarLabel: 'Trades',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🔄</Text>
          ),
        }}
      />
    </Tab.Navigator>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if there's an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <LoadingScreen message="Loading..." />
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthScreen />}
    </NavigationContainer>
  )
}