import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';

const ProductReplacementModal = ({ isOpen, onClose, replacementData, onCompleteReplacement }) => {
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !replacementData) return null;

  const { productDetails } = replacementData;
  
  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle complete replacement
  const handleCompleteReplacement = () => {
    // Validate inputs
    if (!newSerialNumber.trim()) {
      setError('New serial number is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Call the parent handler to complete the replacement
    onCompleteReplacement({
      replacementId: replacementData._id,
      originalSerialNumber: replacementData.serialNumber,
      newSerialNumber: newSerialNumber.trim()
    });
  };

  // Check if the product has already been replaced
  const isReplaced = replacementData.status === 'replaced';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Product Warranty Details</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <FiX size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {/* Original Product Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium bg-gray-100 p-2 rounded">Original</h3>
            <div className="mt-2">
              <div className="mb-2">
                <p className="text-sm text-gray-500">S/N:</p>
                <p className="font-medium">{productDetails.serialNumber}</p>
              </div>
              
              {/* Two-column grid for Product and Customer */}
              <div className="grid grid-cols-2 gap-4">
                {/* Product Column */}
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="font-medium">{productDetails.productName}</p>
                  {productDetails.price && (
                    <p className="text-sm">Price: ₹{productDetails.price.toFixed(2)}</p>
                  )}
                </div>
                
                {/* Customer Column */}
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{productDetails.customerName}</p>
                  {productDetails.customerPhone && (
                    <p className="text-sm">Phone: {productDetails.customerPhone}</p>
                  )}
                </div>
              </div>
              
              {/* Two-column grid for Installation and Warranty */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Installation Column */}
                <div>
                  <p className="text-sm text-gray-500">Installation</p>
                  <p className="text-sm">
                    Date: {productDetails.installationDate 
                      ? formatDate(productDetails.installationDate)
                      : 'Unknown'
                    }
                  </p>
                  <p className="text-sm">
                    Tech: {productDetails.technicianName || 'Unknown'}
                  </p>
                </div>
                
                {/* Warranty Column */}
                <div>
                  <p className="text-sm text-gray-500">Warranty</p>
                  <p className="text-sm">
                    Period: {productDetails.warranty || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Issue Information */}
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-medium">Issue Information</h3>
            <div className="mt-2">
              <p className="text-sm">
                <span className="text-gray-500">Date:</span> {formatDate(replacementData.registeredAt)}
              </p>
              <p className="text-sm">
                <span className="text-gray-500">Issue:</span> {replacementData.issueDescription}
              </p>
              <p className="text-sm">
                <span className="text-gray-500">Checked By:</span> {replacementData.issueCheckedBy || 'Not specified'}
              </p>
              
              {/* Show replacement info if already replaced */}
              {isReplaced && replacementData.replacementSerialNumber && (
                <>
                  <p className="text-sm mt-2 text-green-600 font-medium">
                    <span className="text-gray-500">Replaced With:</span> {replacementData.replacementSerialNumber}
                  </p>
                  {replacementData.approvedAt && (
                    <p className="text-sm text-gray-500">
                      Replacement Date: {formatDate(replacementData.approvedAt)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* New Serial Number Input - Only show if not already replaced */}
          {!isReplaced && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Serial Number*
              </label>
              <input
                type="text"
                value={newSerialNumber}
                onChange={(e) => setNewSerialNumber(e.target.value)}
                placeholder="Enter new product serial number"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {error && (
                <div className="mt-3 bg-red-100 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
          
          {/* Only show Save Replacement button if not already replaced */}
          {!isReplaced && (
            <button 
              onClick={handleCompleteReplacement}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Save Replacement
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductReplacementModal;