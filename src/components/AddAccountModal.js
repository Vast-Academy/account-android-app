import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  createAccount,
  getEarningAccountsCount,
  isAccountNameExists,
  setPrimaryAccount,
} from '../services/accountsDatabase';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const ACCOUNT_ICONS = [
  {id: 'wallet', name: 'wallet-outline'},
  {id: 'cash', name: 'cash-outline'},
  {id: 'trend', name: 'trending-up-outline'},
  {id: 'card', name: 'card-outline'},
  {id: 'stats', name: 'stats-chart-outline'},
  {id: 'pie', name: 'pie-chart-outline'},
  {id: 'briefcase', name: 'briefcase-outline'},
];

const ACCOUNT_COLORS = [
  {id: 'blue', value: '#60A5FA', border: '#2563EB', bg100: '#DBEAFE'},
  {id: 'cyan', value: '#22D3EE', border: '#0891B2', bg100: '#CFFAFE'},
  {id: 'teal', value: '#2DD4BF', border: '#0F766E', bg100: '#CCFBF1'},
  {id: 'brown', value: '#8D6E63', border: '#6D4C41', bg100: '#D7CCC8'},
  {id: 'pink', value: '#F472B6', border: '#DB2777', bg100: '#FCE7F3'},
  {id: 'orange', value: '#FB923C', border: '#EA580C', bg100: '#FFEDD5'},
  {id: 'yellow', value: '#FACC15', border: '#CA8A04', bg100: '#FEF9C3'},
];

const AddAccountModal = ({visible, onClose, onSuccess}) => {
  const [accountName, setAccountName] = React.useState('');
  const [accountType, setAccountType] = React.useState('earning');
  const [loading, setLoading] = React.useState(false);
  const [earningCount, setEarningCount] = React.useState(0);
  const [isFirstTime, setIsFirstTime] = React.useState(true);
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [selectedIcon, setSelectedIcon] = React.useState(ACCOUNT_ICONS[0].name);
  const [selectedColor, setSelectedColor] = React.useState(ACCOUNT_COLORS[0].value);
  const [successVisible, setSuccessVisible] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const successTimerRef = React.useRef(null);
  const selectedColorMeta =
    ACCOUNT_COLORS.find(color => color.value === selectedColor) ||
    ACCOUNT_COLORS[0];

  React.useEffect(() => {
    if (visible) {
      // Reset form
      setAccountName('');
      setLoading(false);
      setSelectedIcon(ACCOUNT_ICONS[0].name);
      setSelectedColor(ACCOUNT_COLORS[0].value);
      // Check earning accounts
      checkEarningAccounts();
    } else {
      setSuccessVisible(false);
    }
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [slideAnim, visible]);

  React.useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const checkEarningAccounts = () => {
    try {
      const count = getEarningAccountsCount();
      console.log('Modal: Earning count =', count);
      setEarningCount(count);

      // First time: No earning accounts exist
      if (count === 0) {
        console.log('First time user - setting earning account');
        setIsFirstTime(true);
        setAccountType('earning');
        setIsPrimary(true); // Auto-check primary for first account
      } else {
        // Has earning accounts
        console.log('Existing user - setting liability account');
        setIsFirstTime(false);
        setAccountType('liability');
        setIsPrimary(false); // Liability accounts can't be primary
      }
    } catch (error) {
      console.error('Failed to check earning accounts:', error);
      // Default to earning if error
      setIsFirstTime(true);
      setAccountType('earning');
      setIsPrimary(true);
    }
  };

  const handleSave = async () => {
    console.log('Save clicked - Name:', accountName, 'Type:', accountType);

    // Validation: Empty name
    if (!accountName.trim()) {
      Alert.alert('Error', 'Account name is required');
      return;
    }

    // Validation: Check duplicate name
    const nameExists = isAccountNameExists(accountName);
    if (nameExists) {
      Alert.alert('Error', 'Account name already exists');
      return;
    }

    // Validation: Earning account limit
    if (accountType === 'earning' && earningCount >= 2) {
      Alert.alert('Limit Reached', 'You can only add up to 2 earning accounts');
      return;
    }

    setLoading(true);
    try {
      const result = await createAccount(
        accountName,
        accountType,
        selectedIcon,
        selectedColor
      );
      console.log('Account created:', result);

      // Set as primary if earning account and isPrimary is checked
      if (accountType === 'earning' && isPrimary && result.insertId) {
        await setPrimaryAccount(result.insertId);
        console.log('Set as primary account:', result.insertId);
      }

      setSuccessMessage(
        `${accountType === 'earning' ? 'Earning' : 'Liability'} account created successfully`,
      );
      setSuccessVisible(true);

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSuccessVisible(false);
        // Reset form
        setAccountName('');
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
        // Close modal
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to create account:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAccountName('');
    setAccountType(isFirstTime ? 'earning' : 'liability');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        {successVisible && (
          <View style={styles.toastContainer}>
            <View style={styles.toast}>
              <Text style={styles.toastText}>{successMessage}</Text>
            </View>
          </View>
        )}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [320, 0],
                  }),
                },
              ],
            },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Account</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Preview */}
            <View style={styles.previewContainer}>
              <View
                style={[
                  styles.previewIcon,
                  {backgroundColor: selectedColor},
                ]}>
                <Icon name={selectedIcon} size={28} color={colors.white} />
              </View>
              <Text style={styles.previewName} numberOfLines={1}>
                {accountName.trim() ? accountName.trim() : 'Account Name'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Account Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account name"
                  value={accountName}
                  onChangeText={setAccountName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              {/* Account Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Type</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={accountType}
                    onValueChange={itemValue => {
                      console.log('Picker changed to:', itemValue);
                      // Block liability on first time
                      if (isFirstTime && itemValue === 'liability') {
                        console.log('Blocked: Cannot select liability on first time');
                        Alert.alert('Not Available', 'You must create an Earning Account first');
                        return;
                      }
                      // Block earning if max limit reached
                      if (!isFirstTime && itemValue === 'earning' && earningCount >= 2) {
                        console.log('Blocked: Max earning accounts reached');
                        Alert.alert('Limit Reached', 'Maximum 2 earning accounts allowed');
                        return;
                      }
                      setAccountType(itemValue);
                    }}
                    enabled={!loading}
                    mode="dropdown"
                    style={styles.picker}>
                    {/* Always show both options */}
                    <Picker.Item
                      label="Earning Account"
                      value="earning"
                      enabled={isFirstTime || earningCount < 2}
                      color={(!isFirstTime && earningCount >= 2) ? '#999' : '#000'}
                    />
                    <Picker.Item
                      label="Liability Account"
                      value="liability"
                      enabled={!isFirstTime}
                      color={isFirstTime ? '#999' : '#000'}
                    />
                  </Picker>
                </View>

                {/* Info Text */}
                {isFirstTime && (
                  <Text style={styles.infoText}>
                    First account must be an Earning Account
                  </Text>
                )}
                {!isFirstTime && earningCount >= 2 && (
                  <Text style={styles.warningText}>
                    Maximum 2 earning accounts reached
                  </Text>
                )}
                {!isFirstTime && earningCount < 2 && (
                  <Text style={styles.infoText}>
                    Earning accounts: {earningCount}/2
                  </Text>
                )}
              </View>

              {/* Account Icon */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Choose icon for account</Text>
                <View style={styles.iconGrid}>
                  {ACCOUNT_ICONS.map(icon => {
                    const isSelected = selectedIcon === icon.name;
                    return (
                      <TouchableOpacity
                        key={icon.id}
                        style={[
                          styles.iconOption,
                          isSelected && styles.iconOptionSelected,
                          isSelected && {borderColor: selectedColorMeta.border},
                        {backgroundColor: selectedColor},
                        ]}
                        onPress={() => setSelectedIcon(icon.name)}
                        disabled={loading}>
                        <Icon
                          name={icon.name}
                          size={22}
                        color={colors.white}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Account Color */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Choose color for account</Text>
                <View style={styles.colorGrid}>
                  {ACCOUNT_COLORS.map(color => {
                    const isSelected = selectedColor === color.value;
                    return (
                      <TouchableOpacity
                        key={color.id}
                        style={[
                          styles.colorOption,
                          {backgroundColor: color.value},
                          isSelected && {borderColor: color.border},
                          isSelected && styles.colorOptionSelected,
                        ]}
                        onPress={() => setSelectedColor(color.value)}
                        disabled={loading}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Primary Account Checkbox (Only for Earning Accounts) */}
              {accountType === 'earning' && (
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setIsPrimary(!isPrimary)}
                    disabled={loading || isFirstTime}>
                    <View style={[styles.checkboxBox, isPrimary && styles.checkboxBoxChecked]}>
                      {isPrimary && (
                        <Icon name="checkmark" size={16} color={colors.white} />
                      )}
                    </View>
                    <View style={styles.checkboxLabelContainer}>
                      <Text style={styles.checkboxLabel}>Set as Primary Account</Text>
                      {isFirstTime && (
                        <Text style={styles.checkboxSubtext}>
                          First earning account will be set as primary automatically
                        </Text>
                      )}
                      {!isFirstTime && (
                        <Text style={styles.checkboxSubtext}>
                          Liability accounts will borrow from primary account
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  toastContainer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 120,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toastText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  formScroll: {
    paddingBottom: spacing.lg,
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  previewName: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  form: {
    padding: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
    color: colors.text.primary,
  },
  iconGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: '#E5E7EB',
  },
  colorGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  colorOptionSelected: {
    borderWidth: 1,
  },
  infoText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  warningText: {
    fontSize: fontSize.small,
    color: colors.error,
    marginTop: spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  checkboxContainer: {
    marginTop: spacing.sm,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  checkboxSubtext: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    lineHeight: 16,
  },
});

export default AddAccountModal;
