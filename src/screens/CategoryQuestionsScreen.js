import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const CategoryQuestionsScreen = ({navigation, route}) => {
  const {category} = route.params || {};

  if (!category) {
    return (
      <View style={styles.container}>
        <Text>Category not found</Text>
      </View>
    );
  }

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleQuestionPress = (question) => {
    navigation.navigate('QuestionAnswer', {question, category});
  };

  const handleWhatsAppPress = () => {
    const phoneNumber = '9356393094';
    const message = 'Hello, I would like to learn about Savingo.';
    const whatsappURL = `whatsapp://send?phone=91${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappURL).catch(err =>
      Alert.alert('Error', 'WhatsApp is not installed on your device.')
    );
  };

  const handleCallPress = () => {
    Linking.openURL('tel:9356393094').catch(err =>
      Alert.alert('Error', 'Unable to make call.')
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="Go back">
          <Icon name="chevron-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {category.questions.map(question => (
          <TouchableOpacity
            key={question.id}
            style={styles.questionCard}
            onPress={() => handleQuestionPress(question)}
            activeOpacity={0.75}>
            <Text style={styles.questionText}>{question.question}</Text>
            <Icon
              name="chevron-forward"
              size={20}
              color={colors.text.light}
            />
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>Didn't find your question?</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.contactButton, styles.whatsappButton]}
              onPress={handleWhatsAppPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Chat with us on WhatsApp">
              <Icon name="logo-whatsapp" size={18} color={colors.white} />
              <Text style={styles.buttonText}>CHAT WITH US</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, styles.callButton]}
              onPress={handleCallPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Call us">
              <Icon name="call" size={18} color={colors.white} />
              <Text style={styles.buttonText}>CALL US</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionText: {
    flex: 1,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    lineHeight: 20,
    marginRight: spacing.sm,
  },
  bottomSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomText: {
    fontSize: fontSize.small,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: spacing.xs,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  callButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});

export default CategoryQuestionsScreen;
