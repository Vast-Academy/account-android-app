import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import {notificationService} from '../services/NotificationService';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const NotificationSettingsScreen = ({navigation}) => {
  const handleRequestPermissions = () => {
    notificationService.requestPermissions();
  };

  const handleSendNotification = () => {
    notificationService.showLocalNotification(
      'Test Notification',
      'This is a test notification!',
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back">
          <Icon name="chevron-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleRequestPermissions}>
          <Text style={styles.buttonText}>Request Permissions (Android 13+)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSendNotification}>
          <Text style={styles.buttonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
    width: '100%',
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
  },
});

export default NotificationSettingsScreen;
