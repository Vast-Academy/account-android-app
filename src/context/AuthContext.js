import React, { createContext, useState, useContext } from 'react';
import SummaryApi from '../common';
// Create context
const AuthContext = createContext();
// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [loading, setLoading] = useState(false);
  
  // Login function
  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await fetch(SummaryApi.logIn.url, {
        method: SummaryApi.logIn.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
     
      const data = await response.json();
     
      if (data.success) {
        // Store user data in localStorage and state
        localStorage.setItem('user', JSON.stringify(data.data));
        setUser(data.data);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Server error' };
    } finally {
      setLoading(false);
    }
  };
  // Logout function
  const logout = async () => {
    try {
      // Clear user from localStorage and state
      localStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // New function to update user context
  const updateUserContext = (updatedUserData) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updatedUserData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Context values to be provided
  const value = {
    user,
    loading,
    login,
    logout,
    updateUserContext,
    isAuthenticated: !!user
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};