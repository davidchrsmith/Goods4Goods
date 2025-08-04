"use client"

import { useState, useEffect, useRef } from "react"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

interface PushNotificationHook {
  expoPushToken?: Notifications.ExpoPushToken
  notification?: Notifications.Notification
}

export function usePushNotifications(session: Session | null): PushNotificationHook {
  const [expoPushToken, setExpoPushToken] = useState<Notifications.ExpoPushToken>()
  const [notification, setNotification] = useState<Notifications.Notification>()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => setExpoPushToken(token))

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response received:", response)
      // Here you can add logic to navigate to specific screens based on notification data
      // e.g., if (response.notification.request.content.data.type === 'trade_request') { navigate to trade requests screen }
    })

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current!)
      Notifications.removeNotificationSubscription(responseListener.current!)
    }
  }, [])

  useEffect(() => {
    if (session?.user && expoPushToken?.data) {
      savePushToken(session.user.id, expoPushToken.data)
    }
  }, [session, expoPushToken])

  async function savePushToken(userId: string, token: string) {
    try {
      // Check if token already exists for this user
      const { data: existingToken, error: fetchError } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("expo_push_token", token)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 means no rows found, which is fine
        throw fetchError
      }

      if (existingToken) {
        console.log("Push token already registered for this user.")
        return
      }

      // Insert new token
      const { error: insertError } = await supabase.from("user_push_tokens").insert({
        user_id: userId,
        expo_push_token: token,
      })

      if (insertError) {
        console.error("Error saving push token:", insertError)
      } else {
        console.log("Push token saved successfully!")
      }
    } catch (error) {
      console.error("Failed to save push token:", error)
    }
  }

  return { expoPushToken, notification }
}

async function registerForPushNotificationsAsync() {
  let token: Notifications.ExpoPushToken | undefined

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notification!")
      return
    }
    token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })
    console.log("Expo Push Token:", token.data)
  } else {
    alert("Must use physical device for Push Notifications")
  }

  return token
}
