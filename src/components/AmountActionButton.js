import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const VARIANTS = {
  neutralOutline: {
    borderColor: '#E5E7EB',
    textColor: '#111827',
    backgroundColor: '#FFFFFF',
  },
  successOutline: {
    borderColor: '#4ADE80',
    textColor: '#16A34A',
    backgroundColor: '#FFFFFF',
  },
  dangerOutline: {
    borderColor: '#FECACA',
    textColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  primaryOutline: {
    borderColor: '#BFDBFE',
    textColor: '#1D4ED8',
    backgroundColor: '#FFFFFF',
  },
};

const AmountActionButton = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'neutralOutline',
  style,
  textStyle,
  activityColor,
}) => {
  const variantStyles = VARIANTS[variant] ?? VARIANTS.neutralOutline;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          borderColor: variantStyles.borderColor,
          backgroundColor: variantStyles.backgroundColor,
        },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}>
      {loading ? (
        <ActivityIndicator color={activityColor ?? variantStyles.textColor} />
      ) : (
        <Text style={[styles.text, {color: variantStyles.textColor}, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default AmountActionButton;

