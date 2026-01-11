import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import BsCashCoin from './icons/BsCashCoin';
import {
  createAccount,
  getEarningAccountsCount,
  isAccountNameExists,
  setPrimaryAccount,
} from '../services/accountsDatabase';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const ACCOUNT_ICONS = [
  {id: 'wallet', name: 'wallet-outline'},
  {id: 'cash', name: 'bs-cash-coin'},
  {id: 'home', name: 'home-outline'},
  {id: 'car', name: 'car-outline'},
  {id: 'restaurant', name: 'restaurant-outline'},
  {id: 'group', name: 'people-outline'},
];

const ACCOUNT_COLORS = [
  {id: 'blue', value: '#60A5FA'},
  {id: 'cyan', value: '#22D3EE'},
  {id: 'teal', value: '#2DD4BF'},
  {id: 'pink', value: '#F472B6'},
  {id: 'orange', value: '#FB923C'},
  {id: 'yellow', value: '#FACC15'},
];

const renderAccountIcon = (iconName, size, color) => {
  if (iconName === 'bs-cash-coin') {
    return <BsCashCoin size={size} color={color} />;
  }
  return <Icon name={iconName} size={size} color={color} />;
};

const {height} = Dimensions.get('window');

const AddAccountModal = ({visible, onClose, onSuccess}) => {
  const [accountName, setAccountName] = React.useState('');
  const [accountType, setAccountType] = React.useState('earning');
  const [loading, setLoading] = React.useState(false);
  const [earningCount, setEarningCount] = React.useState(0);
  const [isFirstTime, setIsFirstTime] = React.useState(true);
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [selectedIcon, setSelectedIcon] = React.useState(ACCOUNT_ICONS[0].name);
  const [selectedColor, setSelectedColor] = React.useState(
    ACCOUNT_COLORS[0].value,
  );
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setAccountName('');
      setLoading(false);
      setSelectedIcon(ACCOUNT_ICONS[0].name);
      setSelectedColor(ACCOUNT_COLORS[0].value);
      checkEarningAccounts();
    }
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [slideAnim, visible]);

  const checkEarningAccounts = () => {
    try {
      const count = getEarningAccountsCount();
      setEarningCount(count);
      if (count === 0) {
        setIsFirstTime(true);
        setAccountType('earning');
        setIsPrimary(true);
      } else {
        setIsFirstTime(false);
        setAccountType('liability');
        setIsPrimary(false);
      }
    } catch (error) {
      console.error('Failed to check earning accounts:', error);
      setIsFirstTime(true);
      setAccountType('earning');
      setIsPrimary(true);
    }
  };

  const handleAccountTypeChange = newType => {
    if (isFirstTime && newType === 'liability') {
      Alert.alert(
        'Not Available',
        'Your first account must be an Earning Account.',
      );
      return;
    }
    if (!isFirstTime && newType === 'earning' && earningCount >= 2) {
      Alert.alert(
        'Limit Reached',
        'You can only add up to 2 earning accounts.',
      );
      return;
    }
    setAccountType(newType);
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      Alert.alert('Error', 'Account name is required.');
      return;
    }
    if (isAccountNameExists(accountName)) {
      Alert.alert('Error', 'An account with this name already exists.');
      return;
    }
    setLoading(true);
    try {
      const result = await createAccount(
        accountName,
        accountType,
        selectedIcon,
        selectedColor,
      );
      if (accountType === 'earning' && isPrimary && result.insertId) {
        await setPrimaryAccount(result.insertId);
      }
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const modalTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[styles.modalContainer, {transform: [{translateY: modalTranslateY}]}]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create New Account</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Live Preview Card */}
          <View style={styles.previewCardContainer}>
            <View style={[styles.previewCard, {backgroundColor: selectedColor}]}>
              <View style={styles.previewCardIcon}>
                {renderAccountIcon(selectedIcon, 24, colors.white)}
              </View>
              <Text style={styles.previewCardText} numberOfLines={1}>
                {accountName.trim() ? accountName.trim() : 'Account Name'}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Account Name */}
            <TextInput
              style={styles.input}
              placeholder="Account Name"
              placeholderTextColor={colors.text.secondary}
              value={accountName}
              onChangeText={setAccountName}
              autoCapitalize="words"
              editable={!loading}
            />

            {/* Account Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Type</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    accountType === 'earning' && styles.segmentButtonActive,
                    (isFirstTime || earningCount >= 2) &&
                      accountType !== 'earning' &&
                      styles.segmentButtonDisabled,
                  ]}
                  onPress={() => handleAccountTypeChange('earning')}
                  disabled={loading}>
                  <Text
                    style={[
                      styles.segmentButtonText,
                      accountType === 'earning' && styles.segmentButtonTextActive,
                    ]}>
                    Earning
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    accountType === 'liability' && styles.segmentButtonActive,
                    isFirstTime && styles.segmentButtonDisabled,
                  ]}
                  onPress={() => handleAccountTypeChange('liability')}
                  disabled={loading || isFirstTime}>
                  <Text
                    style={[
                      styles.segmentButtonText,
                      accountType === 'liability' &&
                        styles.segmentButtonTextActive,
                      isFirstTime && styles.segmentButtonTextDisabled,
                    ]}>
                    Liability
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Icons */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.selectionGrid}>
                {ACCOUNT_ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon.id}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon.name && styles.iconOptionSelected,
                      selectedIcon === icon.name && {
                        backgroundColor: selectedColor,
                      },
                    ]}
                    onPress={() => setSelectedIcon(icon.name)}>
                    {renderAccountIcon(
                      icon.name,
                      22,
                      selectedIcon === icon.name
                        ? colors.white
                        : colors.text.primary,
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Colors */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.selectionGrid}>
                {ACCOUNT_COLORS.map(color => (
                  <TouchableOpacity
                    key={color.id}
                    style={[
                      styles.colorOption,
                      {backgroundColor: color.value},
                      selectedColor === color.value &&
                        styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color.value)}>
                    {selectedColor === color.value && (
                      <Icon name="checkmark" size={20} color={colors.white} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                {backgroundColor: selectedColor},
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: height * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  previewCardContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  previewCard: {
    width: '90%',
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },
  previewCardIcon: {
    marginRight: spacing.md,
  },
  previewCardText: {
    flex: 1,
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  form: {
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  segmentButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  segmentButtonTextActive: {
    color: colors.white,
  },
  segmentButtonTextDisabled: {
    color: '#9CA3AF',
  },
  selectionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconOptionSelected: {
    borderWidth: 0,
    transform: [{scale: 1.1}],
    elevation: 4,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    elevation: 4,
    transform: [{scale: 1.1}],
  },
  buttonContainer: {
    marginTop: 'auto',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  saveButtonText: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default AddAccountModal;