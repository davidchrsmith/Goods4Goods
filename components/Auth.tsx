import { useState } from "react"
import { Alert, StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { login, register, lookupEmailByUsername } from "../api/auth"
import { ApiError } from "../api/client"
import { Button, Input } from "@rneui/themed"
import type { Profile } from "../api/types"

interface AuthProps {
  onLogin: (profile: Profile) => void
}

export default function Auth({ onLogin }: AuthProps) {
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleSignIn() {
    if (!emailOrUsername.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email/username and password")
      return
    }

    setLoading(true)
    try {
      let email = emailOrUsername.trim()

      if (!email.includes("@")) {
        const found = await lookupEmailByUsername(email)
        if (!found) {
          Alert.alert("Username Not Found", "That username doesn't exist. Try your email address instead.")
          return
        }
        email = found
      }

      const { user } = await login(email, password)
      onLogin(user)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "An unexpected error occurred"
      Alert.alert("Sign In Failed", message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp() {
    if (!emailOrUsername.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password")
      return
    }
    if (!emailOrUsername.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address to sign up")
      return
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters")
      return
    }

    setLoading(true)
    try {
      const { user } = await register(emailOrUsername.trim(), password)
      onLogin(user)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "An unexpected error occurred"
      Alert.alert("Sign Up Failed", message)
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
          onChangeText={setEmailOrUsername}
          value={emailOrUsername}
          placeholder={isSignUp ? "email@address.com" : "email or username"}
          keyboardType={isSignUp ? "email-address" : "default"}
          autoCapitalize="none"
          containerStyle={styles.inputContainer}
          autoCorrect={false}
        />

        <Input
          label="Password"
          leftIcon={{ type: "feather", name: "lock" }}
          onChangeText={setPassword}
          value={password}
          secureTextEntry
          placeholder="Enter your password"
          autoCapitalize="none"
          containerStyle={styles.inputContainer}
          autoCorrect={false}
        />

        <Button
          title={loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          disabled={loading}
          onPress={isSignUp ? handleSignUp : handleSignIn}
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
  },
})
