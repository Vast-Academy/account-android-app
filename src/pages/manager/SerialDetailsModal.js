import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import LoadingSpinner from '../../components/LoadingSpinner';
import SummaryApi from '../../common';

const SerialDetailsModal = ({ isOpen, onClose, productDetails, onRegisterWarranty, replacementData, onCompleteReplacement, onUpdateWarranty  }) => {
  const [issueDescription, setIssueDescription] = useState('');
  const [issueCheckedBy, setIssueCheckedBy] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [step, setStep] = useState('details'); // 'details', 'register', 'replacement'
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replacementHistory, setReplacementHistory] = useState([]);

  useEffect(() => {
    // If replacementData exists, fetch replacement history
    if (replacementData && replacementData.serialNumber) {
      fetchReplacementHistory(replacementData.serialNumber);
    }
  }, [replacementData]);

  if (!isOpen || (!productDetails && !replacementData)) return null;

  const currentProductDetails = replacementData?.productDetails || productDetails;

  // Fetch replacement history
  const fetchReplacementHistory = async (serialNumber) => {
    try {
      const response = await fetch(`${SummaryApi.getReplacementHistory.url}/${serialNumber}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setReplacementHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching replacement history:', err);
    }
  };

  // Calculate warranty status
  const calculateWarrantyStatus = () => {
    // Your existing warranty calculation code
    if (!currentProductDetails.installationDate || !currentProductDetails.warranty) {
      return { isUnderWarranty: false, message: 'Unknown' };
    }

    const installDate = new Date(currentProductDetails.installationDate);
    const today = new Date();
    
    // Parse warranty period (e.g., "1 year", "6 months")
    let warrantyPeriodInDays = 0;
    const warrantyText = currentProductDetails.warranty.toLowerCase();
    
    if (warrantyText.includes('year')) {
      const years = parseInt(warrantyText.match(/\d+/)[0]);
      warrantyPeriodInDays = years * 365;
    } else if (warrantyText.includes('month')) {
      const months = parseInt(warrantyText.match(/\d+/)[0]);
      warrantyPeriodInDays = months * 30;
    } else if (warrantyText.includes('day')) {
      warrantyPeriodInDays = parseInt(warrantyText.match(/\d+/)[0]);
    }
    
    // If no warranty or "No Warranty"
    if (warrantyPeriodInDays === 0 || warrantyText.includes('no warranty')) {
      return { isUnderWarranty: false, message: 'No Warranty' };
    }
    
    const warrantyEndDate = new Date(installDate);
    warrantyEndDate.setDate(installDate.getDate() + warrantyPeriodInDays);
    
    const isUnderWarranty = today <= warrantyEndDate;
    
    // Calculate remaining days
    const remainingDays = Math.ceil((warrantyEndDate - today) / (1000 * 60 * 60 * 24));
    
    if (isUnderWarranty) {
      return { 
        isUnderWarranty: true, 
        message: `Under Warranty (${remainingDays} days remaining)`,
        endDate: warrantyEndDate.toLocaleDateString(),
        remainingDays: remainingDays
      };
    } else {
      return { 
        isUnderWarranty: false, 
        message: `Warranty Expired (${Math.abs(remainingDays)} days ago)`,
        endDate: warrantyEndDate.toLocaleDateString(),
        remainingDays: -Math.abs(remainingDays)
      };
    }
  };

  const warrantyStatus = calculateWarrantyStatus();

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle click on "Register New Warranty" button
  const handleStartRegister = () => {
    setStep('register');
    setIssueDescription('');
    setIssueCheckedBy('');
    setError('');
  };

  // Handle register warranty submission
  const handleRegisterWarranty = () => {
    // Validate
    if (!issueDescription.trim()) {
      setError('Please describe the issue to register warranty');
      return;
    }

    if (!issueCheckedBy.trim()) {
      setError('Please enter who checked the issue');
      return;
    }

    // If we're updating an existing replacement record (cycling)
  if (replacementData && replacementData.status === 'replaced') {
    // Call new API function to update existing record
    onUpdateWarranty({
      replacementId: replacementData._id,
      issueDescription: issueDescription,
      issueCheckedBy: issueCheckedBy
    });
  } else {
    // Normal flow for new warranty registration
    onRegisterWarranty({
      serialNumber: currentProductDetails.serialNumber,
      productName: currentProductDetails.productName,
      customerName: currentProductDetails.customerName,
      customerPhone: currentProductDetails.customerPhone, 
      workOrderId: currentProductDetails.workOrderId,
      issueDescription: issueDescription,
      issueCheckedBy: issueCheckedBy,
    });
  }
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
      newSerialNumber: newSerialNumber.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white max-h-[600px] overflow-y-auto rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">
            {step === 'details' ? 'Product Warranty Details' : 
             step === 'register' ? 'Register Warranty Issue' :
             'Complete Replacement'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <FiX size={20} />
          </button>
        </div>
        
        {/* Product Details - Always show this section */}
        <div className="p-4">
          {/* Original Product Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium bg-gray-100 p-2 rounded">Original</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-sm text-gray-500">S/N:</p>
                <p className="font-medium">{currentProductDetails.serialNumber}</p>
              </div>
            </div>
          </div>
          
          {/* Product and Customer Details - Grid Layout */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Product Column */}
            <div>
              <h3 className="text-sm text-gray-500">Product</h3>
              <p className="font-medium">{currentProductDetails.productName}</p>
              {currentProductDetails.price && (
                <p className="text-sm text-gray-700">Price: ₹{currentProductDetails.price.toFixed(2)}</p>
              )}
            </div>
            
            {/* Customer Column */}
            <div>
              <h3 className="text-sm text-gray-500">Customer</h3>
              <p className="font-medium">{currentProductDetails.customerName}</p>
              {currentProductDetails.customerPhone && (
                <p className="text-sm text-gray-700">Phone: {currentProductDetails.customerPhone}</p>
              )}
            </div>
          </div>
          
          {/* Installation and Warranty Details - Grid Layout */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Installation Column */}
            <div>
              <h3 className="text-sm text-gray-500">Installation</h3>
              <p className="text-sm">
                Date: {currentProductDetails.installationDate 
                  ? formatDate(currentProductDetails.installationDate)
                  : 'Unknown'
                }
              </p>
              <p className="text-sm">
                Tech: {currentProductDetails.technicianName || 'Unknown'}
              </p>
            </div>
            
            {/* Warranty Information */}
            <div>
              <h3 className="text-sm text-gray-500">Warranty</h3>
              <p className="text-sm">
                Period: {currentProductDetails.warranty || 'Unknown'}
              </p>
              {warrantyStatus.endDate && (
                <p className="text-sm">
                  End Date: {warrantyStatus.endDate}
                </p>
              )}
              {warrantyStatus.isUnderWarranty && (
                <p className="text-sm text-green-600 font-medium">
                  Days Remaining: {warrantyStatus.remainingDays}
                </p>
              )}
            </div>
          </div>
          
          {/* Display current issue information if replacementData exists */}
          {replacementData && replacementData.issues && replacementData.issues.length > 0 && (
  <div className="mt-4 border-t pt-4">
    <h3 className="text-sm font-medium">Issue History</h3>
    {replacementData.issues.map((issue, index) => (
      <div key={index} className="mt-3 p-3 bg-gray-50 rounded-md">
        <p className="text-sm">
          <span className="text-gray-500">Date:</span> {formatDate(issue.reportedAt)}
        </p>
        <p className="text-sm">
          <span className="text-gray-500">Issue:</span> {issue.issueDescription}
        </p>
        <p className="text-sm">
          <span className="text-gray-500">Checked By:</span> {issue.issueCheckedBy || 'Not specified'}
        </p>
        
        {/* Show replacement info if this issue has been resolved */}
        {issue.replacementSerialNumber && (
          <>
            <p className="text-sm mt-2 text-green-600 font-medium">
              <span className="text-gray-500">Replaced With:</span> {issue.replacementSerialNumber}
            </p>
            {issue.replacedAt && (
              <p className="text-sm text-gray-500">
                Replacement Date: {formatDate(issue.replacedAt)}
              </p>
            )}
          </>
        )}
      </div>
    ))}
  </div>
)}
          
          {/* Replacement History */}
          {replacementHistory.length > 1 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Replacement History</h3>
              <div className="mt-2 space-y-2">
                {replacementHistory.map((item, index) => (
                  <div key={index} className="text-sm border-b pb-2">
                    <p><span className="text-gray-500">S/N:</span> {item.serialNumber}</p>
                    {item.status === 'replaced' && (
                      <p><span className="text-gray-500">Replaced With:</span> {item.replacementSerialNumber}</p>
                    )}
                    <p><span className="text-gray-500">Date:</span> {formatDate(item.registeredAt)}</p>
                    <p><span className="text-gray-500">Status:</span> {item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Register step content - Issue Description and Issue Checked By */}
          {step === 'register' && (
            <div className="mt-4">
              <h3 className="text-sm text-gray-500">Issue Description*</h3>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the issue with this product..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                rows="3"
              ></textarea>
              
              {/* Replace technician dropdown with Issue Checked By input */}
              <h3 className="text-sm text-gray-500 mt-4">Issue Checked By*</h3>
              <input
                type="text"
                value={issueCheckedBy}
                onChange={(e) => setIssueCheckedBy(e.target.value)}
                placeholder="Enter name of person who checked the issue"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              />
              
              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}
            </div>
          )}
          
          {/* New Serial Number input if replacement is pending */}
          {replacementData && 
  replacementData.status === 'pending' && 
  replacementData.issues && 
  replacementData.issues.length > 0 &&
  !replacementData.issues[replacementData.issues.length - 1].replacementSerialNumber && 
  step === 'details' && (
  <div className="mt-4 border-t pt-4">
    <h3 className="text-sm font-medium">Complete Replacement</h3>
    <div className="mt-2">
      <label className="block text-sm text-gray-500 mb-1">
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
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  </div>
)}
        </div>
        
        {/* Footer with Buttons */}
        <div className="p-4 border-t flex justify-end space-x-3">
          {step === 'details' ? (
            <>
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
              
              {/* If we have a pending replacement, show Complete Replacement button */}
              {replacementData && replacementData.status === 'pending' && newSerialNumber.trim() && (
                <button 
                  onClick={handleCompleteReplacement}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Save Replacement
                </button>
              )}
              
              {/* Show Register New Warranty button under these conditions:
                  1. No replacementData OR replacement is already completed
                  2. Product is under warranty */}
              {((!replacementData || replacementData.status === 'replaced') && warrantyStatus.isUnderWarranty) && (
                <button 
                  onClick={handleStartRegister}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Register New Warranty
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={() => setStep('details')}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              
              <button 
                onClick={handleRegisterWarranty}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Register Issue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SerialDetailsModal;