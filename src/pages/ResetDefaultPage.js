import React, { useState } from 'react';
import SummaryApi from '../common';

const ResetDefaultPage = () => {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState({ success: false, message: '' });

  const handlePasswordCheck = () => {
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    
    if (password === 'bhopadi@123') {
      setPasswordError('');
      setShowConfirmation(true);
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      setResetStatus({ success: false, message: '' });
      
      const response = await fetch(SummaryApi.resetSystem.url, {
        method: SummaryApi.resetSystem.method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResetStatus({
          success: true,
          message: 'System reset successfully. You will be redirected to login.'
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        setResetStatus({
          success: false,
          message: data.message || 'Failed to reset system'
        });
      }
    } catch (error) {
      console.error('Reset error:', error);
      setResetStatus({
        success: false,
        message: 'An error occurred during system reset'
      });
    } finally {
      setIsResetting(false);
      setShowConfirmation(false);
    }
  };

  const handleCancelReset = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-red-600 p-4">
          <h1 className="text-xl font-bold text-white text-center">Reset System to Default</h1>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              This action will reset the system to its default state. All data except for a default admin account will be deleted.
            </p>
            <p className="text-red-600 font-semibold mb-4">
              Warning: This action cannot be undone!
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Enter Security Password:
            </label>
            <input
              className={`shadow appearance-none border ${passwordError ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
              id="password"
              type="password"
              placeholder="Enter password to proceed"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {passwordError && (
              <p className="text-red-500 text-xs italic mt-1">{passwordError}</p>
            )}
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={handlePasswordCheck}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
            >
              Reset To Default
            </button>
          </div>
          
          {resetStatus.message && (
            <div className={`mt-4 p-3 rounded ${resetStatus.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {resetStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCancelReset}></div>
            
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
              </div>
              
              <h3 className="text-lg font-medium leading-6 text-gray-900 text-center">
                Are you absolutely sure?
              </h3>
              
              <div className="mt-3">
                <p className="text-sm text-gray-500">
                  This will permanently delete all data in your CRM system except for a single admin account. This action <span className="font-bold">cannot</span> be undone.
                </p>
              </div>
              
              <div className="mt-6 flex justify-center space-x-4">
                <button
                  type="button"
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none"
                  onClick={handleCancelReset}
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none"
                  onClick={handleConfirmReset}
                >
                  {isResetting ? 'Resetting...' : 'Yes, Reset System'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResetDefaultPage;