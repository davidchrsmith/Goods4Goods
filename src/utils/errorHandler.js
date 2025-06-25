import { Alert } from 'react-native'

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
  }
}

export const handleError = (error, context = '') => {
  console.error(`Error in ${context}:`, error)
  
  let userMessage = 'Something went wrong. Please try again.'
  
  if (error.message) {
    // Supabase errors
    if (error.message.includes('Invalid login credentials')) {
      userMessage = 'Invalid email or password. Please check your credentials.'
    } else if (error.message.includes('Email not confirmed')) {
      userMessage = 'Please check your email and click the confirmation link.'
    } else if (error.message.includes('User already registered')) {
      userMessage = 'An account with this email already exists.'
    } else if (error.message.includes('Network request failed')) {
      userMessage = 'Network error. Please check your internet connection.'
    } else if (error.message.includes('JWT expired')) {
      userMessage = 'Your session has expired. Please log in again.'
    } else if (error.code === 'PERMISSION_DENIED') {
      userMessage = 'Permission denied. Please check your camera/storage permissions.'
    } else if (error.code === 'UPLOAD_FAILED') {
      userMessage = 'Failed to upload image. Please try again.'
    } else if (error.code === 'AI_VALUATION_FAILED') {
      userMessage = 'Could not get AI valuation. Using fallback pricing.'
    }
  }
  
  return userMessage
}

export const showError = (error, context = '') => {
  const message = handleError(error, context)
  Alert.alert('Error', message)
}

export const showSuccess = (message) => {
  Alert.alert('Success', message)
}

export const showConfirmation = (title, message, onConfirm, onCancel) => {
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', onPress: onCancel, style: 'cancel' },
      { text: 'Confirm', onPress: onConfirm }
    ]
  )
}