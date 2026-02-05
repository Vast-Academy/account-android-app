import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const CollapsibleMenuItem = ({title, icon, onPress}) => {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.iconPlaceholder} />
      <Text style={styles.menuText}>{title}</Text>
      <Icon
        name="chevron-forward"
        size={20}
        color={colors.text.light}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    marginRight: spacing.md,
  },
  menuText: {
    flex: 1,
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
});

export default CollapsibleMenuItem;
