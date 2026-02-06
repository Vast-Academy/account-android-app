import React, {useState} from 'react';
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
import {useToast} from '../hooks/useToast';

const QuestionAnswerScreen = ({navigation, route}) => {
  const {question, category} = route.params || {};
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const {showToast} = useToast();

  if (!question) {
    return (
      <View style={styles.container}>
        <Text>Question not found</Text>
      </View>
    );
  }

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleFeedback = (isHelpful) => {
    setFeedbackGiven(isHelpful);
    const message = isHelpful
      ? 'Glad we could help!'
      : 'We\'ll improve this answer';
    showToast(message, 'success');
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
        <View style={styles.mainBox}>
          <Text style={styles.questionHeading}>{question.question}</Text>

          <Text style={styles.answerText}>{question.answer}</Text>

          <View style={styles.divider} />

          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>Was this helpful?</Text>
            <View style={styles.feedbackButtonRow}>
              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  feedbackGiven === true && styles.feedbackButtonActive,
                ]}
                onPress={() => handleFeedback(true)}
                activeOpacity={0.7}>
                <Icon
                  name="thumbs-up"
                  size={20}
                  color={feedbackGiven === true ? colors.primary : colors.text.light}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  feedbackGiven === false && styles.feedbackButtonActive,
                ]}
                onPress={() => handleFeedback(false)}
                activeOpacity={0.7}>
                <Icon
                  name="thumbs-down"
                  size={20}
                  color={feedbackGiven === false ? colors.primary : colors.text.light}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

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
  mainBox: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionHeading: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  answerText: {
    fontSize: fontSize.regular,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackSection: {
    alignItems: 'center',
  },
  feedbackLabel: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontWeight: fontWeight.medium,
  },
  feedbackButtonRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  feedbackButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  feedbackButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: colors.primary,
  },
  bottomSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
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

export default QuestionAnswerScreen;
