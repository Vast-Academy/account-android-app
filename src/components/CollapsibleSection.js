import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CollapsibleSection = ({
  title,
  icon,
  children,
  initialExpanded = false,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const animatedHeight = React.useRef(new Animated.Value(initialExpanded ? 1 : 0)).current;
  const contentRef = React.useRef(null);

  const handleToggle = () => {
    setExpanded(!expanded);
    if (onToggle) {
      onToggle(!expanded);
    }
  };

  React.useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded, animatedHeight]);

  const handleContentLayout = event => {
    const {height} = event.nativeEvent.layout;
    if (height > 0) {
      setContentHeight(height);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {expanded ? (
          <Icon
            name="chevron-down"
            size={20}
            color={colors.text.secondary}
          />
        ) : (
          <Icon
            name="chevron-forward"
            size={20}
            color={colors.text.secondary}
          />
        )}
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.contentWrapper,
          {
            maxHeight: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, contentHeight || 500],
            }),
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}>
        <View
          ref={contentRef}
          style={styles.content}
          onLayout={handleContentLayout}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  contentWrapper: {
    overflow: 'hidden',
  },
  content: {
    backgroundColor: colors.white,
  },
});

export default CollapsibleSection;
