import React, { useRef, useEffect, useState } from 'react';
import { FiX, FiUser, FiMapPin, FiCalendar, FiInfo, FiPlay, FiPause, FiSearch, FiCamera, FiFileText, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { ArrowLeft, Clipboard } from 'lucide-react';
import SummaryApi from '../../common';
import { useAuth } from '../../context/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import { Play, Clock, Info, X } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// For more basic projects, a simpler scan simulation approach might be better
const SimpleScanner = ({ onScan, onClose }) => {
  const [manualCode, setManualCode] = useState('');
  
  return (
    <div className="p-4">
      <div className="text-center py-4">
        <FiCamera size={64} className="mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">Camera access is not enabled in this version</p>
        <p className="text-sm text-gray-500 mt-2">Please enter the serial number manually:</p>
        
        <div className="mt-4">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md mb-3"
            placeholder="Enter serial number"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => onScan(manualCode)}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md"
              disabled={!manualCode.trim()}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkOrderDetailsModal = (props) => {
  const { isOpen, onClose, workOrder, onStatusUpdate, onProjectStarted, darkMode = false } = props;
  const modalContentRef = useRef(null);
  const modalBackdropRef = useRef(null); 
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  
  // States for inventory management
  const [searchQuery, setSearchQuery] = useState('');
  const [technicianInventory, setTechnicianInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBillSummary, setShowBillSummary] = useState(false);
  const [showResumeConfirmationModal, setShowResumeConfirmationModal] = useState(false);
  
  // Payment related states
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [billId, setBillId] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [complaintDetails, setComplaintDetails] = useState(null);
  
  // Reset states when modal opens with a different work order
  useEffect(() => {
    setRemark('');
    setError(null);
    setSearchQuery('');
    setSelectedItems([]);
    setSearchResults([]);
    setShowCameraScanner(false);
    setShowBillSummary(false);
    setShowPaymentOptions(false);
    setPaymentMethod('');
    setTransactionId('');
    setCashAmount(0);
    setShowQRCode(false);
    setShowPaymentSuccess(false);
    setBillId(null);
    
    // Check if work order has payment info
    const hasPayment = 
      (workOrder?.billingInfo && workOrder.billingInfo.length > 0) || 
      (workOrder?.statusHistory && workOrder.statusHistory.some(history => history.status === 'payment'));
    
    setPaymentCompleted(hasPayment);
    
    // Load technician inventory if work order is in-progress AND payment is not completed
    if (workOrder?.status === 'in-progress' && !hasPayment) {
      fetchTechnicianInventory();
    }
  }, [workOrder?.orderId]);

  useEffect(() => {
    // मॉडल खुलने पर हिस्ट्री स्टेट पुश करें
    if (isOpen) {
      window.history.pushState({ modal: 'workOrderDetails' }, '');
      
      // बैक बटन हैंडलर
      const handleBackButton = (event) => {
        // इवेंट.स्टेट चेक करें और मॉडल बंद करें
        onClose();
      };
      
      // पॉपस्टेट इवेंट लिसनर जोड़ें
      window.addEventListener('popstate', handleBackButton);
      
      // क्लीनअप
      return () => {
        window.removeEventListener('popstate', handleBackButton);
      };
    }
  }, [isOpen, onClose]);

  // ESC कुंजी के लिए इवेंट हैंडलर
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // बैकड्रॉप क्लिक हैंडलर
    const handleClickOutside = (event) => {
      if (modalBackdropRef.current && event.target === modalBackdropRef.current) {
        onClose();
      }
    };

    // लिसनर्स जोड़ें
    document.addEventListener('keydown', handleEscKey);
    document.addEventListener('mousedown', handleClickOutside);

    // क्लीनअप
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  
  // Fetch technician's inventory
  const fetchTechnicianInventory = async () => {
    try {
      setLoading(true);
      const response = await fetch(SummaryApi.getTechnicianInventory.url, {
        method: SummaryApi.getTechnicianInventory.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Ensure all items have a proper salePrice value
        const inventoryWithPrices = data.data.map(item => ({
          ...item,
          salePrice: item.salePrice || 0
        }));
        setTechnicianInventory(inventoryWithPrices);
      } else {
        setError('Failed to load inventory: ' + data.message);
      }
    } catch (err) {
      setError('Error loading inventory. Please try again later.');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Real-time search as user types
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);
  
  // Set up a scrollable container to ensure visibility of all content
  useEffect(() => {
    if (isOpen && modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [isOpen, workOrder]);
  
  if (!isOpen || !workOrder) return null;

  
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

  // Function to check if technician already has an active project
  const checkActiveProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(SummaryApi.getTechnicianActiveProject.url, {
        method: SummaryApi.getTechnicianActiveProject.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.hasActiveProject && data.activeProject.orderId !== workOrder.orderId) {
          setError(`You already have an active project: ${data.activeProject.projectType}. Please pause it before starting a new one.`);
          return true;
        }
        return false;
      } else {
        setError(data.message || 'Failed to check active projects');
        return true;
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error checking active project:', err);
      return true;
    } finally {
      setLoading(false);
    }
  };

// पॉज़ की तारीख खोजने के लिए
const findPauseDateTime = () => {
  if (!workOrder?.statusHistory) return "N/A";
  
  // स्टेटस हिस्ट्री से अंतिम पॉज़ एंट्री खोजें
  const pauseHistory = [...workOrder.statusHistory]
    .reverse()
    .find(history => history.status === 'paused');
    
  if (!pauseHistory) return "N/A";
  
  return formatDate(pauseHistory.updatedAt);
};

// पॉज़ का कारण खोजने के लिए
const findPauseReason = () => {
  if (!workOrder?.statusHistory) return "No reason provided";
  
  // स्टेटस हिस्ट्री से अंतिम पॉज़ एंट्री खोजें
  const pauseHistory = [...workOrder.statusHistory]
    .reverse()
    .find(history => history.status === 'paused');
    
  if (!pauseHistory) return "No reason provided";
  
  return pauseHistory.remark || "No reason provided";
};

// प्रोजेक्ट रिज्यूम करने के लिए
const handleShowResumeConfirmation = () => {
  setShowResumeConfirmationModal(true);
};

// रिज्यूम को कन्फर्म करने के बाद का लॉजिक
const confirmResumeProject = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // रिज्यूम नोट के लिए एक डिफॉल्ट मैसेज
    const resumeNote = "Project resumed by technician";
    
    const response = await fetch(SummaryApi.updateWorkOrderStatus.url, {
      method: SummaryApi.updateWorkOrderStatus.method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        customerId: workOrder.customerId,
        orderId: workOrder.orderId,
        status: 'in-progress',
        remark: resumeNote
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Call the parent component's onStatusUpdate to refresh data
      if (onStatusUpdate) {
        onStatusUpdate(data.data);
      }
      
      // Close the confirmation modal and main modal
      setShowResumeConfirmationModal(false);
      onClose();
    } else {
      setError(data.message || 'Failed to resume project');
    }
  } catch (err) {
    setError('Server error. Please try again.');
    console.error('Error resuming project:', err);
  } finally {
    setLoading(false);
  }
};

if (loading) return <LoadingSpinner />;

// प्रोजेक्ट स्थिति के आधार पर अलग-अलग विज़ुअल प्रदर्शित करने के लिए
const renderProjectContent = () => {
  if (workOrder.status === 'paused') {
    // पॉज्ड प्रोजेक्ट के लिए विशेष व्यू
    return (
      <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-xl shadow-lg p-4`}>
        {/* पॉज्ड स्टेटस बैज */}
        <div className="mb-4 flex justify-between items-center">
          <span className="px-3 py-1 rounded-full text-sm capitalize bg-orange-100 text-orange-800">
            Paused
          </span>
          
          <div className="text-sm text-gray-500">
            <Clock size={16} className="inline mr-1" />
            {findPauseDateTime()}
          </div>
        </div>
        
        {/* प्रोजेक्ट इंफॉर्मेशन */}
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center mb-3">
            <Clipboard size={18} className="mr-2" />
            Project Information
          </h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p><span className="font-medium">Type:</span> {workOrder.projectType}</p>
            <p><span className="font-medium">Category:</span> {workOrder.projectCategory || 'New Installation'}</p>

             {/* Show Project ID only for Repair/Complaint */}
      {/* {workOrder.projectCategory === 'Repair' && (
        <>
          <p><span className="text-gray-500">Project ID:</span> {workOrder.projectId}</p>
          <p><span className="text-gray-500">Created Date:</span> {formatDate(workOrder.createdAt)}</p>
          
          {workOrder.completedBy && (
            <p><span className="text-gray-500">Completed By:</span> {workOrder.completedBy}</p>
          )}
        </>
      )} */}
          </div>
        </div>
        
        {/* कस्टमर इंफॉर्मेशन */}
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center mb-3">
            <FiUser className="mr-2" />
            Customer Information
          </h3>
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <p className="font-medium">{workOrder.customerName}</p>
            {workOrder.customerAddress && (
              <p className="flex items-start text-sm">
                <FiMapPin className="mr-2 text-gray-500 mt-1" />
                <span>{workOrder.customerAddress}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* पॉज़ का कारण */}
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center mb-3">
            <Info size={18} className="mr-2" />
            Pause Reason
          </h3>
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
            <p className="text-sm text-gray-700">{findPauseReason()}</p>
          </div>
        </div>
        
        {/* Resume Button */}
        <button
          onClick={handleShowResumeConfirmation}
          className="w-full py-2 bg-blue-500 text-white rounded-lg flex items-center justify-center"
        >
          <Play size={18} className="mr-2" /> Resume Project
        </button>

        {showResumeConfirmationModal && (
  <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
    <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Confirm Resume</h3>
        <button 
          onClick={() => setShowResumeConfirmationModal(false)}
          className="p-1"
        >
          <FiX size={20} />
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-center mb-6">
          Are you sure you want to resume this project?
        </p>
        
        <div className="flex p-4 border-t">
          <button
            onClick={() => setShowResumeConfirmationModal(false)}
            className="flex-1 mr-2 py-2 border border-gray-300 rounded-lg text-gray-700"
          >
            No
          </button>
          <button
            onClick={confirmResumeProject}
            className="flex-1 ml-2 py-2 bg-green-500 text-white rounded-lg"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      </div>
    );
  } else {
    // अन्य स्टेट्स के लिए रेगुलर व्यू
    return (
      <>
        {/* Status Badge */}
        <div className="mb-4 flex justify-between items-center">
          <span className={`px-3 py-1 rounded-full text-sm capitalize ${
            workOrder.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
            workOrder.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
            workOrder.status === 'paused' ? 'bg-orange-100 text-orange-800' :
            'bg-green-100 text-green-800'
          }`}>
            {workOrder.status}
          </span>
          
          <div className="text-sm text-gray-500">
            <FiCalendar className="inline mr-1" />
            {formatDate(workOrder.createdAt)}
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {/* Basic Work Order Info */}
        <div>
          <h3 className="text-md font-medium flex items-center mb-3">
            <Clipboard size={18} className="mr-2" />
            Project Information
          </h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Project Type:</span> {workOrder.projectCategory || 'New Installation'}</p>
              <p><span className="text-gray-500">Project Category:</span> {workOrder.projectType}</p>

                {/* Show Project ID and Created Date */}
      <p><span className="text-gray-500">Project ID:</span> {workOrder.projectId}</p>
      
      {/* Original Project Date for both Repair and New Installation */}
      <p>
        <span className="text-gray-500">Project Date:</span> {
          workOrder.projectCreatedAt 
            ? formatDate(workOrder.projectCreatedAt) 
            : formatDate(workOrder.createdAt)
        }
      </p>
            </div>
          </div>
        </div>
        
        {/* Customer Information */}
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center mb-3">
            <FiUser className="mr-2" />
            Customer Information
          </h3>
          
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <p className="font-medium">{workOrder.customerName}</p>
            {workOrder.customerAddress && (
              <p className="flex items-start text-sm">
                <FiMapPin className="mr-2 text-gray-500 mt-1" />
                <span>{workOrder.customerAddress}</span>
              </p>
            )}
          </div>
        </div>

        {workOrder.status === 'transferring' && (
  <div className="mb-4">
    <h3 className="text-md font-medium flex items-center mb-3">
      <ArrowLeft size={18} className="mr-2" />
      Transfer Status
    </h3>
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Status:</span>
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Transfer Pending</span>
      </div>
      
      {/* Find transfer request reason */}
      {workOrder.statusHistory && (
        <>
          {workOrder.statusHistory
            .filter(history => history.status === 'transferring')
            .map((history, idx) => (
              <div key={idx} className="mb-2">
                <p className="text-sm text-gray-700 font-medium">Transfer reason:</p>
                <p className="mt-1 text-sm">{history.remark || 'No reason provided'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Requested on: {formatDate(history.updatedAt)}
                </p>
              </div>
            ))
          }
        </>
      )}
      
      <p className="text-sm text-orange-600 mt-2">
        Your request is waiting for manager approval. Once approved, this project will be assigned to another technician.
      </p>
    </div>
  </div>
)}

{workOrder.status === 'transferred' && (
  <div className="mb-4">
    <h3 className="text-md font-medium flex items-center mb-3">
      <ArrowLeft size={18} className="mr-2" />
      Transfer Complete
    </h3>
    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
      <p className="font-medium">This project has been successfully transferred.</p>
      
      {/* Find transfer approval details */}
      {workOrder.statusHistory && (
        <>
          {workOrder.statusHistory
            .filter(history => history.status === 'transferred')
            .map((history, idx) => (
              <div key={idx} className="mt-2">
                <p className="text-sm text-gray-700">{history.remark || 'No additional comments'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Transferred on: {formatDate(history.updatedAt)}
                </p>
              </div>
            ))
          }
        </>
      )}
    </div>
  </div>
)}

{workOrder.initialRemark && (
 <div className="mb-4">
 <h3 className="text-md font-medium flex items-center mb-3">
   <FiInfo className="mr-2" />
   Project Requirements
 </h3>
 
 <div className="bg-white border rounded-lg p-3">
   <p className="text-sm">{workOrder.initialRemark}</p>
 </div>
</div> 
)}

{/* Special Instructions - only show if available */}
{workOrder.instructions && (
  <div className="mb-4">
    <h3 className="text-md font-medium flex items-center mb-3">
      <FiInfo className="mr-2" />
      Special Instructions
    </h3>
    
    <div className="bg-white border rounded-lg p-3">
      <p className="text-sm">{workOrder.instructions}</p>
    </div>
  </div>
)}
        
        {/* Status History */}
        {workOrder.statusHistory && workOrder.statusHistory.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">Status History</h3>
            
            <div className="bg-white border rounded-lg p-3">
              <div className="space-y-3">
                {workOrder.statusHistory.map((history, index) => (
                  <div key={index} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                    <div className="flex justify-between">
                      <span className="font-medium capitalize">
                        {history.status === 'remark' ? 'Remark Added' : 
                        history.status === 'communication' ? 'Communication' :
                        history.status}
                      </span>
                      <span className="text-gray-500">{formatDate(history.updatedAt)}</span>
                    </div>
                    {history.remark && <p className="mt-1 text-gray-600">{history.remark}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Payment History */}
        {workOrder.billingInfo && workOrder.billingInfo.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">Payment History</h3>
            
            <div className="bg-white border rounded-lg p-3">
              <div className="space-y-3">
                {workOrder.billingInfo.map((payment, index) => (
                  <div key={index} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                    <div className="flex justify-between">
                      <span className="font-medium">Bill #{payment.billNumber}</span>
                      <span className="text-gray-500">{formatDate(payment.paidAt)}</span>
                    </div>
                    <div className="mt-1">
                      <p><span className="text-gray-600">Amount:</span> ₹{payment.amount.toFixed(2)}</p>
                      <p><span className="text-gray-600">Method:</span> {payment.paymentMethod === 'online' ? 'Online Payment' : 'Cash Payment'}</p>
                      {payment.transactionId && (
                        <p><span className="text-gray-600">Transaction ID:</span> {payment.transactionId}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Inventory Management Section - Only for in-progress */}
        {workOrder.status === 'in-progress' && !paymentCompleted && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">Inventory Management</h3>
            
            <div className="bg-white border rounded-lg p-3">
              {/* Search and Scan */}
              <div className="flex mb-3">
                <div className="relative flex-1 mr-2">
                  <input
                    type="text"
                    placeholder="Search by name or serial number"
                    className="w-full pl-10 pr-2 py-2 border rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
                </div>
                <button
                  onClick={handleScan}
                  className="px-3 py-2 bg-green-500 text-white rounded-md"
                >
                  Scan
                </button>
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-3 border rounded-md p-2 bg-gray-50">
                  <p className="text-sm font-medium mb-2">Search Results:</p>
                  {searchResults.map((item, index) => (
                    <div 
                      key={index}
                      className="flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer rounded"
                      onClick={() => addItemToSelection(item)}
                    >
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-xs text-gray-500">
                          {item.type === 'serialized-product' 
                            ? `S/N: ${item.selectedSerialNumber} - ₹${item.salePrice?.toFixed(2) || '0.00'}` 
                            : `Generic Item - ₹${item.salePrice?.toFixed(2) || '0.00'}`}
                        </p>
                      </div>
                      <button className="text-blue-500 text-sm">Add</button>
                    </div>
                  ))}
                </div>
              )}
                        
              {/* Selected Items List */}
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">Selected Items:</p>
                {selectedItems.length > 0 ? (
                  <div className="border rounded-md divide-y">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2">
                        <div className="flex-1">
                          <p className="font-medium">{item.itemName}</p>
                          {item.type === 'serialized-product' ? (
                            <p className="text-xs text-gray-500">
                              S/N: {item.selectedSerialNumber} - ₹{item.salePrice?.toFixed(2) || '0.00'}
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-500">
                                ₹{item.salePrice?.toFixed(2) || '0.00'} per {item.unit || 'Piece'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Available: {item.availableQuantity} {item.unit || 'Piece'}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Quantity controls for generic products */}
                        {item.type === 'generic-product' && (
                          <div className="flex items-center mr-2">
                            <button 
                              onClick={() => updateItemQuantity(index, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center border rounded-l-md"
                              disabled={item.quantity <= 1}
                            >
                              -
                            </button>
                            <span className="w-10 h-8 flex items-center justify-center border-t border-b">
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateItemQuantity(index, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center border rounded-r-md"
                              disabled={item.quantity >= item.availableQuantity}
                            >
                              +
                            </button>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => removeItem(index)}
                          className="text-red-500 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-md text-gray-500">
                    No items selected
                  </div>
                )}
              </div>
                        
              {/* Generate Bill Button */}
              {selectedItems.length > 0 && (
                <button
                  onClick={generateBill}
                  className="w-full py-2 bg-blue-500 text-white rounded-md flex items-center justify-center"
                >
                  <FiFileText className="mr-2" /> Generate Bill
                </button>
              )}
            </div>
          </div>
        )}

        {/* Payment Details Section */}
        {paymentCompleted && workOrder.billingInfo && workOrder.billingInfo.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-3">Payment Details</h3>
            
            <div className="bg-white border rounded-lg p-3">
              <div className="space-y-3">
                {workOrder.billingInfo.map((payment, index) => (
                  <div key={index} className="flex justify-between p-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">Bill #{payment.billNumber}</p>
                      <p className="text-sm text-gray-600">
                        {payment.paymentMethod === 'online' ? 'Online Payment' : 'Cash Payment'}
                      </p>
                      {payment.transactionId && (
                        <p className="text-sm text-gray-600">Tx ID: {payment.transactionId}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{payment.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.paidAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="mt-6 space-y-2">
          {/* For assigned work orders - show Start Project button */}
          {workOrder.status === 'assigned' && (
  <button 
    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-md flex items-center justify-center"
    onClick={() => updateStatus('in-progress')}
    disabled={loading}
  >
    <FiPlay className="mr-2" /> 
    {workOrder.projectCategory === 'Repair' ? 'Start Complaint' : 'Start Project'}
  </button>
)}
          
          {/* For in-progress work orders - show Pause Project OR Complete Project buttons */}
          {workOrder.status === 'in-progress' && (
            <>
              {paymentCompleted || (workOrder.billingInfo && workOrder.billingInfo.length > 0) ? (
                // Show Complete Project button
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Completion Notes (optional)
                    </label>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      placeholder="Enter any notes about the completed project..."
                    ></textarea>
                  </div>
                  
                  <button 
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-md flex items-center justify-center"
                    onClick={() => updateStatus('completed')}
                    disabled={loading}
                  >
                    <FiCheckCircle className="mr-2" /> Complete Project & Send for Approval
                  </button>
                </>
              ) : (
                // Show Pause Project when not in payment flow
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for pausing
                    </label>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      placeholder="Enter reason for pausing this project..."
                    ></textarea>
                  </div>
                  
                  <button 
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-md flex items-center justify-center"
                    onClick={() => updateStatus('paused')}
                    disabled={loading || !remark.trim()}
                  >
                    <FiPause className="mr-2" /> Pause Project
                  </button>
                </>
              )}
            </>
          )}
          
          {/* For paused work orders - show Resume Project with remark input */}
          {workOrder.status === 'paused' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for resuming
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Enter reason for resuming this project..."
                ></textarea>
              </div>
              
              <button 
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-md flex items-center justify-center"
                onClick={() => updateStatus('in-progress')}
                disabled={loading || !remark.trim()}
              >
                <FiPlay className="mr-2" /> Resume Project
              </button>
            </>
          )}
        </div>
      </>
    );
  }
};

  // Function to update the work order status
  const updateStatus = async (newStatus) => {
    // For starting a project, check if there's an active project first
    if (newStatus === 'in-progress') {
      const hasActiveProject = await checkActiveProject();
      if (hasActiveProject) return;
    }
    
    // For resume, also check for active projects
    if (newStatus === 'in-progress' && workOrder.status === 'paused') {
      const hasActiveProject = await checkActiveProject();
      if (hasActiveProject) return;
    }
    
    try {
      setLoading(true);
      
      // If completing the project, change status to pending-approval instead of completed
      const statusToSend = newStatus === 'completed' ? 'pending-approval' : newStatus;
      
      const response = await fetch(SummaryApi.updateWorkOrderStatus.url, {
        method: SummaryApi.updateWorkOrderStatus.method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId: workOrder.customerId,
          orderId: workOrder.orderId,
          status: statusToSend,
          remark: remark
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Call the parent component's onStatusUpdate to refresh data
        if (onStatusUpdate) {
          onStatusUpdate(data.data);
        }
        
        // Close the modal for pause action or show success for complete action
        if (newStatus === 'paused') {
          onClose();
        } else if (newStatus === 'completed') {
          setShowPaymentSuccess(false);
          alert('Project has been marked as completed and sent for manager approval!');
          onClose();
        }
        
        // If project is started, load inventory
       // If project is started, load inventory
      if (newStatus === 'in-progress') {
        fetchTechnicianInventory();
        
        // Check if it's a complaint/repair project
        const isComplaint = workOrder.projectCategory === 'Repair' || 
                           workOrder.projectType?.toLowerCase().includes('repair') ||
                           workOrder.projectType?.toLowerCase().includes('complaint');
        
        // Set a flag in session storage to indicate new complaint was started
        if (isComplaint) {
          sessionStorage.setItem('newComplaintInitiated', 'true');
          
          // Dispatch a custom event for handling in TechnicianDashboard
          window.dispatchEvent(new CustomEvent('complaintInitiated', {
            detail: {
              orderId: workOrder.orderId,
              projectType: workOrder.projectType,
              projectCategory: 'Repair' // Ensure category is set
            }
          }));
        }
        
        // Close the modal
        onClose();
        
        // Call the onProjectStarted function if it exists
        if (onProjectStarted) {
          onProjectStarted();
        }
      }
      
      // Reset remark field
      setRemark('');
    } else {
      setError(data.message || 'Failed to update status');
    }
  } catch (err) {
    setError('Server error. Please try again.');
    console.error('Error updating work order status:', err);
  } finally {
    setLoading(false);
  }
};

  // Search inventory based on serial number or name
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const results = [];
    const query = searchQuery.toLowerCase();
    const addedSerialNumbers = new Set(); // Track added serial numbers
    
    // Search in inventory items
    technicianInventory.forEach(item => {
      if (item.type === 'serialized-product') {
        // For serialized items, ONLY search by serial number (not by name)
        const activeSerials = item.serializedItems.filter(
          serial => (
            serial.status === 'active' && 
            serial.serialNumber.toLowerCase().includes(query) &&
            !addedSerialNumbers.has(serial.serialNumber) // Prevent duplicates
          )
        );
        
        if (activeSerials.length > 0) {
          activeSerials.forEach(serialItem => {
            addedSerialNumbers.add(serialItem.serialNumber);
            results.push({
              ...item,
              selectedSerialNumber: serialItem.serialNumber,
              quantity: 1,
              unit: item.unit || 'Piece'
            });
          });
        }
      } else if (item.type === 'generic-product') {
        // For generic items, search by name and only show if quantity > 0
        const nameMatch = item.itemName.toLowerCase().includes(query);
        if (nameMatch && item.genericQuantity > 0) {
          results.push({
            ...item,
            quantity: 1,
            unit: item.unit || 'Piece'
          });
        }
      }
    });
    
    setSearchResults(results);
  };

  // Add item to the selected items list
  const addItemToSelection = (item) => {
    // Ensure the item has a price
    const itemWithPrice = {
      ...item,
      salePrice: item.salePrice || 0,  // Default to 0 if not present
      // Add available quantity for generic products
      availableQuantity: item.type === 'generic-product' ? item.genericQuantity : 1
    };
    
    // Check if this item is already in the list (for serialized items)
    if (item.type === 'serialized-product') {
      const exists = selectedItems.some(
        selectedItem => selectedItem.type === 'serialized-product' && 
        selectedItem.selectedSerialNumber === item.selectedSerialNumber
      );
      
      if (exists) {
        setError('This serialized item is already added');
        return;
      }
      
      setSelectedItems([...selectedItems, itemWithPrice]);
    } else {
      // For generic items, check if it exists and update quantity
      const existingIndex = selectedItems.findIndex(
        selectedItem => selectedItem.type === 'generic-product' && 
        selectedItem.itemId === item.itemId
      );
      
      if (existingIndex >= 0) {
        // Check if we can increment the quantity
        const currentQuantity = selectedItems[existingIndex].quantity;
        const availableQuantity = selectedItems[existingIndex].availableQuantity;
        
        if (currentQuantity < availableQuantity) {
          const updatedItems = [...selectedItems];
          updatedItems[existingIndex].quantity += 1;
          setSelectedItems(updatedItems);
        } else {
          setError(`Maximum available quantity (${availableQuantity}) reached for this item`);
        }
      } else {
        setSelectedItems([...selectedItems, itemWithPrice]);
      }
    }
    
    // Clear search results and query
    setSearchResults([]);
    setSearchQuery('');
  };

  // Now, let's create a function to update quantity
const updateItemQuantity = (index, newQuantity) => {
  const item = selectedItems[index];
  
  // Validate that the new quantity is valid
  if (newQuantity < 1) {
    setError('Quantity cannot be less than 1');
    return;
  }
  
  if (item.type === 'generic-product' && newQuantity > item.availableQuantity) {
    setError(`Maximum available quantity (${item.availableQuantity}) reached for this item`);
    return;
  }
  
  // Update the quantity
  const updatedItems = [...selectedItems];
  updatedItems[index].quantity = newQuantity;
  setSelectedItems(updatedItems);
};

  // Remove item from selection
  const removeItem = (index) => {
    const newSelectedItems = [...selectedItems];
    newSelectedItems.splice(index, 1);
    setSelectedItems(newSelectedItems);
  };

  // Handle scanning
  const handleScan = () => {
    setShowCameraScanner(true);
  };

  // Handle scan result (when a barcode is detected)
  const handleScanResult = (result) => {
    if (result) {
      setShowCameraScanner(false);
      setSearchQuery(result);
      handleSearch();
    }
  };

  // Generate bill summary only (no inventory reduction)
  const generateBill = () => {
    if (selectedItems.length === 0) {
      setError('No items selected for billing');
      return;
    }
    
    setShowBillSummary(true);
  };
  
  // Calculate total bill amount
  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => {
      return total + (item.salePrice || 0) * item.quantity;
    }, 0);
  };

  // Group selected items by name for bill display
  const getGroupedItems = () => {
    const grouped = {};
    
    selectedItems.forEach(item => {
      const key = item.itemId;
      
      if (!grouped[key]) {
        grouped[key] = {
          name: item.itemName,
          type: item.type,
          unit: item.unit || 'Piece',
          price: item.salePrice || 0,
          quantity: 0,
          serialNumbers: []
        };
      }
      
      grouped[key].quantity += item.quantity;
      
      if (item.type === 'serialized-product' && item.selectedSerialNumber) {
        grouped[key].serialNumbers.push(item.selectedSerialNumber);
      }
    });
    
    return Object.values(grouped);
  };
  
  // Handle confirming the bill and show payment options
  const handleConfirmBill = async () => {
    try {
      setLoading(true);
      
      // Create bill items array for API
      const billItems = selectedItems.map(item => {
        return {
          itemId: item.itemId || item.id || item._id,
          name: item.itemName || item.name, // Send name for fallback matching
          quantity: item.quantity,
          serialNumber: item.selectedSerialNumber || null
        };
      });
      
      // Create the bill in the database
      const response = await fetch(SummaryApi.createWorkOrderBill.url, {
        method: SummaryApi.createWorkOrderBill.method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId: workOrder.customerId,
          orderId: workOrder.orderId,
          items: billItems
        })
      });
      
      const data = await response.json();
      console.log("Bill generated:", data);
      
      if (data.success) {
        // Set the bill ID for later use
        setBillId(data.data.billId || data.data._id);
        
        // Hide bill summary and show payment options
        setShowBillSummary(false);
        setShowPaymentOptions(true);
        
        // Set cash amount to the total
        setCashAmount(calculateTotal());
      } else {
        setError(data.message || 'Failed to create bill');
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error creating bill:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle selecting payment method
  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
    
    if (method === 'online') {
      setShowQRCode(true);
    } else {
      setShowQRCode(false);
    }
  };
  
  // Handle processing payment
  const handleProcessPayment = async () => {
    try {
      setLoading(true);
      
      // Validate transaction ID for online payments
      if (paymentMethod === 'online' && (!transactionId || transactionId.length < 12)) {
        setError('Please enter a valid UPI transaction ID (min 12 characters)');
        setLoading(false);
        return;
      }
      
      // API call to confirm payment
      const response = await fetch(SummaryApi.confirmWorkOrderBill.url, {
        method: SummaryApi.confirmWorkOrderBill.method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          billId,
          paymentMethod,
          transactionId: paymentMethod === 'online' ? transactionId : null
        })
      });
      
      const data = await response.json();
      console.log("Bill generated:", data);
      
      if (data.success) {
        // Hide payment options and show success
        setShowPaymentOptions(false);
        setShowQRCode(false);
        setShowPaymentSuccess(true);
        
        console.log('Payment data received:', data); // डीबग के लिए लॉग करें
        
        // महत्वपूर्ण: पेमेंट के बाद वर्क ऑर्डर स्थिति अपडेट करें और पेमेंट स्टेटस सेट करें
        if (data.data && data.data.workOrder) {
          setPaymentCompleted(true);
          
          // अपडेटेड वर्क ऑर्डर को पेरेंट कंपोनेंट को भेजें
          if (onStatusUpdate) {
            // यहां पूरा workOrder अपडेट करें
            onStatusUpdate({
              ...workOrder, // मूल वर्क ऑर्डर के सभी फील्ड्स रखें
              ...data.data.workOrder, // API से मिले अपडेट्स जोड़ें
              billingInfo: data.data.workOrder.billingInfo || [] // सुनिश्चित करें कि billingInfo मौजूद है
            });
          }
        } else {
          // यदि API से workOrder नहीं मिला तो मैन्युअल अपडेट करें
          setPaymentCompleted(true);
          fetchWorkOrderDetails(); // फिर से वर्क ऑर्डर फेच करें
        }
      } else {
        setError(data.message || 'Failed to process payment');
      }
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error processing payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkOrderDetails = async () => {
    if (!workOrder) return;
    
    try {
      setLoading(true);
      // URL को dynamically generate करें customer ID और order ID के साथ
      const url = `${SummaryApi.getWorkOrderDetails.url}/${workOrder.customerId}/${workOrder.orderId}`;
      
      console.log('Fetching work order details from:', url);
      
      const response = await fetch(url, {
        method: SummaryApi.getWorkOrderDetails.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('Updated work order data:', data.data);
        
        // पेमेंट की स्थिति चेक करें
        const hasPayment = 
          (data.data.billingInfo && data.data.billingInfo.length > 0) || 
          (data.data.statusHistory && data.data.statusHistory.some(history => history.status === 'payment'));
        
        console.log('Payment completed (from fetch):', hasPayment);
        setPaymentCompleted(hasPayment);
        
        // अपडेटेड डेटा को पेरेंट कंपोनेंट को भेजें
        if (onStatusUpdate) {
          onStatusUpdate(data.data);
        }
      } else {
        console.error('Failed to fetch updated work order details');
      }
    } catch (err) {
      console.error('Error fetching work order details:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate UPI payment string for QR code
  const generateUpiString = () => {
    // This is a simplified example - in production, you'd use your company's UPI ID
    const upiId = 'yourcompany@ybl';
    const amount = calculateTotal();
    const purpose = `Bill-${workOrder.orderId}`;
    
    return `upi://pay?pa=${upiId}&pn=Your%20Company&am=${amount}&tn=${purpose}`;
  };
  
  
  return (
    <div
    ref={modalBackdropRef}
     className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-2 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden ">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">
    {workOrder.projectCategory === 'Repair' ? 'Complaint Details' : 'Work Order Details'}
  </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>
        </div>
        
        {/* Bill Summary Modal */}
        {showBillSummary && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Bill Summary</h2>
                <button 
                  onClick={() => setShowBillSummary(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="border-b pb-2 mb-4">
                <p className="text-sm text-gray-600">Customer: {workOrder.customerName}</p>
                <p className="text-sm text-gray-600">Order ID: {workOrder.orderId}</p>
                <p className="text-sm text-gray-600">Date: {formatDate(new Date())}</p>
              </div>
              
              <table className="w-full mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getGroupedItems().map((item, index) => (
                    <tr key={index}>
                      <td className="py-3">
                        <p className="font-medium">{item.name}</p>
                        {item.serialNumbers.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            <p>Serial Numbers:</p>
                            <ul className="list-disc pl-4">
                              {item.serialNumbers.map((serial, idx) => (
                                <li key={idx}>{serial}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 text-right">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300">
                  <tr>
                    <td colSpan="3" className="py-3 text-right font-bold">Total:</td>
                    <td className="py-3 text-right font-bold">₹{calculateTotal().toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              
              {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="mt-4 flex justify-between">
                <button 
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md"
                  onClick={() => setShowBillSummary(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 bg-green-500 text-white rounded-md"
                  onClick={handleConfirmBill}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Bill'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Payment Options Modal */}
        {showPaymentOptions && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Select Payment Method</h2>
                <button 
                  onClick={() => setShowPaymentOptions(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Amount: ₹{calculateTotal().toFixed(2)}</p>
                <div className="space-y-2">
                  <button 
                    className={`w-full p-3 rounded-md flex items-center justify-between ${
                      paymentMethod === 'online' ? 'bg-blue-50 border-blue-500 border' : 'bg-gray-50 border'
                    }`}
                    onClick={() => handlePaymentMethodSelect('online')}
                  >
                    <span>Payment via Online</span>
                    {paymentMethod === 'online' && (
                      <FiCheckCircle className="text-blue-500" />
                    )}
                  </button>
                  
                  <button 
                    className={`w-full p-3 rounded-md flex items-center justify-between ${
                      paymentMethod === 'cash' ? 'bg-blue-50 border-blue-500 border' : 'bg-gray-50 border'
                    }`}
                    onClick={() => handlePaymentMethodSelect('cash')}
                  >
                    <span>Payment via Cash</span>
                    {paymentMethod === 'cash' && (
                      <FiCheckCircle className="text-blue-500" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Online Payment with QR Code */}
              {showQRCode && (
                <div className="text-center mb-4">
                  <p className="font-medium mb-3">Scan this QR code to pay</p>
                  <div className="bg-white p-3 rounded-md inline-block mb-3">
                    <QRCodeCanvas 
                      value={generateUpiString()} 
                      size={200} 
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Once payment is complete, enter the UPI transaction ID below:</p>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md mb-3"
                    placeholder="Enter UPI Transaction ID (min 12 characters)"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    minLength={12}
                  />
                  <p className="text-xs text-gray-500">Enter a valid transaction ID with minimum 12 digits</p>
                </div>
              )}
              
              {/* Cash Payment */}
              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <p className="font-medium mb-3">Cash Payment</p>
                  <div className="flex items-center bg-gray-50 p-3 rounded-md mb-3">
                    <span className="text-gray-700">Amount:</span>
                    <input
                      type="number"
                      className="w-full ml-2 px-3 py-2 border rounded-md"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(parseFloat(e.target.value))}
                      min={0}
                      readOnly
                    />
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="mt-4 flex justify-between">
                <button 
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md"
                  onClick={() => {
                    setShowPaymentOptions(false);
                    setShowBillSummary(true);
                  }}
                  disabled={loading}
                >
                  Back
                </button>
                <button 
                  className="px-4 py-2 bg-green-500 text-white rounded-md flex items-center"
                  onClick={handleProcessPayment}
                  disabled={loading || (paymentMethod === 'online' && transactionId.length < 12) || !paymentMethod}
                >
                  {loading ? 'Processing...' : (
                    <>
                      Confirm and Submit <FiArrowRight className="ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Simple Scanner Modal */}
        {showCameraScanner && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Scan Barcode</h2>
                <button 
                  onClick={() => setShowCameraScanner(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <SimpleScanner 
                onScan={handleScanResult}
                onClose={() => setShowCameraScanner(false)}
              />
            </div>
          </div>
        )}
        
        {/* Payment Success Modal */}
        {showPaymentSuccess && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden p-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheckCircle className="text-green-500" size={32} />
                </div>
                <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
                <p className="text-gray-600 mb-4">
                  Payment of ₹{calculateTotal().toFixed(2)} has been successfully processed.
                </p>
                
                <button 
  className="px-6 py-2 bg-green-500 text-white rounded-md mx-auto"
  onClick={() => {
    setShowPaymentSuccess(false);
    
    // Clear previous selections
    setSelectedItems([]);
    
    // महत्वपूर्ण: यहां एक स्टेट वैरिएबल जोड़ें जो भुगतान सफलता को ट्रैक करे
    setPaymentCompleted(true);
    
    // एक बार और फिर से फेच करें ताकि सभी अपडेट्स मिलें
    fetchWorkOrderDetails();
  }}
>
  Done
</button>
              </div>
            </div>
          </div>
        )}
        
        <div 
          ref={modalContentRef}
          className="overflow-y-auto p-4"
          style={{ maxHeight: 'calc(90vh - 60px)' }}
        >
          {renderProjectContent()}
        </div>
      </div>
    </div>
  );
};

export default WorkOrderDetailsModal;