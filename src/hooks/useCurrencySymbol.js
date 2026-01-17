import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';

const DEFAULT_CURRENCY_SYMBOL = '\u20B9';

const getSymbolFromUser = userData => {
  return (
    userData?.currencySymbol ||
    userData?.currency ||
    userData?.currency_symbol ||
    DEFAULT_CURRENCY_SYMBOL
  );
};

export const useCurrencySymbol = () => {
  const [currencySymbol, setCurrencySymbol] = React.useState(
    DEFAULT_CURRENCY_SYMBOL
  );

  const loadCurrencySymbol = React.useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setCurrencySymbol(getSymbolFromUser(userData));
        return;
      }
    } catch (error) {
      console.error('Failed to load currency symbol:', error);
    }
    setCurrencySymbol(DEFAULT_CURRENCY_SYMBOL);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadCurrencySymbol();
    }, [loadCurrencySymbol])
  );

  return currencySymbol;
};

export const DEFAULT_CURRENCY = DEFAULT_CURRENCY_SYMBOL;

