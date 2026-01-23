import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import SummaryApi from '../common';
import { useNavigate } from 'react-router-dom';

const ManagerStatusChecker = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [transferRejectedInfo, setTransferRejectedInfo] = useState(null);

  useEffect(() => {
    // Only check for managers
    if (user && user.role === 'manager') {
      checkManagerStatus();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

 // Clear rejection notification
 const clearRejectionInfo = () => {
  setTransferRejectedInfo(null);
  // Optionally reload to refresh the data
  window.location.reload();
};

  const checkManagerStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(SummaryApi.checkManagerStatus.url, {
        method: SummaryApi.checkManagerStatus.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      // console.log('Status data received:', data);

      if (data.success) {
        setStatusData(data.data);

        // Check for rejected transfers for the old manager
        if (data.data.rejectedTransfers && data.data.rejectedTransfers.length > 0) {
          setTransferRejectedInfo(data.data.rejectedTransfers[0]);
        }
      } else {
        setError(data.message || 'Failed to check manager status');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error checking manager status:', err);
    } finally {
      setLoading(false);
    }
  };

  const acceptTransfer = async (transferId) => {
    try {
      if (!responseMessage.trim()) {
        alert('Please add a response message for the current manager.');
        return;
      }
      
      setLoading(true);
      
      // console.log('Accepting transfer with ID:', transferId);
      
      const response = await fetch(`${SummaryApi.acceptTransfer.url}/${transferId}`, {
        method: SummaryApi.acceptTransfer.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseMessage })
      });

      const data = await response.json();
      // console.log('Accept transfer response:', data);

      if (data.success) {
        // Update local state
        setStatusData(prev => ({
          ...prev,
          activeManagerStatus: 'active',
          transfer: null
        }));
        
        // Reload the page to ensure UI is updated correctly
        window.location.reload();
      } else {
        setError(data.message || 'Failed to accept transfer');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error accepting transfer:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const rejectTransfer = async (transferId) => {
    try {
      if (!rejectReason.trim()) {
        alert('Please provide a reason for rejecting the transfer.');
        return;
      }
      
      setLoading(true);
      
      // console.log('Rejecting transfer with ID:', transferId);
      
      const response = await fetch(`${SummaryApi.rejectTransfer.url}/${transferId}`, {
        method: SummaryApi.rejectTransfer.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectReason })
      });

      const data = await response.json();
      // console.log('Reject transfer response:', data);

      if (data.success) {
        // Update local state
        setStatusData(prev => ({
          ...prev,
          transfer: null
        }));
        
        // Clear the reject reason
        setRejectReason('');
        setShowRejectForm(false);
        
        // Reload the page to ensure UI is updated correctly
        window.location.reload();
      } else {
        setError(data.message || 'Failed to reject transfer');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error rejecting transfer:', err);
    } finally {
      setLoading(false);
    }
  };

   // Don't render anything if not a manager or still loading
   if (!user || user.role !== 'manager' || loading) {
    return null;
  }

  // No modals needed if there's no data
  if (!statusData) {
    return null;
  }

  // console.log('Rendering modal for user:', user._id);
  // console.log('Status data:', statusData);
  
  // Show rejected transfer notification for old manager
  if (transferRejectedInfo) {
    return (
      <Modal 
        isOpen={true}
        onClose={clearRejectionInfo}
        title="Transfer Request Rejected"
        size="md"
      >
        <div className="py-4">
          <p className="mb-4">
            Your ownership transfer request to {transferRejectedInfo.newManager.firstName} {transferRejectedInfo.newManager.lastName} was rejected.
          </p>
          
          <div className="mb-4 p-3 bg-gray-100 rounded-lg">
            <p className="font-medium text-sm text-gray-500 mb-1">Reason for rejection:</p>
            <p className="text-gray-700">{transferRejectedInfo.rejectReason}</p>
          </div>
          
          <p className="mb-4">
            You can now initiate a new transfer request if needed.
          </p>
          
          <div className="flex justify-end">
            <button
              onClick={clearRejectionInfo}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Understood
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  
  // For active manager with no pending transfers, don't show modal
  if (statusData.activeManagerStatus === 'active' && !statusData.transfer) {
    return null;
  }
  
  // For transferred manager
  if (statusData.activeManagerStatus === 'transferring' || statusData.activeManagerStatus === 'transferred') {
    console.log('Showing transferred manager modal');
    
    const transferInfo = statusData.completedTransfer || {};
    const responseMsg = transferInfo.responseMessage || '';
    
    return (
      <Modal 
        isOpen={true} 
        onClose={() => {}} // Empty function to prevent closing
        title="Ownership Transferred"
        size="md"
      >
        <div className="py-4">
          <p className="mb-4">
            You have transferred ownership of this branch to another manager.
          </p>
          
          {responseMsg && (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg">
              <p className="font-medium text-sm text-gray-500 mb-1">Message from new manager:</p>
              <p className="text-gray-700">{responseMsg}</p>
            </div>
          )}
          
          <p className="mb-4">
            Your access to manage this branch has been revoked. Please contact an administrator
            if you need to be assigned to a different branch.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  
  // For new manager with pending transfer to accept
  if (statusData.transfer && 
      statusData.transfer.newManager && 
      String(statusData.transfer.newManager) === String(user._id)) {
    console.log('Showing transfer acceptance modal');
    
    // If showing reject form
    if (showRejectForm) {
      return (
        <Modal 
          isOpen={true} 
          onClose={() => setShowRejectForm(false)} 
          title="Reject Ownership Transfer"
          size="md"
        >
          <div className="py-4">
            <p className="mb-4">
              Please provide a reason for rejecting the transfer request from {statusData.transfer.oldManager.firstName} {statusData.transfer.oldManager.lastName}.
            </p>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="rejectReason">
                Reason for Rejection *
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows="4"
                placeholder="Please explain why you're rejecting this transfer request..."
                required
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectTransfer(statusData.transfer._id)}
                disabled={loading || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      );
    }
    
    return (
      <Modal 
        isOpen={true} 
        onClose={() => {}} // Empty function to prevent closing
        title="Ownership Transfer Request"
        size="md"
      >
        <div className="py-4">
          <p className="mb-4">
            {statusData.transfer.oldManager.firstName} {statusData.transfer.oldManager.lastName} has requested to transfer the branch ownership to you.
          </p>
          
          {statusData.transfer.message && (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg">
              <p className="font-medium text-sm text-gray-500 mb-1">Message:</p>
              <p className="text-gray-700">{statusData.transfer.message}</p>
            </div>
          )}
          
          <p className="mb-6">
            Do you want to accept this ownership transfer and become the active manager of this branch?
          </p>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="responseMessage">
              Response Message *
            </label>
            <textarea
              id="responseMessage"
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows="3"
              placeholder="Add a message for the current manager..."
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowRejectForm(true)}
              className="px-4 py-2 border border-gray-300 rounded-md text-red-600 hover:bg-red-50"
            >
              Reject Transfer
            </button>
            <button
              onClick={() => acceptTransfer(statusData.transfer._id)}
              disabled={loading || !responseMessage.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Accept Transfer'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  
  // For pending manager (default case)
  console.log('Showing pending account access modal');
  return (
    <Modal 
      isOpen={true} 
      onClose={() => {}} // Empty function to prevent closing
      title="Account Access Pending"
      size="md"
    >
      <div className="py-4">
        <p className="mb-4">
          Your account has been created, but you don't have full access yet.
        </p>
        <p className="mb-4">
          The current manager needs to transfer ownership to you before you can use the system.
        </p>
        <p className="mb-4">
          Please contact the current manager or the administrator for assistance.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ManagerStatusChecker;