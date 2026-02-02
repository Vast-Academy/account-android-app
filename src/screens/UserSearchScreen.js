import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, fontSize} from '../utils/theme';
import {searchUsers} from '../services/userProfileService';
import {createConversation} from '../services/chatDatabase';

const UserSearchScreen = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const results = await searchUsers(searchQuery, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (user) => {
    try {
      // Create or get conversation
      const conversationId = createConversation(user.userId, {
        username: user.username,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL,
      });

      // Navigate to chat conversation screen
      navigation.navigate('ChatConversation', {
        conversationId,
        otherUserId: user.userId,
        otherUserName: user.displayName,
        otherUserUsername: user.username,
        otherUserPhoto: user.photoURL,
      });
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const renderUserItem = ({item}) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleStartChat(item)}>
      <View style={styles.userAvatar}>
        {item.photoURL ? (
          <Image source={{uri: item.photoURL}} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.displayName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
        {item.phoneNumber && item.privacy?.phoneNumberVisible && (
          <Text style={styles.userPhone}>{item.phoneNumber}</Text>
        )}
      </View>
      <Icon name="chevron-forward" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Chat</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username or phone..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.searchButton,
            !searchQuery.trim() && styles.searchButtonDisabled,
          ]}
          onPress={handleSearch}
          disabled={!searchQuery.trim()}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searched && searchResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="person-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyText}>
            Try searching with a different username or phone number
          </Text>
        </View>
      ) : !searched ? (
        <View style={styles.centerContainer}>
          <Icon name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Find people to chat with</Text>
          <Text style={styles.emptyText}>
            Search by username or phone number to start a conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={item => item.userId}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.medium,
    color: colors.text,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: fontSize.medium,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: fontSize.medium,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: fontSize.small,
    color: colors.primary,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
});

export default UserSearchScreen;
