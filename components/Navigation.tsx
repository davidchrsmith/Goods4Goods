import { View, TouchableOpacity, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs = [
    { id: "discover", label: "Discover", icon: "heart" },
    { id: "add", label: "Add Item", icon: "plus-circle" },
    { id: "requests", label: "Requests", icon: "message-circle" },
    { id: "messages", label: "Messages", icon: "message-square" }, // Added messages tab
    { id: "profile", label: "Profile", icon: "user" },
  ]

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => onTabChange(tab.id)}
        >
          <Feather name={tab.icon as any} size={20} color={activeTab === tab.id ? "#3b82f6" : "#64748b"} />
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingBottom: 20,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  activeTab: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    marginHorizontal: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "500",
  },
  activeTabLabel: {
    color: "#3b82f6",
    fontWeight: "600",
  },
})
