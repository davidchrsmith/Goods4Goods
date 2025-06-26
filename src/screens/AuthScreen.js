import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../config/supabase'
import { globalStyles, colors } from '../styles'
import { handleError } from '../utils/errorHandler'
import LoadingScreen from '../components/LoadingScreen'

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (!isLogin && !username.trim()) {
      Alert.alert('Error', 'Please enter a username')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (error) throw error

        // Create user profile
        if (data.user) {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              username: username.trim(),
              email: email.trim(),
            })

          if (profileError) throw profileError
        }

        Alert.alert(
          'Success', 
          'Account created! Please check your email for verification link.',
          [{ text: 'OK', onPress: () => setIsLogin(true) }]
        )
      }
    } catch (error) {
      const message = handleError(error, 'Authentication')
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      
      Alert.alert('Success', 'Password reset email sent!')
    } catch (error) {
      const message = handleError(error, 'Password Reset')
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingScreen message={isLogin ? 'Signing in...' : 'Creating account...'} />
  }

  return (
    <KeyboardAvoidingView 
      style={globalStyles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={globalStyles.centerContainer}>
        <Text style={globalStyles.title}>Goods4Goods</Text>
        <Text style={[globalStyles.bodyText, { textAlign: 'center', marginBottom: 32 }]}>
          Trade your items with others in your community
        </Text>

        <View style={{ width: '100%' }}>
          <TextInput
            style={globalStyles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {!isLogin && (
            <TextInput
              style={globalStyles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          )}

          <TextInput
            style={globalStyles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleAuth}>
            <Text style={globalStyles.buttonText}>
              {isLogin ? 'Sign In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={globalStyles.secondaryButton} 
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={globalStyles.secondaryButtonText}>
              {isLogin ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
            </Text>
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity onPress={resetPassword}>
              <Text style={[globalStyles.captionText, { textAlign: 'center', marginTop: 16 }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}