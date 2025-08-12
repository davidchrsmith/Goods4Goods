"use client"

import { useState } from "react"
import { Alert, StyleSheet, View, Text, ScrollView, TouchableOpacity, Image } from "react-native"
import { supabase } from "../lib/supabase"
import { Button, Input } from "@rneui/themed"
import { Picker } from "@react-native-picker/picker"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system"
import { decode } from "base64-arraybuffer"
import type { Session } from "@supabase/supabase-js"

interface AddItemProps {
  session: Session
  onItemAdded: () => void
}

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"] as const

interface ImageData {
  uri: string
  uploading: boolean
  uploaded: boolean
  publicUrl?: string
}

export default function AddItem({ session, onItemAdded }: AddItemProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("Good")
  const [estimatedValue, setEstimatedValue] = useState("")
  const [images, setImages] = useState<ImageData[]>([])

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert("Limit Reached", "You can upload up to 5 images per item")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      const newImage: ImageData = {
        uri: result.assets[0].uri,
        uploading: false,
        uploaded: false,
      }
      setImages([...images, newImage])
    }
  }

  const removeImage = (index: number) => {
    const imageToRemove = images[index]

    // If image was uploaded, delete it from storage
    if (imageToRemove.uploaded && imageToRemove.publicUrl) {
      deleteImageFromStorage(imageToRemove.publicUrl)
    }

    setImages(images.filter((_, i) => i !== index))
  }

  const uploadImage = async (imageUri: string, index: number): Promise<string | null> => {
    try {
      // Update image state to show uploading
      setImages((prev) => prev.map((img, i) => (i === index ? { ...img, uploading: true } : img)))

      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Generate unique filename
      const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from("item-images").upload(fileName, decode(base64), {
        contentType: "image/jpeg",
      })

      if (error) throw error

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("item-images").getPublicUrl(fileName)

      // Update image state to show uploaded
      setImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, uploading: false, uploaded: true, publicUrl } : img)),
      )

      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)

      // Update image state to show error
      setImages((prev) => prev.map((img, i) => (i === index ? { ...img, uploading: false, uploaded: false } : img)))

      Alert.alert("Upload Error", "Failed to upload image. Please try again.")
      return null
    }
  }

  const deleteImageFromStorage = async (publicUrl: string) => {
    try {
      // Extract file path from public URL
      const urlParts = publicUrl.split("/item-images/")
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await supabase.storage.from("item-images").remove([filePath])
      }
    } catch (error) {
      console.error("Error deleting image from storage:", error)
    }
  }

  const uploadAllImages = async (): Promise<string[]> => {
    const uploadPromises = images.map((image, index) => {
      if (image.uploaded && image.publicUrl) {
        return Promise.resolve(image.publicUrl)
      }
      return uploadImage(image.uri, index)
    })

    const uploadedUrls = await Promise.all(uploadPromises)
    return uploadedUrls.filter((url): url is string => url !== null)
  }

  async function addItem() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error("No user on the session!")

      // Upload all images first
      const imageUrls = await uploadAllImages()

      if (images.length > 0 && imageUrls.length === 0) {
        throw new Error("Failed to upload images")
      }

      // TODO: Replace manual value input with Python-based valuation script
      // The Python script will:
      // 1. Take item title, description, and condition as input
      // 2. Scrape online marketplaces (eBay, Amazon, Facebook Marketplace, etc.)
      // 3. Use ML algorithms to estimate fair market value based on:
      //    - Similar item listings
      //    - Condition adjustments
      //    - Market trends
      // 4. Return estimated value range
      // Integration point: Call Python API here before inserting item

      const itemData = {
        user_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        condition,
        estimated_value: Number.parseFloat(estimatedValue) || 0,
        image_urls: imageUrls, // Now contains actual public URLs
        is_available: true,
      }

      const { error } = await supabase.from("items").insert([itemData])

      if (error) throw error

      Alert.alert("Success", "Item added successfully!")

      // Reset form
      setTitle("")
      setDescription("")
      setCondition("Good")
      setEstimatedValue("")
      setImages([])

      onItemAdded()
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Item</Text>
        <Text style={styles.subtitle}>List an item you'd like to trade</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Item Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., iPhone 12 Pro"
          containerStyle={styles.inputContainer}
        />

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your item in detail..."
          multiline
          numberOfLines={4}
          containerStyle={styles.inputContainer}
        />

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Condition</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={condition}
              onValueChange={(itemValue) => setCondition(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {CONDITIONS.map((cond) => (
                <Picker.Item key={cond} label={cond} value={cond} />
              ))}
            </Picker>
          </View>
        </View>

        <Input
          label="Estimated Value (USD)"
          value={estimatedValue}
          onChangeText={setEstimatedValue}
          placeholder="0.00"
          keyboardType="numeric"
          leftIcon={{ type: "feather", name: "dollar-sign" }}
          containerStyle={styles.inputContainer}
        />

        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Photos ({images.length}/5)</Text>

          {images.length < 5 && (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Text style={styles.addImageText}>+ Add Photo</Text>
            </TouchableOpacity>
          )}

          <View style={styles.imageGrid}>
            {images.map((imageData, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: imageData.uri }} style={styles.image} />

                {/* Upload status overlay */}
                {imageData.uploading && (
                  <View style={styles.uploadingOverlay}>
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}

                {imageData.uploaded && (
                  <View style={styles.uploadedIndicator}>
                    <Text style={styles.uploadedText}>✓</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                  disabled={imageData.uploading}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <Button
          title={loading ? "Adding Item..." : "Add Item"}
          onPress={addItem}
          disabled={loading || !title.trim() || !description.trim() || !estimatedValue}
          buttonStyle={styles.primaryButton}
          titleStyle={styles.buttonText}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
  },
  form: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#86939e",
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  pickerItem: {
    fontSize: 16,
    height: 50,
    color: "#1e293b",
    textAlign: "center",
  },
  imageSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#86939e",
    marginBottom: 12,
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  addImageText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageContainer: {
    position: "relative",
    width: 80,
    height: 80,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  uploadedIndicator: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadedText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
})
