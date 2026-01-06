import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  PermissionsAndroid,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Contacts from 'react-native-contacts';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const LedgerScreen = () => {
  const [contacts, setContacts] = useState([]);
  const [contactOptions, setContactOptions] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const requestContactsPermission = async () => {
    if (Platform.OS === 'android') {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      if (alreadyGranted) {
        return true;
      }
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'Allow access to your contacts to add people to ledger.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        }
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Blocked',
          'Please enable contacts access in Settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open Settings', onPress: () => Linking.openSettings()},
          ]
        );
        return false;
      }
      return false;
    }

    const permission = await Contacts.requestPermission();
    return permission === 'authorized';
  };

  const getContactName = contact => {
    const fullName = [contact.givenName, contact.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact.displayName || 'Unnamed Contact';
  };

  const getContactPhone = contact => {
    const phone = contact.phoneNumbers?.find(item =>
      String(item.number || '').trim()
    )?.number;
    return phone || 'No phone number';
  };

  const isContactAdded = contact =>
    contacts.some(item => item.recordID === contact.recordID);

  const loadDeviceContacts = async () => {
    if (loadingContacts) {
      return;
    }
    setLoadingContacts(true);
    try {
      const granted = await requestContactsPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow contacts access.');
        setContactsModalVisible(false);
        return;
      }
      const fetcher = Contacts.getAllWithoutPhotos || Contacts.getAll;
      const list = await fetcher();
      const filtered = list.filter(contact => {
        const hasPhone = contact.phoneNumbers?.some(item =>
          String(item.number || '').trim()
        );
        const hasName = [contact.displayName, contact.givenName, contact.familyName]
          .some(value => String(value || '').trim());
        return hasPhone && hasName;
      });
      const sorted = filtered.sort((a, b) =>
        getContactName(a).localeCompare(getContactName(b))
      );
      setContactOptions(sorted);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const openContactsModal = () => {
    setContactsModalVisible(true);
    setContactSearch('');
    if (contactOptions.length === 0) {
      loadDeviceContacts();
    }
  };

  const closeContactsModal = () => {
    setContactsModalVisible(false);
  };

  const handleAddContact = contact => {
    setContacts(prev => {
      if (prev.some(item => item.recordID === contact.recordID)) {
        return prev;
      }
      const next = [...prev, contact];
      return next.sort((a, b) =>
        getContactName(a).localeCompare(getContactName(b))
      );
    });
    setContactsModalVisible(false);
  };

  const normalizedSearch = contactSearch.trim().toLowerCase();
  const filteredContactOptions = normalizedSearch
    ? contactOptions.filter(item => {
        const name = getContactName(item).toLowerCase();
        const phone = getContactPhone(item).toLowerCase();
        return name.includes(normalizedSearch) || phone.includes(normalizedSearch);
      })
    : contactOptions;

  const renderContact = ({item}) => {
    const name = getContactName(item);
    const phone = getContactPhone(item);
    return (
      <View style={styles.contactRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactDetails}>
          <Text style={styles.contactName} numberOfLines={1}>
            {name || 'Unnamed Contact'}
          </Text>
          <Text style={styles.contactPhone} numberOfLines={1}>
            {phone}
          </Text>
        </View>
      </View>
    );
  };

  const renderContactOption = ({item}) => {
    const name = getContactName(item);
    const phone = getContactPhone(item);
    const added = isContactAdded(item);
    return (
      <TouchableOpacity
        style={[styles.contactRow, added && styles.contactRowDisabled]}
        onPress={() => handleAddContact(item)}
        disabled={added}
        activeOpacity={0.7}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactDetails}>
          <Text style={styles.contactName} numberOfLines={1}>
            {name || 'Unnamed Contact'}
          </Text>
          <Text style={styles.contactPhone} numberOfLines={1}>
            {phone}
          </Text>
        </View>
        <View style={styles.contactAction}>
          {added ? (
            <Text style={styles.contactAddedText}>Added</Text>
          ) : (
            <Icon name="add-circle-outline" size={20} color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {contacts.length > 0 ? (
        <FlatList
          data={contacts}
          keyExtractor={item => String(item.recordID)}
          renderItem={renderContact}
          contentContainerStyle={styles.contactsList}
        />
      ) : (
        <ScrollView style={styles.scrollView}>
          <View style={styles.emptyContainer}>
            <Icon
              name="people-outline"
              size={64}
              color={colors.text.light}
            />
            <Text style={styles.emptyText}>
              No contacts added yet
            </Text>
            <Text style={styles.emptySubText}>
              Tap the add button to choose from contacts
            </Text>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={contactsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeContactsModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeContactsModal}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={closeContactsModal}>
                <Icon name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Icon name="search" size={18} color={colors.text.secondary} />
              <TextInput
                style={styles.modalSearchInput}
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder="Search by name or number"
                placeholderTextColor={colors.text.light}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {loadingContacts ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : filteredContactOptions.length > 0 ? (
              <FlatList
                data={filteredContactOptions}
                keyExtractor={item => String(item.recordID)}
                renderItem={renderContactOption}
                contentContainerStyle={styles.modalList}
              />
            ) : (
              <View style={styles.modalEmpty}>
                <Icon name="people-outline" size={48} color={colors.text.light} />
                <Text style={styles.modalEmptyText}>
                  {normalizedSearch ? 'No matches found' : 'No contacts found'}
                </Text>
                <Text style={styles.modalEmptySubText}>
                  {normalizedSearch
                    ? 'Try a different name or number'
                    : 'Try again or check contacts permission'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={openContactsModal}>
        <Icon name="person-add" size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubText: {
    fontSize: fontSize.medium,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.medium,
    color: colors.text.secondary,
  },
  contactsList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactAvatarText: {
    color: colors.white,
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
  },
  contactDetails: {
    flex: 1,
    minWidth: 0,
  },
  contactRowDisabled: {
    opacity: 0.6,
  },
  contactName: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  contactPhone: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: 2,
  },
  contactAction: {
    marginLeft: spacing.sm,
  },
  contactAddedText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    paddingVertical: 4,
  },
  modalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  modalClose: {
    padding: 4,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  modalEmptyText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  modalEmptySubText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default LedgerScreen;
