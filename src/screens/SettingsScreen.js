import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const MONTH_START_DAY_KEY = 'monthStartDay';
const MONTH_START_DAY_OPTIONS = Array.from({length: 28}, (_, index) => index + 1);

const COMMON_SETTINGS = [
  {id: 'language', title: 'Language', icon: 'globe-outline'},
  {id: 'notifications', title: 'Notifications', icon: 'notifications-outline'},
  {id: 'privacy', title: 'Privacy', icon: 'lock-closed-outline'},
];

const SettingsScreen = ({navigation}) => {
  const [monthStartDay, setMonthStartDay] = React.useState(1);
  const [monthStartModalVisible, setMonthStartModalVisible] = React.useState(false);

  React.useEffect(() => {
    const loadMonthStartDay = async () => {
      try {
        const stored = await AsyncStorage.getItem(MONTH_START_DAY_KEY);
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 28) {
          setMonthStartDay(parsed);
        } else {
          setMonthStartDay(1);
        }
      } catch (error) {
        console.error('Failed to load month start day:', error);
      }
    };
    const unsubscribe = navigation.addListener('focus', loadMonthStartDay);
    loadMonthStartDay();
    return unsubscribe;
  }, [navigation]);

  const handleMonthStartSelect = async day => {
    setMonthStartDay(day);
    setMonthStartModalVisible(false);
    try {
      await AsyncStorage.setItem(MONTH_START_DAY_KEY, String(day));
    } catch (error) {
      console.error('Failed to save month start day:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Settings</Text>
          {COMMON_SETTINGS.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingRow}
              onPress={() => Alert.alert('Coming Soon', `${item.title} setting`)}>
              <View style={styles.settingLeft}>
                <Icon name={item.icon} size={22} color={colors.text.primary} />
                <Text style={styles.settingText}>{item.title}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.text.light} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setMonthStartModalVisible(true)}>
            <View style={styles.settingLeft}>
              <Icon name="calendar-outline" size={22} color={colors.text.primary} />
              <Text style={styles.settingText}>Quick Period</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>Day {monthStartDay}</Text>
              <Icon name="chevron-forward" size={20} color={colors.text.light} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={monthStartModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthStartModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMonthStartModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Period Reset Day</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setMonthStartModalVisible(false)}>
                <Icon name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dayGrid}>
              {MONTH_START_DAY_OPTIONS.map(day => {
                const isActive = day === monthStartDay;
                return (
                  <View key={day} style={styles.dayCell}>
                    <TouchableOpacity
                      style={[
                        styles.dayButton,
                        isActive && styles.dayButtonActive,
                      ]}
                      onPress={() => handleMonthStartSelect(day)}>
                      <Text
                        style={[
                          styles.dayText,
                          isActive && styles.dayTextActive,
                        ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
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
    elevation: 2,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  settingText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  modalClose: {
    padding: 4,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    padding: 4,
  },
  dayButton: {
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  dayButtonActive: {
    backgroundColor: '#F0F9FF',
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: fontSize.medium,
    color: colors.text.primary,
  },
  dayTextActive: {
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});

export default SettingsScreen;
