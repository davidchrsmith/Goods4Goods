"use client"

import { useState } from "react"
import { Alert, StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import { Button, Input } from "@rneui/themed"

export default function Auth() {
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function signInWithPhone() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      phone: phone,
      password: password,
    })
    if (error) Alert.alert("Error", error.message)
    setLoading(false)
  }

  async function signUpWithPhone() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      phone: phone,
      password: password,
    })
    if (error) Alert.alert("Error", error.message)
    else Alert.alert("Success", "Check your phone for verification!")
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Goods4Goods</Text>
        <Text style={styles.subtitle}>Trade items, not money</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Phone Number"
          leftIcon={{ type: "feather", name: "phone" }}
          onChangeText={(text) => setPhone(text)}
          value={phone}
          placeholder="+1234567890"
          keyboardType="phone-pad"
          autoCapitalize="none"
          containerStyle={styles.inputContainer}
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
        />

        <Button
          title={loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          disabled={loading}
          onPress={isSignUp ? signUpWithPhone : signInWithPhone}
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
