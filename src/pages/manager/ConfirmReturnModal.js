import React, { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiX } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/Modal';

const ConfirmReturnModal = ({ isOpen, onClose, returnData, onConfirmed }) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Format date
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Handle initial confirmation button click
  const handleConfirmClick = () => {
    setShowConfirmation(true);
  };

  // Handle final confirmation (Yes button)
  const handleFinalConfirmation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${SummaryApi.confirmReturnedInventory.url}/${returnData.id}`, {
        method: SummaryApi.confirmReturnedInventory.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Inventory return confirmed successfully');
        if (onConfirmed) onConfirmed();
        onClose();
      } else {
        setError(data.message || 'Failed to confirm inventory return');
        setShowConfirmation(false);
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error confirming inventory return:', err);
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Returned Inventory"
      size="lg"
    >
      {!showConfirmation ? (
        // First screen - Review returned items
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}
          
          <div className="mb-4 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Inventory Returned by {returnData?.technician.name}
              </h3>
              <p className="text-sm text-gray-500">
                Returned on {formatDate(returnData?.returnedAt)}
              </p>
            </div>
            <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full flex items-center">
              <FiAlertTriangle className="mr-1" />
              Pending
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">Items to be confirmed:</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returnData?.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'serialized-product' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.type === 'serialized-product' ? 'Serialized' : 'Generic'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                        {item.quantity} {item.unit || 'units'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.serialNumber ? (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                            {item.serialNumber}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="border-t pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none flex items-center"
            >
              <FiCheckCircle className="mr-2" />
              Confirm Return
            </button>
          </div>
        </div>
      ) : (
        // Second screen - Final confirmation
        <div className="p-4">
          <div className="flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <FiAlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
            
            <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
              Confirm Inventory Return
            </h3>
            
            <p className="text-center text-gray-500 mb-6">
              Are you sure you want to confirm the return of these items? 
              This will add them back to your branch inventory.
            </p>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                disabled={loading}
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalConfirmation}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none flex items-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="mr-2" />
                    Yes, Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ConfirmReturnModal;