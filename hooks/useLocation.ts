"use client"

import { useState } from "react"
import * as Location from "expo-location"
import { Alert } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"

interface LocationData {
  latitude: number
  longitude: number
  locationName?: string
}

interface UseLocationReturn {
  location: LocationData | null
  loading: boolean
  error: string | null
  requestLocation: () => Promise<void>
  updateUserLocation: (session: Session) => Promise<void>
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = async () => {
    try {
      setLoading(true)
      setError(null)

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setError("Location permission denied")
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to find items near you. You can change this in your device settings.",
        )
        return
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const locationData: LocationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      }

      // Try to get address name
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        })

        if (address) {
          locationData.locationName = `${address.city || address.subregion || ""}, ${address.region || ""}`.trim()
          if (locationData.locationName.startsWith(",")) {
            locationData.locationName = locationData.locationName.substring(1).trim()
          }
        }
      } catch (geocodeError) {
        console.warn("Failed to get location name:", geocodeError)
      }

      setLocation(locationData)
    } catch (locationError) {
      console.error("Error getting location:", locationError)
      setError("Failed to get location")
      Alert.alert("Location Error", "Unable to get your current location. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const updateUserLocation = async (session: Session) => {
    if (!location || !session?.user) return

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          location_name: location.locationName,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id)

      if (error) throw error

      console.log("User location updated successfully")
    } catch (updateError) {
      console.error("Error updating user location:", updateError)
      Alert.alert("Error", "Failed to save your location")
    }
  }

  return {
    location,
    loading,
    error,
    requestLocation,
    updateUserLocation,
  }
}
