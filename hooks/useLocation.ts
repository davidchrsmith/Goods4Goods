import { useState } from "react"
import * as Location from "expo-location"
import { Alert } from "react-native"
import { updateProfile } from "../api/auth"
import type { Profile } from "../api/types"

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
  updateUserLocation: (profile: Profile) => Promise<void>
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = async () => {
    setLoading(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setError("Location permission denied")
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to find items near you.",
        )
        return
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const data: LocationData = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      }

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: data.latitude,
          longitude: data.longitude,
        })
        if (address) {
          data.locationName = `${address.city || address.subregion || ""}, ${address.region || ""}`.trim()
          if (data.locationName.startsWith(",")) {
            data.locationName = data.locationName.substring(1).trim()
          }
        }
      } catch {
        // Location name is optional; continue without it
      }

      setLocation(data)
    } catch {
      setError("Failed to get location")
      Alert.alert("Location Error", "Unable to get your current location. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const updateUserLocation = async (profile: Profile) => {
    if (!location) return
    try {
      await updateProfile({
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: location.locationName,
        location_updated_at: new Date().toISOString(),
      })
    } catch {
      // Non-critical — silently fail
    }
  }

  return { location, loading, error, requestLocation, updateUserLocation }
}
