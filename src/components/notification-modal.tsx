import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { Bell, X, BellOff } from "lucide-react-native";

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  notifications?: { id: string; title: string; message: string; date: string }[];
}

export function NotificationModal({
  visible,
  onClose,
  notifications = [],
}: NotificationModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Bell size={20} color="#DC2626" />
            </View>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <BellOff size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No notifications found</Text>
            <Text style={styles.emptySubTitle}>
              You are all caught up! New alerts and updates will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {notifications.map((item) => (
              <View key={item.id} style={styles.notifCard}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifMessage}>{item.message}</Text>
                <Text style={styles.notifDate}>{item.date}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubTitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  notifCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  notifMessage: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
});
