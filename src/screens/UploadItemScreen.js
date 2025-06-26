import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform
} from 'react-native'
import { launchImageLibrary, launchCamera } from 'react-native-image-picker'
import { supabase } from '../config/supabase'
import { getAIValuation } from '../config/ai'
import { globalStyles, colors } from '../styles'
import { handleError, showError, showSuccess } from '../utils/errorHandler'
import { requestCameraPermission } from '../utils/permissions'
import LoadingScreen from '../components/LoadingScreen'

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' }
]

export default function UploadItemScreen({ navigation }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('good')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [estimatedValue, setEstimatedValue] = useState(null)

  const pickImage = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }

  const openCamera = async () => {
    try {
      await requestCameraPermission()
      launchCamera(
        {
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 1000,
          maxHeight: 1000,
        },
        handleImageResponse
      )
    } catch (error) {
      showError(error, 'Camera')
    }
  }

  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
        selectionLimit: 5,
      },
      handleImageResponse
    )
  }

  const handleImageResponse = (response) => {
    if (response.didCancel || response.errorMessage) return

    if (response.assets) {
      setImages(prev => [...prev, ...response.assets.slice(0, 5 - prev.length)])
    }
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const uploadImages = async (itemId) => {
    const uploadedUrls = []

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const fileExt = image.fileName?.split('.').pop() || 'jpg'
      const fileName = `${itemId}_${i}.${fileExt}`
      const filePath = `items/${fileName}`

      try {
        // Convert image to base64 or use FormData for upload
        const formData = new FormData()
        formData.append('file', {
          uri: image.uri,
          type: image.type,
          name: fileName,
        })

        const { data, error } = await supabase.storage
          .from('item-images')
          .upload(filePath, formData)

        if (error) throw error

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
      } catch (error) {
        console.error('Image upload error:', error)
        // Continue with other images even if one fails
      }
    }

    return uploadedUrls
  }

  const getValuation = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an item title first')
      return
    }

    setLoading(true)
    try {
      const imageUrls = images.map(img => img.uri)
      const value = await getAIValuation(title, description, condition, imageUrls)
      setEstimatedValue(value)
      Alert.alert('AI Valuation', `Estimated value: $${value.toFixed(2)}`)
    } catch (error) {
      showError(error, 'AI Valuation')
    } finally {
      setLoading(false)
    }
  }

  const uploadItem = async () => {
    if (!title.trim() || images.length === 0) {
      Alert.alert('Error', 'Please provide a title and at least one image')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get AI valuation if not already done
      let finalValue = estimatedValue
      if (!finalValue) {
        const imageUrls = images.map(img => img.uri)
        finalValue = await getAIValuation(title, description, condition, imageUrls)
      }

      // Create item record
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
          title: title.trim(),
          description: description.trim(),
          condition,
          estimated_value: finalValue,
          user_id: user.id,
          status: 'available'
        })
        .select()
        .single()

      if (itemError) throw itemError

      // Upload images
      const imageUrls = await uploadImages(item.id)

      // Update item with image URLs
      if (imageUrls.length > 0) {
        const { error: updateError } = await supabase
          .from('items')
          .update({ image_urls: imageUrls })
          .eq('id', item.id)

        if (updateError) throw updateError
      }

      showSuccess('Item uploaded successfully!')
      
      // Reset form
      setTitle('')
      setDescription('')
      setCondition('good')
      setImages([])
      setEstimatedValue(null)
      
      // Navigate to home
      navigation.navigate('Home')
      
    } catch (error) {
      showError(error, 'Upload Item')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Processing..." />
  }

  return (
    <ScrollView style={globalStyles.container}>
      <View style={globalStyles.screenContainer}>
        <Text style={globalStyles.subtitle}>Upload Item</Text>

        <TextInput
          style={globalStyles.input}
          placeholder="Item title"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <TextInput
          style={globalStyles.textArea}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />

        <Text style={globalStyles.bodyText}>Condition:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {CONDITION_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                globalStyles.secondaryButton,
                { 
                  marginRight: 8, 
                  marginBottom: 8,
                  backgroundColor: condition === option.value ? colors.primary : 'transparent'
                }
              ]}
              onPress={() => setCondition(option.value)}
            >
              <Text style={[
                globalStyles.secondaryButtonText,
                { color: condition === option.value ? colors.surface : colors.primary }
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={globalStyles.imageButton} onPress={pickImage}>
          <Text style={globalStyles.bodyText}>
            {images.length === 0 ? '📷 Add Photos' : `📷 Add More Photos (${images.length}/5)`}
          </Text>
        </TouchableOpacity>

        {images.length > 0 && (
          <View style={globalStyles.imageContainer}>
            {images.map((image, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => removeImage(index)}
                style={{ position: 'relative' }}
              >
                <Image source={{ uri: image.uri }} style={globalStyles.imagePreview} />
                <View style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  backgroundColor: colors.danger,
                  borderRadius: 10,
                  padding: 2,
                  minWidth: 20,
                  alignItems: 'center'
                }}>
                  <Text style={{ color: 'white', fontSize: 12 }}>×</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={globalStyles.secondaryButton} 
          onPress={getValuation}
          disabled={!title.trim()}
        >
          <Text style={globalStyles.secondaryButtonText}>
            Get AI Valuation {estimatedValue ? `($${estimatedValue.toFixed(2)})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={globalStyles.primaryButton} 
          onPress={uploadItem}
          disabled={!title.trim() || images.length === 0}
        >
          <Text style={globalStyles.buttonText}>Upload Item</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}