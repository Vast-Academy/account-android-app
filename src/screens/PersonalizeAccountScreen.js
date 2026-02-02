import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  FlatList,
  Animated,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import BsCashCoin from '../components/icons/BsCashCoin';
import {colors, spacing, fontSize} from '../utils/theme';
import {getAllAccounts, updateAccountPersonalization} from '../services/accountsDatabase';
import {useToast} from '../hooks/useToast';

// 20 Icons
const ACCOUNT_ICONS = [
  {id: 'wallet', name: 'wallet-outline', label: 'Wallet'},
  {id: 'cash', name: 'bs-cash-coin', label: 'Cash'},
  {id: 'home', name: 'home-outline', label: 'Home'},
  {id: 'car', name: 'car-outline', label: 'Car'},
  {id: 'food', name: 'restaurant-outline', label: 'Food'},
  {id: 'people', name: 'people-outline', label: 'People'},
  {id: 'card', name: 'card-outline', label: 'Card'},
  {id: 'bag', name: 'bag-outline', label: 'Shopping'},
  {id: 'medical', name: 'medical-outline', label: 'Medical'},
  {id: 'game', name: 'game-controller-outline', label: 'Gaming'},
  {id: 'book', name: 'book-outline', label: 'Education'},
  {id: 'gift', name: 'gift-outline', label: 'Gift'},
  {id: 'airplane', name: 'airplane-outline', label: 'Travel'},
  {id: 'build', name: 'build-outline', label: 'Tools'},
  {id: 'flash', name: 'flash-outline', label: 'Utilities'},
  {id: 'trophy', name: 'trophy-outline', label: 'Achievement'},
  {id: 'phone', name: 'phone-portrait-outline', label: 'Phone'},
  {id: 'briefcase', name: 'briefcase-outline', label: 'Business'},
  {id: 'color-palette', name: 'color-palette-outline', label: 'Art'},
  {id: 'star', name: 'star-outline', label: 'Favorite'},
];

// Colors (match Add Account list)
const ACCOUNT_COLORS = [
  {name: 'Blue', value: '#3B82F6'},
  {name: 'Purple', value: '#8B5CF6'},
  {name: 'Yellow', value: '#F59E0B'},
  {name: 'Red', value: '#EF4444'},
  {name: 'Orange', value: '#F97316'},
  {name: 'Teal', value: '#14B8A6'},
  {name: 'Pink', value: '#EC4899'},
  {name: 'Indigo', value: '#6366F1'},
  {name: 'Cyan', value: '#06B6D4'},
  {name: 'Lime', value: '#84CC16'},
  {name: 'Sky', value: '#0EA5E9'},
  {name: 'Fuchsia', value: '#D946EF'},
  {name: 'Slate', value: '#64748B'},
  {name: 'Navy', value: '#0F172A'},
  {name: 'Maroon', value: '#7F1D1D'},
  {name: 'Forest', value: '#166534'},
  {name: 'Chocolate', value: '#78350F'},
  {name: 'Lavender', value: '#C4B5FD'},
];

const renderAccountIcon = (iconName, size, color) => {
  if (iconName === 'bs-cash-coin') {
    return <BsCashCoin size={size} color={color} />;
  }
  return <Icon name={iconName} size={size} color={color} />;
};

const PersonalizeAccountScreen = ({navigation, route}) => {
  const {showToast} = useToast();
  const accountId = route?.params?.accountId ?? route?.params?.account?.id ?? null;

  const [account, setAccount] = React.useState(null);
  const [selectedIcon, setSelectedIcon] = React.useState(ACCOUNT_ICONS[0]);
  const [selectedColor, setSelectedColor] = React.useState(ACCOUNT_COLORS[0].value);
  const [autoFundPrimary, setAutoFundPrimary] = React.useState(false);
  const [iconDropdownVisible, setIconDropdownVisible] = React.useState(false);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const modalSlideAnim = React.useRef(new Animated.Value(300)).current;

  const saveTimeoutRef = React.useRef(null);
  const lastSavedRef = React.useRef({icon: null, color: null, auto: null});
  const isInitializedRef = React.useRef(false);

  // Fade in animation on mount
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Modal slide animation
  React.useEffect(() => {
    if (iconDropdownVisible) {
      Animated.spring(modalSlideAnim, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalSlideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [iconDropdownVisible, modalSlideAnim]);

  const loadAccount = React.useCallback(() => {
    if (!accountId) {
      return;
    }
    const accounts = getAllAccounts();
    const target = accounts.find(item => String(item.id) === String(accountId));
    if (!target) {
      return;
    }
    isInitializedRef.current = false;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setAccount(target);
    const iconMatch = ACCOUNT_ICONS.find(icon => icon.name === target.icon);
    if (iconMatch) {
      setSelectedIcon(iconMatch);
    } else if (target.icon) {
      setSelectedIcon({id: 'custom', name: target.icon, label: 'Custom'});
    } else {
      setSelectedIcon(ACCOUNT_ICONS[0]);
    }
    const resolvedColor = target.icon_color || ACCOUNT_COLORS[0].value;
    setSelectedColor(resolvedColor);
    const resolvedAuto = Number(target.auto_fund_primary) === 1;
    setAutoFundPrimary(resolvedAuto);
    const resolvedIconName = iconMatch ? iconMatch.name : (target.icon || ACCOUNT_ICONS[0].name);
    lastSavedRef.current = {
      icon: resolvedIconName,
      color: resolvedColor,
      auto: resolvedAuto ? 1 : 0,
    };
    isInitializedRef.current = true;
  }, [accountId]);

  React.useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleAutoFundToggle = async value => {
    setAutoFundPrimary(value);
    if (!account?.id) {
      return;
    }
    try {
      await updateAccountPersonalization(
        account.id,
        selectedIcon?.name ?? '',
        selectedColor ?? '',
        value
      );
      setAccount(prev =>
        prev
          ? {
              ...prev,
              auto_fund_primary: value ? 1 : 0,
              updated_at: Date.now(),
            }
          : prev
      );
      lastSavedRef.current = {
        icon: selectedIcon?.name ?? '',
        color: selectedColor ?? '',
        auto: value ? 1 : 0,
      };
      showToast(value ? 'Auto-fund enabled.' : 'Auto-fund disabled.', 'success');
    } catch (error) {
      showToast('Failed to update account', 'error');
    }
  };

  const handleIconSelect = icon => {
    setSelectedIcon(icon);
    setIconDropdownVisible(false);
  };

  React.useEffect(() => {
    if (!account?.id || !isInitializedRef.current) {
      return;
    }
    const nextState = {
      icon: selectedIcon?.name ?? '',
      color: selectedColor ?? '',
      auto: Number(account?.auto_fund_primary) === 1 ? 1 : 0,
    };
    const lastState = lastSavedRef.current;
    if (
      lastState.icon === nextState.icon &&
      lastState.color === nextState.color &&
      lastState.auto === nextState.auto
    ) {
      return;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateAccountPersonalization(
          account.id,
          nextState.icon,
          nextState.color,
          autoFundPrimary
        );
        lastSavedRef.current = nextState;
      } catch (error) {
        showToast('Failed to update account', 'error');
      }
    }, 250);
  }, [account?.id, selectedIcon?.name, selectedColor, account?.auto_fund_primary, showToast]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const createdLabel = account?.created_at
    ? new Date(account.created_at).toLocaleString()
    : '—';

  const headerTitle = 'Personalize Account';

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, {borderBottomWidth: 1, borderBottomColor: selectedColor + '26'}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={selectedColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: selectedColor}]}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.View
        style={[
          styles.animatedContainer,
          {opacity: fadeAnim, transform: [{scale: scaleAnim}]},
        ]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Account Header */}
          <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
            <Text style={styles.fieldLabel}>Account</Text>
            <View style={styles.accountHeaderRow}>
              <View style={[styles.iconPreviewCircle, {backgroundColor: selectedColor + '15'}]}>
                {renderAccountIcon(selectedIcon.name, 20, selectedColor)}
              </View>
              <View>
                <Text style={styles.accountHeaderName}>{account?.account_name || 'Account'}</Text>
                <Text style={styles.accountHeaderType}>
                  {account?.account_type ? `${account.account_type} account` : 'Account'}
                </Text>
              </View>
            </View>
          </View>

          {/* Select Icon Dropdown */}
          <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
            <Text style={styles.fieldLabel}>Icon</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, {borderColor: selectedColor + '55'}]}
              onPress={() => setIconDropdownVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.dropdownIconPreview}>
                <View style={[styles.iconPreviewCircle, {backgroundColor: selectedColor + '15'}]}>
                  {renderAccountIcon(selectedIcon.name, 20, selectedColor)}
                </View>
                <Text style={styles.dropdownButtonText}>{selectedIcon.label}</Text>
              </View>
              <Icon name="chevron-down" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Color Selection */}
          <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
            <Text style={styles.fieldLabel}>Color Theme</Text>
            <View style={styles.colorGrid}>
              {ACCOUNT_COLORS.map(colorItem => {
                const isSelected = selectedColor === colorItem.value;
                return (
                  <TouchableOpacity
                    key={colorItem.name}
                    style={[
                      styles.colorDot,
                      {backgroundColor: colorItem.value},
                      isSelected && styles.colorDotSelected,
                    ]}
                    onPress={() => setSelectedColor(colorItem.value)}
                    activeOpacity={0.7}>
                    {isSelected && (
                      <View style={styles.colorCheckContainer}>
                        <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {account?.account_type === 'expenses' && (
            <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
              <Text style={styles.fieldLabel}>Auto-fund from Primary Earning</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Automatic top-up for this account</Text>
                <Switch
                  value={autoFundPrimary}
                  onValueChange={handleAutoFundToggle}
                  trackColor={{false: '#E2E8F0', true: selectedColor}}
                  thumbColor={colors.white}
                />
              </View>
            </View>
          )}

          {/* Created */}
          <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
            <Text style={styles.fieldLabel}>Created</Text>
            <Text style={styles.createdValue}>{createdLabel}</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Icon Dropdown Modal */}
      <Modal
        visible={iconDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIconDropdownVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIconDropdownVisible(false)}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{translateY: iconDropdownVisible ? modalSlideAnim : 300}],
              },
            ]}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Icon name="apps-outline" size={20} color={selectedColor} />
                <Text style={styles.modalTitle}>Select Icon</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIconDropdownVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <Icon name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ACCOUNT_ICONS}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              numColumns={4}
              contentContainerStyle={styles.iconGridContainer}
              renderItem={({item}) => {
                const isSelected = selectedIcon.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.iconGridItem,
                      isSelected && styles.iconGridItemSelected,
                      isSelected && {
                        borderColor: selectedColor,
                        backgroundColor: selectedColor + '15',
                      },
                    ]}
                    onPress={() => handleIconSelect(item)}
                    activeOpacity={0.7}>
                    {renderAccountIcon(item.name, 26, isSelected ? selectedColor : colors.text.primary)}
                    {isSelected && (
                      <View style={[styles.iconCheckBadge, {backgroundColor: selectedColor}]}>
                        <Icon name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 30,
  },
  animatedContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  fieldCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountHeaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  accountHeaderType: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownIconPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPreviewCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 4,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 6,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  colorDotSelected: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{scale: 1.1}],
  },
  colorCheckContainer: {
    position: 'absolute',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  createdValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  buttonContainer: {
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  createButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  createButtonShadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  buttonGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    paddingTop: 100,
  },
  modalContent: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0,
    backgroundColor: '#F8FAFC',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    padding: 2,
  },
  iconGridContainer: {
    padding: 12,
  },
  iconGridItem: {
    width: '22%',
    aspectRatio: 1,
    margin: '1.5%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  iconGridItemSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    transform: [{scale: 1.05}],
  },
  iconCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default PersonalizeAccountScreen;
