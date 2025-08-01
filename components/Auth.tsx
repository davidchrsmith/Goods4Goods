"use client"

import { useState } from "react"
import { Alert, StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import { Button, Input } from "@rneui/themed"

export default function Auth() {
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function signInWithEmailOrUsername() {
    if (!emailOrUsername.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email/username and password")
      return
    }

    setLoading(true)

    try {
      let email = emailOrUsername.trim()

      // Check if input is a username (no @ symbol)
      if (!emailOrUsername.includes("@")) {
        console.log("Looking up username:", emailOrUsername.toLowerCase().trim())

        // Look up email by username using RPC function
        const { data: userEmail, error: lookupError } = await supabase.rpc("get_email_by_username", {
          input_username: emailOrUsername.toLowerCase().trim(),
        })

        if (lookupError) {
          console.error("Username lookup error:", lookupError)
          Alert.alert("Error", "Failed to look up username. Please try again or use your email address.")
          return
        }

        if (!userEmail) {
          Alert.alert(
            "Username Not Found",
            "The username you entered doesn't exist. Please check your username or try using your email address.",
          )
          return
        }

        email = userEmail
        console.log("Found email for username:", email)
      }

      console.log("Attempting sign in with email:", email)

      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (error) {
        console.error("Sign in error:", error)

        // Provide specific error messages
        if (error.message.includes("Invalid login credentials")) {
          Alert.alert(
            "Invalid Credentials",
            "The email/username or password you entered is incorrect. Please try again.",
          )
        } else if (error.message.includes("Email not confirmed")) {
          Alert.alert(
            "Email Not Verified",
            "Please check your email and click the verification link before signing in.",
          )
        } else if (error.message.includes("Too many requests")) {
          Alert.alert("Too Many Attempts", "Too many sign-in attempts. Please wait a few minutes before trying again.")
        } else if (error.message.includes("signup is disabled")) {
          Alert.alert("Account Required", "Please create an account first.")
        } else {
          Alert.alert("Sign In Failed", error.message || "An error occurred during sign in. Please try again.")
        }
        return
      }

      console.log("Sign in successful")
      // Success - the auth state change will be handled by the app
    } catch (error) {
      console.error("Unexpected error:", error)
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function signUpWithEmail() {
    if (!emailOrUsername.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password")
      return
    }

    setLoading(true)

    if (!emailOrUsername.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address for sign up")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: emailOrUsername.trim(),
        password: password,
      })

      if (error) {
        console.error("Sign up error:", error)

        // Provide specific error messages
        if (error.message.includes("User already registered")) {
          Alert.alert("Account Exists", "An account with this email already exists. Please sign in instead.")
        } else if (error.message.includes("Password should be at least")) {
          Alert.alert("Weak Password", "Password must be at least 6 characters long.")
        } else if (error.message.includes("Invalid email")) {
          Alert.alert("Invalid Email", "Please enter a valid email address.")
        } else if (error.message.includes("signup is disabled")) {
          Alert.alert("Sign Up Disabled", "New account creation is currently disabled. Please contact support.")
        } else {
          Alert.alert("Sign Up Failed", error.message || "An error occurred during sign up. Please try again.")
        }
        return
      }

      Alert.alert(
        "Success",
        "Account created successfully! Please check your email for a verification link before signing in.",
        [{ text: "OK", onPress: () => setIsSignUp(false) }],
      )
    } catch (error) {
      console.error("Unexpected error:", error)
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Goods4Goods</Text>
        <Text style={styles.subtitle}>Trade items, not money</Text>
      </View>

      <View style={styles.form}>
        <Input
          label={isSignUp ? "Email" : "Email or Username"}
          leftIcon={{ type: "feather", name: isSignUp ? "mail" : "user" }}
          onChangeText={(text) => setEmailOrUsername(text)}
          value={emailOrUsername}
          placeholder={isSignUp ? "email@address.com" : "email@address.com or username"}
          keyboardType={isSignUp ? "email-address" : "default"}
          autoCapitalize="none"
          containerStyle={styles.inputContainer}
          autoCorrect={false}
        />

        <Input
          label="Password"
          leftIcon={{ type: "feather", name: "lock" }}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Enter your password"
          autoCapitalize="none"
          containerStyle={styles.inputContainer}
          autoCorrect={false}
        />

        <Button
          title={loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          disabled={loading}
          onPress={isSignUp ? signUpWithEmail : signInWithEmailOrUsername}
          buttonStyle={styles.primaryButton}
          titleStyle={styles.buttonText}
        />

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
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
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "500",
  },
})
