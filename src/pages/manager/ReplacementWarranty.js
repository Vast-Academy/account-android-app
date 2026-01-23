import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiAlertCircle, FiCheck } from 'react-icons/fi';
import SerialDetailsModal from './SerialDetailsModal';
import SummaryApi from '../../common'; // Assuming this is your API utility
import LoadingSpinner from '../../components/LoadingSpinner';

const ReplacementWarranty = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [productDetails, setProductDetails] = useState(null);
  const [replacementData, setReplacementData] = useState(null);
  const [replacements, setReplacements] = useState([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Fetch warranty replacements on component mount
  useEffect(() => {
    fetchWarrantyReplacements();
  }, []);
  
  // Add handleRowClick function
  const handleRowClick = (replacementId) => {
    if (expandedRowId === replacementId) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(replacementId);
    }
  };

  // Handle search when Enter key is pressed
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      await searchSerialNumber();
    }
  };
  
  // Handle search button click
  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchSerialNumber();
    }
  };
  
  // Search for serial number
  const searchSerialNumber = async () => {
    try {
      setLoading(true);
      setError('');
      
      // First, check if this is a replacement serial number
      const replacementResponse = await fetch(`${SummaryApi.findByReplacementSerial.url}/${searchQuery.trim()}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const replacementData = await replacementResponse.json();
      
      // If we found that this is a replacement serial number
      if (replacementData.success && replacementData.data) {
        const replacement = replacementData.data;
        
        // Get original product details
        const productResponse = await fetch(`${SummaryApi.getSerialNumberDetails.url}/${replacement.serialNumber}`, {
          method: SummaryApi.getSerialNumberDetails.method || 'GET',
          credentials: 'include'
        });
        
        const productData = await productResponse.json();
        
        if (productData.success && productData.data) {
          setReplacementData({
            ...replacement,
            productDetails: productData.data
          });
          setProductDetails(null);
          setShowModal(true);
        } else {
          setError('Could not load product details');
        }
        return;
      }
      
      // Second, check if this serial has a pending warranty claim
      const warrantyResponse = await fetch(`${SummaryApi.checkWarrantyStatus.url}/${searchQuery.trim()}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const warrantyData = await warrantyResponse.json();
      
      // If we found an existing warranty claim for this serial
      if (warrantyData.success && warrantyData.data) {
        // This is a registered serial number with a pending/replaced warranty claim
        const replacement = warrantyData.data;
        
        // Get product details
        const productResponse = await fetch(`${SummaryApi.getSerialNumberDetails.url}/${replacement.serialNumber}`, {
          method: SummaryApi.getSerialNumberDetails.method || 'GET',
          credentials: 'include'
        });
        
        const productData = await productResponse.json();
        
        if (productData.success && productData.data) {
          setReplacementData({
            ...replacement,
            productDetails: productData.data
          });
          setProductDetails(null);
          setShowModal(true);
        } else {
          setError('Could not load product details');
        }
      } else {
        // This is a fresh serial number, not yet registered for warranty
        // Do the regular product details lookup
        const response = await fetch(`${SummaryApi.getSerialNumberDetails.url}/${searchQuery.trim()}`, {
          method: SummaryApi.getSerialNumberDetails.method || 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
          setProductDetails(data.data);
          setReplacementData(null);
          setShowModal(true);
        } else {
          setError(data.message || 'Serial number not found');
        }
      }
    } catch (err) {
      console.error('Error searching serial number:', err);
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch warranty replacements
  const fetchWarrantyReplacements = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedReplacements = localStorage.getItem('warrantyReplacementsData');
      
      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedReplacements) {
        setReplacements(JSON.parse(cachedReplacements));
        
        // Fetch fresh data in background
        fetchFreshReplacementsInBackground();
        setLoadingReplacements(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoadingReplacements(true);
      await fetchFreshReplacements();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedReplacements = localStorage.getItem('warrantyReplacementsData');
      
      if (cachedReplacements) {
        setReplacements(JSON.parse(cachedReplacements));
        console.log("Using cached warranty replacements data after fetch error");
      } else {
        console.error('Error fetching warranty replacements:', err);
      }
    } finally {
      setLoadingReplacements(false);
    }
  };

  // Function to fetch fresh data in background
const fetchFreshReplacementsInBackground = async () => {
  try {
    await fetchFreshReplacements(true);
  } catch (err) {
    console.error('Error fetching warranty replacements in background:', err);
  }
};

// Function to fetch fresh data directly from API
const fetchFreshReplacements = async (isBackground = false) => {
  if (!isBackground) {
    setLoadingReplacements(true);
  }
  
  try {
    const response = await fetch(SummaryApi.getAllWarrantyReplacements.url, {
      method: 'GET',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setReplacements(data.data);
      
      // Cache the replacements data
      localStorage.setItem('warrantyReplacementsData', JSON.stringify(data.data));
      
      // Update last refresh time for UI
      setLastRefreshTime(new Date().getTime());
    } else {
      if (!isBackground) {
        console.error('Failed to fetch warranty replacements:', data.message);
      }
    }
  } catch (err) {
    if (!isBackground) {
      console.error('Error fetching warranty replacements:', err);
    }
    throw err;
  } finally {
    if (!isBackground) {
      setLoadingReplacements(false);
    }
  }
};
  // Handle viewing details for a replacement
  const handleViewDetails = async (replacement) => {
    try {
      setLoading(true);
      
      // Fetch the original serial number details
      const response = await fetch(`${SummaryApi.getSerialNumberDetails.url}/${replacement.serialNumber}`, {
        method: SummaryApi.getSerialNumberDetails.method || 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setReplacementData({
          ...replacement,
          productDetails: data.data
        });
        
        setProductDetails(null);
        setShowModal(true);
      } else {
        setError('Could not load product details');
      }
    } catch (err) {
      console.error('Error loading replacement details:', err);
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle completing a replacement (add new serial number)
  const handleCompleteReplacement = async (replacementData) => {
    try {
      setLoading(true);
      
      const response = await fetch(SummaryApi.completeWarrantyReplacement.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          replacementId: replacementData.replacementId,
          newSerialNumber: replacementData.newSerialNumber,
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close the modal
        setShowModal(false);
        
        // Reset selected replacement
        setReplacementData(null);
        setProductDetails(null);
        
         // Clear cache since data has changed
        localStorage.removeItem('warrantyReplacementsData');
        
        // Refresh the replacements list
        fetchFreshReplacements();
        
        // Show success message
        alert('Product replacement completed successfully!');
      } else {
        setError(data.message || 'Failed to complete replacement');
      }
    } catch (err) {
      console.error('Error completing replacement:', err);
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Add new function to handle the update API
const handleUpdateWarranty = async (updateData) => {
  try {
    const response = await fetch(SummaryApi.updateWarrantyClaim.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Close the modal
      setShowModal(false);
      
      // Reset states
      setProductDetails(null);
      setReplacementData(null);
      
      // Clear cache since data has changed
      localStorage.removeItem('warrantyReplacementsData');

      // Refresh the replacements list
      fetchFreshReplacements();
      
      // Clear the search
      setSearchQuery('');
      
      // Show success message
      alert('Warranty issue updated successfully!');
    } else {
      console.error('Failed to update warranty:', data.message);
      setError(data.message || 'Failed to update warranty');
    }
  } catch (err) {
    console.error('Error updating warranty:', err);
    setError('Server error. Please try again later.');
  }
};

  // Handle warranty registration
  const handleRegisterWarranty = async (warrantyData) => {
    try {
      const response = await fetch(SummaryApi.registerWarrantyReplacement.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          serialNumber: warrantyData.serialNumber,
          workOrderId: warrantyData.workOrderId,
          customerName: warrantyData.customerName,
          customerPhone: warrantyData.customerPhone,
          issueDescription: warrantyData.issueDescription,
          issueCheckedBy: warrantyData.issueCheckedBy
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close the modal
        setShowModal(false);
        
        // Reset states
        setProductDetails(null);
        setReplacementData(null);

        // Clear cache since data has changed
      localStorage.removeItem('warrantyReplacementsData');
        
        // Refresh the replacements list
        fetchFreshReplacements();
        
        // Clear the search
        setSearchQuery('');
        
        // Show success message
        alert('Warranty issue registered successfully!');
      } else {
        console.error('Failed to register warranty:', data.message);
        setError(data.message || 'Failed to register warranty');
      }
    } catch (err) {
      console.error('Error registering warranty:', err);
      setError('Server error. Please try again later.');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle refreshing the component
  const handleRefresh = () => {
    setSearchQuery('');
    setError('');
    setProductDetails(null);
    setReplacementData(null);
    fetchWarrantyReplacements(true);
  };
  
  // Handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    setProductDetails(null);
    setReplacementData(null);
    setError('');
  };
  
  return (
    <div className="">
      {/* Main Container with White Box */}
      <div className="p-6 bg-white rounded-lg shadow-md max-w-[1300px]">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800">Replacement Warranty</h1>
         
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
        </div>
       
        {/* Search */}
        <div className="relative mb-4">
          <div className="flex">
            <input
              type="text"
              placeholder="Search product serial number..."
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Warranty Replacements Table */}
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-4">Warranty Replacement History</h2>
          
          {loadingReplacements ? (
            <div className="text-center py-4">
              <LoadingSpinner />
            </div>
          ) : replacements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {replacements.map((replacement) => (
                    <React.Fragment key={replacement._id}> 
                      <tr 
                        className={`hover:bg-gray-50 cursor-pointer ${expandedRowId === replacement._id ? 'bg-gray-50' : ''}`}
                        onClick={() => handleRowClick(replacement._id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {replacement.serialNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {replacement.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {replacement.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(replacement.registeredAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            replacement.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            replacement.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            replacement.status === 'replaced' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {replacement.status.charAt(0).toUpperCase() + replacement.status.slice(1)}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedRowId === replacement._id && (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 bg-gray-50 border-b">
                            <div className="flex">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(replacement);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                              >
                                View Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-t p-8 text-center">
              <p className="text-gray-500">
                No warranty replacements found.
              </p>
            </div>
          )}
        </div>
       
        {/* Empty state - only show if no replacements */}
        {!loadingReplacements && replacements.length === 0 && (
          <div className="border-t p-8 text-center">
            <p className="text-gray-500">
              Scan or enter a serialized product's serial number to check warranty status.
            </p>
          </div>
        )}
      </div>
      
      {/* Combined Serial Details and Replacement Modal */}
      <SerialDetailsModal
        isOpen={showModal}
        onClose={handleCloseModal}
        productDetails={productDetails}
        replacementData={replacementData}
        onRegisterWarranty={handleRegisterWarranty}
        onUpdateWarranty={handleUpdateWarranty}
        onCompleteReplacement={handleCompleteReplacement}
      />
    </div>
  );
};

export default ReplacementWarranty;   