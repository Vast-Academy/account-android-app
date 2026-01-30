import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import BsCashCoin from '../components/icons/BsCashCoin';
import {
  createAccount,
  isAccountNameExists,
} from '../services/accountsDatabase';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

// Account Tags
const EARNING_TAGS = [
  'Salary',
  'Business',
  'Investment',
  'Rental Income',
  'Bonus',
  'Freelance',
  'Pocket Money',
  'Savings Interest',
  'Gift',
  'Side Hustle',
  'Commission',
  'Dividend',
  'Pension',
  'Allowance',
  'Other',
];

const EXPENSES_TAGS = [
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Dining Out',
  'Healthcare',
  'Entertainment',
  'Education',
  'Rent',
  'Insurance',
  'Personal Care',
  'Fitness',
  'Travel',
  'Utilities',
  'Other',
];

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

// 20 Colors
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

const AddAccountScreen = ({navigation, route}) => {
  const accountType = route?.params?.accountType || 'earning';
  const tags = accountType === 'earning' ? EARNING_TAGS : EXPENSES_TAGS;

  const [selectedTag, setSelectedTag] = React.useState(null);
  const [customName, setCustomName] = React.useState('');
  const [selectedIcon, setSelectedIcon] = React.useState(ACCOUNT_ICONS[0]);
  const [selectedColor, setSelectedColor] = React.useState(ACCOUNT_COLORS[0].value);
  const [loading, setLoading] = React.useState(false);

  const [tagDropdownVisible, setTagDropdownVisible] = React.useState(false);
  const [iconDropdownVisible, setIconDropdownVisible] = React.useState(false);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const modalSlideAnim = React.useRef(new Animated.Value(300)).current;

  const isOtherSelected = selectedTag === 'Other';

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
    if (tagDropdownVisible || iconDropdownVisible) {
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
  }, [tagDropdownVisible, iconDropdownVisible]);

  const handleTagSelect = tag => {
    setSelectedTag(tag);
    setTagDropdownVisible(false);
    if (tag !== 'Other') {
      setCustomName('');
    }
  };

  const handleIconSelect = icon => {
    setSelectedIcon(icon);
    setIconDropdownVisible(false);
  };

  const getAccountName = () => {
    if (isOtherSelected && customName.trim()) {
      return customName.trim();
    }
    if (selectedTag) {
      return selectedTag;
    }
    return '';
  };

  const isValid = () => {
    if (isOtherSelected) {
      return customName.trim().length > 0;
    }
    return selectedTag !== null;
  };

  const handleCreate = async () => {
    const accountName = getAccountName();

    if (!accountName) {
      Alert.alert('Error', 'Please select or enter an account name.');
      return;
    }

    if (isAccountNameExists(accountName)) {
      Alert.alert('Error', 'An account with this name already exists.');
      return;
    }

    setLoading(true);
    try {
      await createAccount(accountName, accountType, selectedIcon.name, selectedColor);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const headerTitle = accountType === 'earning'
    ? 'Create Earning Account'
    : 'Create Expenses Account';

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header with gradient shadow */}
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
          {
            opacity: fadeAnim,
            transform: [{scale: scaleAnim}],
          },
        ]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

        {/* Select Account Tag Dropdown */}
        <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
          <Text style={styles.fieldLabel}>Account Name</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, {borderColor: selectedColor + '55'}]}
            onPress={() => setTagDropdownVisible(true)}
            activeOpacity={0.7}>
            <Text style={styles.dropdownButtonText}>
              {selectedTag || 'Select Account Tag'}
            </Text>
            <Icon name="chevron-down" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Custom Name Input (conditional) */}
        {isOtherSelected && (
          <View style={[styles.fieldCard, {borderWidth: 1, borderColor: selectedColor + '22'}]}>
            <Text style={styles.fieldLabel}>Custom Name</Text>
            <TextInput
              style={[styles.textInput, {borderColor: selectedColor + '55'}]}
              placeholder="Enter account name..."
              placeholderTextColor={colors.text.secondary}
              value={customName}
              onChangeText={setCustomName}
              autoCapitalize="words"
              maxLength={30}
            />
          </View>
        )}

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
      </ScrollView>
      </Animated.View>

      {/* Create Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            {backgroundColor: selectedColor},
            !isValid() && styles.createButtonDisabled,
            styles.createButtonShadow,
          ]}
          onPress={handleCreate}
          disabled={!isValid() || loading}
          activeOpacity={0.85}>
          <View style={styles.buttonGradientOverlay} />
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonContent}>
              <Icon name="add-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Account</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tag Dropdown Modal */}
      <Modal
        visible={tagDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTagDropdownVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTagDropdownVisible(false)}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{translateY: tagDropdownVisible ? modalSlideAnim : 300}],
              },
            ]}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Icon name="pricetag-outline" size={20} color={selectedColor} />
                <Text style={styles.modalTitle}>Select Account Tag</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTagDropdownVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <Icon name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={tags}
              keyExtractor={(item, index) => index.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => {
                const isSelected = selectedTag === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      isSelected && [styles.modalItemSelected, {borderLeftColor: selectedColor}],
                    ]}
                    onPress={() => handleTagSelect(item)}
                    activeOpacity={0.7}>
                    <View style={styles.modalItemContent}>
                      {isSelected && (
                        <View style={[styles.modalItemDot, {backgroundColor: selectedColor}]} />
                      )}
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item}</Text>
                    </View>
                    {isSelected && (
                      <Icon name="checkmark-circle" size={22} color={selectedColor} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </TouchableOpacity>
      </Modal>

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
    color: '#0F172A',
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
  textInput: {
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
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
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  modalItemSelected: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
  modalItemTextSelected: {
    fontWeight: '700',
    color: '#0F172A',
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

export default AddAccountScreen;
