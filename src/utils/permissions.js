import { Platform, PermissionsAndroid, Alert } from 'react-native'
import { AppError } from './errorHandler'

export const requestCameraPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ])
      
      const cameraPermission = granted[PermissionsAndroid.PERMISSIONS.CAMERA]
      const storagePermission = granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]
      
      if (cameraPermission !== PermissionsAndroid.RESULTS.GRANTED ||
          storagePermission !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new AppError(
          'Camera and storage permissions are required to upload photos',
          'PERMISSION_DENIED'
        )
      }
    }
    return true
  } catch (error) {
    console.error('Permission error:', error)
    throw error
  }
}

export const checkPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const permissions = await PermissionsAndroid.checkMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ])
      
      return permissions[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
             permissions[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
    }
    return true // iOS permissions are handled by the image picker
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}