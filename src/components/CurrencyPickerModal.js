import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const CURRENCIES = [
  {label: 'Rupee', symbol: '\u20B9'},
  {label: 'Dollar', symbol: '$'},
  {label: 'Euro', symbol: '\u20AC'},
  {label: 'Pound', symbol: '\u00A3'},
  {label: 'Yen', symbol: '\u00A5'},
  {label: 'Won', symbol: '\u20A9'},
  {label: 'Ruble', symbol: '\u20BD'},
  {label: 'Lira', symbol: '\u20BA'},
  {label: 'Taka', symbol: '\u09F3'},
  {label: 'Peso', symbol: '\u20B1'},
];
const LOOPING_CURRENCIES = [...CURRENCIES, ...CURRENCIES, ...CURRENCIES];

const CurrencyPickerModal = ({
  visible,
  onClose,
  onSelect,
  currentSymbol,
  isSaving = false,
}) => {
  const [selectedCurrency, setSelectedCurrency] = React.useState(
    CURRENCIES.find(c => c.symbol === currentSymbol) || CURRENCIES[0]
  );
  const flatListRef = React.useRef(null);
  const itemHeight = 60;
  const viewHeight = 300;
  const isScrolling = React.useRef(false);

  const getInitialScrollIndex = () => {
    const baseIndex = CURRENCIES.findIndex(
      c => c.symbol === (currentSymbol || '\u20B9')
    );
    return baseIndex + CURRENCIES.length;
  };

  React.useEffect(() => {
    if (visible && flatListRef.current) {
      const initialIndex = getInitialScrollIndex();
      setTimeout(
        () =>
          flatListRef.current.scrollToOffset({
            offset: initialIndex * itemHeight,
            animated: false,
          }),
        100
      );
    }
  }, [visible, currentSymbol]);

  React.useEffect(() => {
    if (!visible) {
      return;
    }
    const nextSelected =
      CURRENCIES.find(c => c.symbol === currentSymbol) || CURRENCIES[0];
    setSelectedCurrency(nextSelected);
  }, [visible, currentSymbol]);

  const handleMomentumScrollEnd = event => {
    isScrolling.current = false;
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);

    if (index < CURRENCIES.length) {
      const newIndex = index + CURRENCIES.length;
      flatListRef.current.scrollToOffset({
        offset: newIndex * itemHeight,
        animated: false,
      });
    } else if (index >= CURRENCIES.length * 2) {
      const newIndex = index - CURRENCIES.length;
      flatListRef.current.scrollToOffset({
        offset: newIndex * itemHeight,
        animated: false,
      });
    }
  };

  const renderItem = ({item}) => {
    const isSelected =
      selectedCurrency.symbol === item.symbol &&
      selectedCurrency.label === item.label;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedCurrency(item);
          if (onSelect) {
            onSelect(item);
          }
        }}
        disabled={isSaving || isScrolling.current}>
        <View style={[styles.currencyItem, {height: itemHeight}]}
        >
          <Text
            style={[
              styles.currencySymbol,
              isSelected && styles.currencySymbolSelected,
            ]}>
            {item.symbol}
          </Text>
          <Text
            style={[
              styles.currencyLabel,
              isSelected && styles.currencyLabelSelected,
            ]}>
            {item.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.currencyModalOverlay}>
        <TouchableOpacity style={styles.previewBackdrop} onPress={onClose} />
        <View style={styles.currencyModalContent}>
          <Text style={styles.bottomSheetTitle}>Select Currency</Text>
          <View style={[styles.currencyPickerContainer, {height: viewHeight}]}
          >
            <Animated.FlatList
              ref={flatListRef}
              data={LOOPING_CURRENCIES}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.symbol}-${index}`}
              showsVerticalScrollIndicator={false}
              snapToInterval={itemHeight}
              decelerationRate="fast"
              onScrollBeginDrag={() => {
                isScrolling.current = true;
              }}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              getItemLayout={(_data, index) => ({
                length: itemHeight,
                offset: itemHeight * index,
                index,
              })}
              contentContainerStyle={{
                paddingTop: (viewHeight - itemHeight) / 2,
                paddingBottom: (viewHeight - itemHeight) / 2,
              }}
            />
          </View>
          {isSaving && (
            <ActivityIndicator
              style={{marginTop: spacing.md}}
              color={colors.primary}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  currencyModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  bottomSheetTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currencyPickerContainer: {
    alignSelf: 'center',
    width: '100%',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  currencySymbol: {
    fontSize: fontSize.xxlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
    width: 80,
    textAlign: 'center',
  },
  currencySymbolSelected: {
    color: colors.primary,
  },
  currencyLabel: {
    flex: 1,
    fontSize: fontSize.regular,
    color: colors.text.secondary,
  },
  currencyLabelSelected: {
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
});

export {CURRENCIES};
export default CurrencyPickerModal;
