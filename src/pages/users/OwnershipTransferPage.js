import React, { useState, useEffect } from 'react';
import { FiUsers, FiArrowRight } from 'react-icons/fi';
import Modal from '../../components/Modal';
import SummaryApi from '../../common';
import { FiAlertCircle } from "react-icons/fi";

const OwnershipTransferPage = () => {
  const [newManagers, setNewManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [rejectedTransfers, setRejectedTransfers] = useState([]);

  useEffect(() => {
    fetchNewManagers();
    fetchRejectedTransfers();
  }, []);

  const fetchNewManagers = async () => {
    try {
      setLoading(true);
      const response = await fetch(SummaryApi.getNewBranchManagers.url, {
        method: SummaryApi.getNewBranchManagers.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setNewManagers(data.data || []);
      } else {
        setError(data.message || 'Failed to fetch new managers');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching new managers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferClick = (manager) => {
    setSelectedManager(manager);
    setTransferModalOpen(true);
  };

  const initiateTransfer = async () => {
    if (!selectedManager) return;

    try {
      setSubmitting(true);
      const response = await fetch(SummaryApi.initiateTransfer.url, {
        method: SummaryApi.initiateTransfer.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newManagerId: selectedManager._id,
          message: transferMessage
        })
      });

      const requestBody = {
        newManagerId: selectedManager._id,
        message: transferMessage
      };
      console.log('Sending transfer request:', requestBody);

      const data = await response.json();

      if (!response.ok) {
        // HTTP ऐरर स्टेटस
        throw new Error(data.message || `Error: ${response.status} ${response.statusText}`);
      }
      

      if (data.success) {
        setSuccessMessage(`Transfer request sent to ${selectedManager.firstName} ${selectedManager.lastName}`);
        setTransferModalOpen(false);
        // Remove this manager from the list
        setNewManagers(prev => prev.filter(m => m._id !== selectedManager._id));
        setSelectedManager(null);
        setTransferMessage('');
      } else {
        setError(data.message || 'Failed to initiate transfer');
      }
    } catch (err) {
      console.error('Error details:', err);
      setError('Server error. Please try again later.');
      console.error('Error initiating transfer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchRejectedTransfers = async () => {
    try {
      const response = await fetch(SummaryApi.getRejectedTransfers.url, {
        method: SummaryApi.getRejectedTransfers.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setRejectedTransfers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching rejected transfers:', err);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Ownership Transfer</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
          {successMessage}
        </div>
      )}

{rejectedTransfers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-yellow-800 flex items-center">
            <FiAlertCircle className="mr-2" /> Previously Rejected Transfers
          </h3>
          
          <div className="mt-3 space-y-3">
            {rejectedTransfers.map(transfer => (
              <div key={transfer._id} className="bg-white rounded p-3 border border-yellow-100">
                <p className="text-sm text-gray-600">
                  Your transfer request to <span className="font-medium">{transfer.newManager.firstName} {transfer.newManager.lastName}</span> was rejected on {new Date(transfer.rejectedAt).toLocaleDateString()}.
                </p>
                <p className="text-sm mt-1">
                  <span className="font-medium">Reason:</span> {transfer.rejectReason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-800 mb-4">
          New Managers Awaiting Ownership Transfer
        </h2>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : newManagers.length === 0 ? (
          <div className="text-gray-500">No new managers found for your branch.</div>
        ) : (
          <div className="grid gap-4">
            {newManagers.map(manager => (
              <div 
                key={manager._id}
                className="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 mr-3">
                    <FiUsers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">
                      {manager.firstName} {manager.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{manager.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleTransferClick(manager)}
                  className="px-3 py-1 bg-indigo-600 text-white rounded flex items-center text-sm"
                >
                  Transfer <FiArrowRight className="ml-1" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {transferModalOpen && selectedManager && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title="Transfer Ownership"
          size="md"
        >
          <div className="py-2">
            <p className="mb-4">
              You are about to transfer branch ownership to:
              <span className="font-medium block mt-1">
                {selectedManager.firstName} {selectedManager.lastName}
              </span>
            </p>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="transferMessage">
                Message (optional)
              </label>
              <textarea
                id="transferMessage"
                value={transferMessage}
                onChange={(e) => setTransferMessage(e.target.value)}
                placeholder="Add a message for the new manager..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows="4"
              />
            </div>
            
            <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md mb-4">
              <p className="font-medium">Important:</p>
              <p className="text-sm">
                After transferring ownership, you will no longer have access to manage this branch.
                This action cannot be undone.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setTransferModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={initiateTransfer}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {submitting ? 'Processing...' : 'Request Transfer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnershipTransferPage;