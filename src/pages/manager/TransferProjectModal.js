import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiUser, FiCalendar, FiMapPin, FiInfo, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const TransferProjectModal = ({ isOpen, onClose, project, onProjectTransferred }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transferRemark, setTransferRemark] = useState('');
  const [remarkError, setRemarkError] = useState('');
  
  const modalContentRef = useRef(null);
  
  // Set up a scrollable container to ensure visibility of all content
  useEffect(() => {
    if (isOpen && modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [isOpen, project]);

  // Set up a click handler for backdrop click to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      // Check if click was outside modal content
      if (modalContentRef.current && !modalContentRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    // Check if ESC key was pressed
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners when modal opens
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    // Remove event listeners when component unmounts or modal closes
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // Validate remark
  const validateRemark = (text) => {
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 5) {
      setRemarkError(`You must write at least 5 words. Current word count: ${wordCount}`);
      return false;
    } else {
      setRemarkError('');
      return true;
    }
  };

  // Validate remark when it changes
  useEffect(() => {
    if (transferRemark.trim()) {
      validateRemark(transferRemark);
    } else {
      setRemarkError('');
    }
  }, [transferRemark]);

  if (!isOpen || !project) return null;
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Find the stop request entry in status history
  const getStopRequestEntry = () => {
    if (project.statusHistory) {
      return project.statusHistory.find(entry => 
        entry.status === 'transferring'
      );
    }
    return null;
  };

  // Function to handle project transfer acceptance
  const handleAcceptTransfer = async () => {
    // Validate remark
    if (!validateRemark(transferRemark)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      
      // API call to accept transfer
      const response = await fetch(SummaryApi.acceptTechnicianProjectTransfer.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId: project.customerId,
          orderId: project.orderId,
          remark: transferRemark
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Call parent component's handler with the updated project
      if (onProjectTransferred) {
        // Pass the updated project with new status
        const updatedProject = {
          ...project,
          status: 'transferred'
        };
        onProjectTransferred(updatedProject);
      }

      // Navigate to work orders page to show the newly created work order
      navigate('/work-orders');
      } else {
        setError(data.message || 'Failed to accept transfer request');
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error accepting transfer:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Count words in text
  const countWords = (text) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };
  
  const stopRequest = getStopRequestEntry();
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-2 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
       ref={modalContentRef}>
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center">
            Transfer Request
            <span className="ml-3 px-3 py-1 rounded-full text-xs capitalize bg-red-100 text-red-800">
              Transferring
            </span>
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <FiX size={24} />
          </button>
        </div>
        
        <div 
          className="overflow-y-auto p-6"
          style={{ maxHeight: 'calc(90vh - 70px)' }}
        >
          {error && (
            <div className="mb-4 bg-red-100 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Stop Request Information */}
          <div className="mb-6 bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
            <h3 className="text-lg font-medium mb-2">Transfer Request</h3>
            
            <div className="mb-3">
              <p className="text-sm text-gray-700 mb-1">Requested by:</p>
              <p className="font-medium">
                {project.technician ? `${project.technician.firstName} ${project.technician.lastName}` : 'Technician'}
              </p>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-gray-700 mb-1">Requested on:</p>
              <p className="font-medium">{formatDate(project.updatedAt)}</p>
            </div>
            
            {stopRequest && (
              <div>
                <p className="text-sm text-gray-700 mb-1">Reason for transfer:</p>
                <p className="p-3 bg-white rounded border border-red-200">{stopRequest.remark || 'No reason provided'}</p>
              </div>
            )}
          </div>
          
          {/* Basic Project Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-lg mb-3">
              {project.projectType}
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="text-gray-500">Order ID:</span> {project.orderId}</p>
                <p><span className="text-gray-500">Project ID:</span> {project.projectId}</p>
                {project.branchName && (
                  <p><span className="text-gray-500">Branch:</span> {project.branchName}</p>
                )}
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end">
                  <FiCalendar className="mr-2" />
                  <span className="text-gray-500">Created: </span>
                  <span className="ml-2">{formatDate(project.createdAt)}</span>
                </p>
              </div>
            </div>
          </div>
          
          {/* Customer Information */}
          <div className="mb-6">
            <h3 className="text-md font-medium flex items-center mb-3">
              <FiUser className="mr-2" />
              Customer Information
            </h3>
            
            <div className="bg-white border rounded-lg p-4">
              <p className="font-medium">{project.customerName}</p>
              {project.customerPhone && (
                <p className="text-sm mt-1">Phone: {project.customerPhone}</p>
              )}
              {project.customerAddress && (
                <p className="flex items-start text-sm mt-2">
                  <FiMapPin className="mr-2 text-gray-500 mt-1 flex-shrink-0" />
                  <span>{project.customerAddress}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Initial Requirements */}
          {project.initialRemark && (
            <div className="mb-6">
              <h3 className="text-md font-medium flex items-center mb-3">
                <FiInfo className="mr-2" />
                Initial Requirements
              </h3>
              
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm">{project.initialRemark}</p>
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {project.instructions && (
            <div className="mb-6">
              <h3 className="text-md font-medium flex items-center mb-3">
                <FiInfo className="mr-2" />
                Special Instructions
              </h3>
              
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm">{project.instructions}</p>
              </div>
            </div>
          )}
          
          
          {/* Transfer Acceptance Section */}
          {project.status === 'transferring' ? (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Accept Transfer Request</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Acceptance Note* <span className="text-xs text-gray-500">(minimum 5 words required)</span>
              </label>
              <textarea
                value={transferRemark}
                onChange={(e) => setTransferRemark(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  remarkError ? 'border-red-300 focus:ring-red-300' : 'focus:ring-blue-500'
                }`}
                rows="3"
                placeholder="Enter your notes for accepting this transfer request (min 5 words)..."
               />
              
              {/* Show word count */}
              <div className="mt-1 flex justify-between">
                <div className="text-xs text-gray-500">
                  Word Count: {countWords(transferRemark)}
                </div>
                
                {remarkError && (
                  <div className="text-xs text-red-500 flex items-center">
                    <FiAlertCircle className="mr-1" /> {remarkError}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleAcceptTransfer}
                disabled={loading || remarkError || countWords(transferRemark) < 5}
                className={`px-6 py-2 text-white rounded-md flex items-center ${
                  loading || remarkError || countWords(transferRemark) < 5
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {loading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <FiArrowLeft className="mr-2" /> Accept Transfer Request
                  </>
                )}
              </button>
            </div>
          </div>
) : (
  // For already transferred projects, just show a close button
  <div className="mt-8 border-t pt-6 flex justify-end">
    <button
      onClick={onClose}
      className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md"
    >
      Close
    </button>
  </div>
)}
        </div>
      </div>
    </div>
  );
};

export default TransferProjectModal;