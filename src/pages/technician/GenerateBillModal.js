import React, { useState, useEffect } from 'react';
import { X, Search, Camera, FileText, ArrowRight, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import SummaryApi from '../../common';
import { QRCodeCanvas } from 'qrcode.react';

const GenerateBillModal = ({ isOpen, onClose, workOrder, onBillGenerated }) => {
  // Main state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [technicianInventory, setTechnicianInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [billId, setBillId] = useState(null);
  
  // Payment related states
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [showServicesModal, setShowServicesModal] = useState(false);
const [availableServices, setAvailableServices] = useState([]);
const [selectedServices, setSelectedServices] = useState([]);
  
  // Navigation and view states - key change for single modal approach
  const [currentStep, setCurrentStep] = useState('select-items'); // Possible values: select-items, bill-summary, payment-options, payment-success
  const [showQRCode, setShowQRCode] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      resetAllStates();
      fetchTechnicianInventory();
    }
  }, [isOpen]);
  
  // Reset all states function
  const resetAllStates = () => {
    setSearchQuery('');
    setSelectedItems([]);
    setSearchResults([]);
    setError(null);
    setCurrentStep('select-items');
    setPaymentMethod('');
    setTransactionId('');
    setCashAmount(0);
    setShowQRCode(false);
    setManualEntryMode(false);
    setManualCode('');
    setBillId(null);
  };
  
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

  // Add this useEffect to react to changes in technicianInventory
useEffect(() => {
  // Only fetch services when inventory is loaded and has items
  if (technicianInventory && technicianInventory.length > 0) {
    fetchAvailableServices();
  }
}, [technicianInventory]); 

  // Add this new function
const fetchAvailableServices = async () => {
  try {
    const servicesFromInventory = technicianInventory.filter(item => item.type === 'service');
    setAvailableServices(servicesFromInventory);
  } catch (err) {
    console.error('Error fetching services:', err);
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
  
  // Search inventory based on serial number or name
const handleSearch = () => {
  if (!searchQuery.trim()) {
    setSearchResults([]);
    return;
  }
  
  const results = [];
  const query = searchQuery.toLowerCase();
  const addedSerialNumbers = new Set(); // Track added serial numbers
  
  // First, collect all already selected serial numbers
  selectedItems.forEach(item => {
    if (item.type === 'serialized-product' && item.selectedSerialNumber) {
      addedSerialNumbers.add(item.selectedSerialNumber);
    }
  });
  
  // Search in inventory items - EXCLUDE SERVICES
  technicianInventory.forEach(item => {
    // Skip services completely - they should not appear in search results
    if (item.type === 'service') {
      return; // Skip this iteration
    }
    
    if (item.type === 'serialized-product') {
      // For serialized items, ONLY search by serial number (not by name)
      const activeSerials = item.serializedItems?.filter(
        serial => (
          serial.status === 'active' && 
          serial.serialNumber.toLowerCase().includes(query) &&
          !addedSerialNumbers.has(serial.serialNumber) // Prevent duplicates
        )
      );
      
      if (activeSerials && activeSerials.length > 0) {
        activeSerials.forEach(serialItem => {
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
    // Note: Removed the service search logic completely
  });
  
  setSearchResults(results);
};

  // Show payment confirmation screen
const showPaymentConfirmation = () => {
    // Validate transaction ID for online payments
    if (paymentMethod === 'online' && (!transactionId || transactionId.length < 12)) {
      setError('Please enter a valid UPI transaction ID (min 12 characters)');
      return;
    }
    
    // Move to confirmation step
    setCurrentStep('payment-confirmation');
    setError(null);
  };

  // Update work order status to pending-approval after payment
const updateWorkOrderStatus = async () => {
    try {
      const response = await fetch(SummaryApi.updateWorkOrderStatus.url, {
        method: SummaryApi.updateWorkOrderStatus.method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId: workOrder.customerId,
          orderId: workOrder.orderId,
          status: 'pending-approval',
          remark: 'Payment collected and project completed'
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('Failed to update work order status:', data.message);
      }
    } catch (err) {
      console.error('Error updating work order status:', err);
    }
  };
  
  // Add item to the selected items list
  // Add item to the selected items list
const addItemToSelection = (item) => {
  // Ensure the item has a price
  const itemWithPrice = {
    ...item,
    salePrice: item.salePrice || 0,  // Default to 0 if not present
    // Add available quantity for generic products
    availableQuantity: item.type === 'generic-product' ? item.genericQuantity : 1
  };
  
  // Handle services differently - they don't have quantities to check
  if (item.type === 'service') {
    // Check if this service is already added
    const existingIndex = selectedItems.findIndex(
      selectedItem => selectedItem.type === 'service' && 
      selectedItem.itemId === item.itemId
    );
    
    if (existingIndex >= 0) {
      setError('This service is already added');
      return;
    }
    
    setSelectedItems([...selectedItems, itemWithPrice]);
  }
  // Check if this item is already in the list (for serialized items)
  else if (item.type === 'serialized-product') {
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
  
  // Update item quantity
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
  
  // Handle scanner toggle
  const handleScanToggle = () => {
    setManualEntryMode(true);
  };
  
  // Handle scan result
  const handleScanResult = (result) => {
    if (result) {
      setManualEntryMode(false);
      setSearchQuery(result);
      setManualCode('');
      handleSearch();
    }
  };
  
  // Move to bill summary view
  const goToBillSummary = () => {
    if (selectedItems.length === 0) {
      setError('No items selected for billing');
      return;
    }
    
    setCurrentStep('bill-summary');
    setError(null);
  };
  
  // Calculate total bill amount
  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => {
      return total + (item.salePrice || 0) * item.quantity;
    }, 0);
  };
  
 // Group selected items for display (for serialized items with same name)
const getGroupedItems = () => {
  const grouped = {};
  
  selectedItems.forEach(item => {
    const key = item.itemId || item._id;
    
    if (!grouped[key]) {
      grouped[key] = {
        name: item.itemName || item.name,
        type: item.type,
        unit: item.unit || (item.type === 'service' ? 'Service' : 'Piece'),
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

  // Handle bill confirmation and proceed to payment
  const handleConfirmBill = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create bill items array for API
      const billItems = selectedItems.map(item => {
        return {
          itemId: item.itemId || item.id || item._id,
          name: item.itemName || item.name, // Send name for fallback matching
          quantity: item.quantity,
          serialNumber: item.selectedSerialNumber || null,
          price: item.salePrice || 0,
          amount: (item.salePrice || 0) * item.quantity,
          type: item.type
        };
      });

      console.log("Sending bill items:", billItems); 
      
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
      
      if (data.success) {
        // Set the bill ID for later use
        setBillId(data.data.billId || data.data._id);
        
        // Set cash amount to the total
        setCashAmount(calculateTotal());
        
        // Move to payment options step
        setCurrentStep('payment-options');
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
    setShowQRCode(method === 'online');
  };
  
  // Generate UPI payment string for QR code
  const generateUpiString = () => {
    // This is a simplified example - in production, you'd use your company's UPI ID
    const upiId = 'yourcompany@ybl';
    const amount = calculateTotal();
    const purpose = `Bill-${workOrder.orderId}`;
    
    return `upi://pay?pa=${upiId}&pn=Your%20Company&am=${amount}&tn=${purpose}`;
  };
  
  // Handle processing payment
  const handleProcessPayment = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
      
      if (data.success) {
        await updateSerializedItems();
        await updateWorkOrderStatus();
        // Move to payment success step
        setCurrentStep('payment-success');
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

  // Add this new function to update serialized items
  const updateSerializedItems = async () => {
    try {
      // Filter only serialized items with serial numbers
      const serializedItems = selectedItems.filter(
        item => item.type === 'serialized-product' && item.selectedSerialNumber
      );
      
      if (serializedItems.length === 0) return;
      
      // Create array of just the serial number strings
      const serialNumbers = serializedItems.map(item => item.selectedSerialNumber);
    
    // Call API to update serialized items
    const response = await fetch(SummaryApi.updateUsedSerialNumbers.url, {
      method: SummaryApi.updateUsedSerialNumbers.method || 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        serialNumbers: serialNumbers,
        workOrderId: workOrder.orderId,
        customerId: workOrder.customerId
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('Warning: Failed to update serial numbers:', data.message);
    }
  } catch (err) {
    console.error('Error updating serial numbers:', err);
  }
};

const addServicesToBill = () => {
  // Filter only the services that are checked
  const servicesToAdd = availableServices.filter(service => 
    selectedServices.includes(service.itemId || service._id)
  );
  
  // Format services and add them to selected items
  const formattedServices = servicesToAdd.map(service => ({
    ...service,
    quantity: 1,
    type: 'service',
    availableQuantity: 1,
    unit: 'Service',
    // Ensure these properties are set correctly
    itemId: service.itemId || service._id,
    itemName: service.itemName || service.name,
    salePrice: service.salePrice || 0
  }));
  
  // Add to selected items
  setSelectedItems([...selectedItems, ...formattedServices]);
  
  // Close the modal and reset selections
  setShowServicesModal(false);
  setSelectedServices([]);
};
  
  // Handle closing the modal with different behaviors based on current step
  const handleModalClose = () => {
    // If we've completed payment, notify parent component before closing
    if (currentStep === 'payment-success') {
      if (onBillGenerated) {
        onBillGenerated(selectedItems, true); // Pass true to indicate payment completed
      }
      onClose();
    } else {
      // Just close the modal without additional actions
      onClose();
    }
  };
  
  // Handle going back to previous step
  const handleBack = () => {
    setError(null);
    
    if (currentStep === 'bill-summary') {
      setCurrentStep('select-items');
    } else if (currentStep === 'payment-options') {
      setCurrentStep('bill-summary');
    }
    else if (currentStep === 'payment-confirmation') {
        setCurrentStep('payment-options');
      }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString || Date.now()).toLocaleDateString(undefined, options);
  };

  if (!isOpen) return null;

  // This modal contains all steps in one container with conditional rendering based on currentStep
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header - Dynamic based on current step */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            {currentStep !== 'select-items' && (
              <button 
                onClick={handleBack}
                className="mr-2 p-1 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {currentStep === 'select-items' && 'Generate Bill'}
              {currentStep === 'bill-summary' && 'Bill Summary'}
              {currentStep === 'payment-options' && 'Select Payment Method'}
              {currentStep === 'payment-success' && 'Payment Complete'}
            </h2>
          </div>
          <button 
            onClick={handleModalClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Dynamic content based on current step */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 130px)' }}>
          {/* Step 1: Select Items */}
          {currentStep === 'select-items' && (
            <div className="p-4">
              {manualEntryMode ? (
                <div className="mb-4">
                  <div className="text-center py-4">
                    <Camera size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Enter the serial number manually:</p>
                    
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
                          onClick={() => setManualEntryMode(false)}
                          className="flex-1 px-4 py-2 border rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleScanResult(manualCode)}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md"
                          disabled={!manualCode.trim()}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-md font-medium mb-3">Select Items for Billing</h3>
                  
                  {/* Basic info */}
                  <div className="bg-gray-50 p-3 rounded-md mb-4 text-sm">
                    <p><span className="font-medium">Customer:</span> {workOrder.customerName}</p>
                    <p><span className="font-medium">Project:</span> {workOrder.projectType}</p>
                  </div>
                  
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
    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
  </div>
  <button
    onClick={() => setShowServicesModal(true)}
    className="px-3 py-2 bg-purple-500 text-white rounded-md"
  >
    Add Service
  </button>
</div>

{/* Services Selection Modal */}
{showServicesModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Select Services</h3>
        <button 
          onClick={() => setShowServicesModal(false)}
          className="p-1"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="overflow-y-auto p-4" style={{ maxHeight: "60vh" }}>
        {availableServices.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {availableServices.map((service, index) => (
                <tr key={service.itemId || service._id} className="hover:bg-gray-50">
                  <td className="py-3 text-sm">{index + 1}</td>
                  <td className="py-3">
                    <p className="font-medium">{service.itemName || service.name}</p>
                  </td>
                  <td className="py-3 text-right">
                    ₹{service.salePrice?.toFixed(2) || "0.00"}
                  </td>
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 text-blue-600 rounded"
                      checked={selectedServices.includes(service.itemId || service._id)}
                      onChange={() => {
                        if (selectedServices.includes(service.itemId || service._id)) {
                          setSelectedServices(selectedServices.filter(id => id !== (service.itemId || service._id)));
                        } else {
                          setSelectedServices([...selectedServices, service.itemId || service._id]);
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No services available
          </div>
        )}
      </div>
      
      <div className="p-4 border-t flex justify-end space-x-3">
        <button
          onClick={() => setShowServicesModal(false)}
          className="px-4 py-2 border rounded-md text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={addServicesToBill}
          className="px-4 py-2 bg-purple-500 text-white rounded-md"
          disabled={selectedServices.length === 0}
        >
          Add to Bill
        </button>
      </div>
    </div>
  </div>
)}
                  
                  {/* Error Message */}
                  {error && (
                    <div className="mb-3 bg-red-50 text-red-600 p-3 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                  
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
                </>
              )}
            </div>
          )}
          
          {/* Step 2: Bill Summary */}
          {currentStep === 'bill-summary' && (
            <div className="p-4">
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
            </div>
          )}
          
          {/* Step 3: Payment Options */}
          {currentStep === 'payment-options' && (
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Amount Due: ₹{calculateTotal().toFixed(2)}</p>
                <div className="space-y-2">
                  <button 
                    className={`w-full p-3 rounded-md flex items-center justify-between ${
                      paymentMethod === 'online' ? 'bg-blue-50 border-blue-500 border' : 'bg-gray-50 border'
                    }`}
                    onClick={() => handlePaymentMethodSelect('online')}
                  >
                    <span>Payment via Online</span>
                    {paymentMethod === 'online' && (
                      <CheckCircle className="text-blue-500" size={20} />
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
                      <CheckCircle className="text-blue-500" size={20} />
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
                      size={180} 
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
            </div>
          )}

           {/* Step 3.5: Payment Confirmation */}
           {currentStep === 'payment-confirmation' && (
                <div className="p-4">
                    <div className="mb-6 flex items-center justify-center">
                    <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} className="text-yellow-500" />
                    </div>
                    </div>
                    
                    <h3 className="text-xl font-medium text-center mb-4">Please Verify Payment Details</h3>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <div className="mb-3">
                        <p className="text-sm text-gray-600">Payment Method:</p>
                        <p className="font-medium">{paymentMethod === 'online' ? 'Online Payment' : 'Cash Payment'}</p>
                    </div>
                    
                    <div className="mb-3">
                        <p className="text-sm text-gray-600">Total Amount:</p>
                        <p className="font-medium">₹{calculateTotal().toFixed(2)}</p>
                    </div>
                    
                    {paymentMethod === 'online' && (
                        <div>
                        <p className="text-sm text-gray-600">Transaction ID:</p>
                        <p className="font-medium break-all">{transactionId}</p>
                        </div>
                    )}
                    </div>
                    
                    <p className="text-center text-sm text-gray-600 mb-4">
                    Please confirm that all payment details are correct before proceeding.
                    {paymentMethod === 'online' && " Verify that the transaction ID is accurate."}
                    </p>
                </div>
                )}
          
          {/* Step 4: Payment Success*/}
          {currentStep === 'payment-success' && (
  <div className="p-4">
    <div className="text-center py-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="text-green-500" size={32} />
      </div>
      <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
      
      {/* Different messages based on payment method */}
      {paymentMethod === 'online' ? (
        <p className="text-gray-600 mb-4">
          Your payment has been initiated successfully. We are currently verifying it from our end. You will receive a confirmation shortly.
        </p>
      ) : (
        <p className="text-gray-600 mb-4">
          Thanks! We've received your cash payment through our technician. It will be updated shortly.
        </p>
      )}
      
      <div className="bg-gray-50 p-4 rounded-lg text-left mb-4">
        <p className="text-sm mb-1"><span className="font-medium">Customer:</span> {workOrder.customerName}</p>
        <p className="text-sm mb-1"><span className="font-medium">Project:</span> {workOrder.projectType}</p>
        <p className="text-sm mb-1"><span className="font-medium">Payment Method:</span> {paymentMethod === 'online' ? 'Online Payment' : 'Cash Payment'}</p>
        {paymentMethod === 'online' && transactionId && (
          <p className="text-sm"><span className="font-medium">Transaction ID:</span> {transactionId}</p>
        )}
      </div>
    </div>
  </div>
)}
          </div>

          {/* Footer with action buttons - Dynamic based on current step */}
<div className="border-t p-4">
  {currentStep === 'select-items' && (
    <button
      onClick={goToBillSummary}
      className="w-full py-2 bg-blue-500 text-white rounded-md flex items-center justify-center"
      disabled={selectedItems.length === 0}
    >
      <FileText className="mr-2" size={18} /> Generate Bill
    </button>
  )}
  
  {currentStep === 'bill-summary' && (
    <div className="flex space-x-3">
      <button 
        className="flex-1 py-2 bg-gray-200 rounded-md"
        onClick={handleBack}
      >
        Back
      </button>
      <button 
        className="flex-1 py-2 bg-blue-500 text-white rounded-md flex items-center justify-center"
        onClick={handleConfirmBill}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Continue to Payment'}
      </button>
    </div>
  )}
  
 {/* Update the payment-options button */}
{currentStep === 'payment-options' && (
  <div className="flex space-x-3">
    <button 
      className="flex-1 py-2 bg-gray-200 rounded-md"
      onClick={handleBack}
      disabled={loading}
    >
      Back
    </button>
    <button 
      className="flex-1 py-2 bg-green-500 text-white rounded-md flex items-center justify-center"
      onClick={showPaymentConfirmation}
      disabled={loading || (paymentMethod === 'online' && transactionId.length < 12) || !paymentMethod}
    >
      {loading ? 'Processing...' : (
        <>
          Review Payment <ArrowRight className="ml-1" size={18} />
        </>
      )}
    </button>
  </div>
)}

{/* Add new buttons for payment-confirmation step */}
{currentStep === 'payment-confirmation' && (
  <div className="flex space-x-3">
    <button 
      className="flex-1 py-2 bg-gray-200 rounded-md"
      onClick={handleBack}
      disabled={loading}
    >
      Back
    </button>
    <button 
      className="flex-1 py-2 bg-green-500 text-white rounded-md flex items-center justify-center"
      onClick={handleProcessPayment}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Confirm & Submit'}
    </button>
  </div>
)}
  
  {currentStep === 'payment-success' && (
    <button 
      className="w-full py-2 bg-green-500 text-white rounded-md"
      onClick={handleModalClose}
    >
      Done
    </button>
  )}
        </div>
    </div>
  </div>
  );
};

export default GenerateBillModal;