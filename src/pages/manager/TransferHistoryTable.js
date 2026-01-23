// components/manager/TransferHistoryTable.jsx
import React, { useState, useEffect } from 'react';
import { FiArrowRight, FiFilter, FiDownload } from 'react-icons/fi';
import SummaryApi from '../../common';

const TransferHistoryTable = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  
  // Fetch transfer history
  useEffect(() => {
    fetchTransferHistory();
  }, []);
  
  const fetchTransferHistory = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedTransfers = localStorage.getItem('transferHistoryData');
      
      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedTransfers) {
        setTransfers(JSON.parse(cachedTransfers));
        
        // Fetch fresh data in background
        fetchFreshTransferHistoryInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshTransferHistory();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedTransfers = localStorage.getItem('transferHistoryData');
      
      if (cachedTransfers) {
        setTransfers(JSON.parse(cachedTransfers));
        console.log("Using cached transfer history data after fetch error");
      } else {
        setError('Error loading transfer history. Please try again.');
        console.error('Error fetching transfer history:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch fresh data in background
const fetchFreshTransferHistoryInBackground = async () => {
  try {
    await fetchFreshTransferHistory(true);
  } catch (err) {
    console.error('Error fetching transfer history in background:', err);
  }
};

// Function to fetch fresh data directly from API
const fetchFreshTransferHistory = async (isBackground = false) => {
  if (!isBackground) {
    setLoading(true);
  }
  
  try {
    const response = await fetch(SummaryApi.getTransferHistory.url, {
      method: SummaryApi.getTransferHistory.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setTransfers(data.data);
      
      // Cache the transfer history data
      localStorage.setItem('transferHistoryData', JSON.stringify(data.data));
      
      // Update last refresh time for UI
      setLastRefreshTime(new Date().getTime());
    } else {
      if (!isBackground) {
        setError(data.message || 'Failed to load transfer history');
      }
    }
  } catch (err) {
    if (!isBackground) {
      setError('Error loading transfer history. Please try again.');
      console.error('Error fetching transfer history:', err);
    }
    throw err;
  } finally {
    if (!isBackground) {
      setLoading(false);
    }
  }
};
  
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
  
  // Filter transfers based on selection
  const filteredTransfers = transfers.filter(transfer => {
    if (filterType === 'all') return true;
    if (filterType === 'to-branch') return transfer.to === 'Branch Inventory';
    if (filterType === 'from-branch') return transfer.from === 'Branch Inventory';
    return true;
  });
  
  // Export to CSV
  const exportToCsv = () => {
    // Create CSV header
    const header = [
      'Date', 'Item ID', 'Item Name', 'Type', 'From', 'To', 
      'Quantity', 'Serial Number', 'Transferred By'
    ].join(',');
    
    // Create CSV rows
    const rows = filteredTransfers.map(transfer => [
      formatDate(transfer.timestamp),
      transfer.itemId,
      transfer.itemName,
      transfer.type.replace('-product', ''),
      transfer.from,
      transfer.to,
      transfer.quantity,
      transfer.serialNumber || 'N/A',
      transfer.transferredBy
    ].join(','));
    
    // Combine header and rows
    const csv = [header, ...rows].join('\n');
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `transfer-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Inventory Transfer History</h2>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-8 pr-4 py-2 border rounded-md appearance-none"
            >
              <option value="all">All Transfers</option>
              <option value="from-branch">Assigned to Technicians</option>
              <option value="to-branch">Returned from Technicians</option>
            </select>
            <FiFilter className="absolute left-2 top-3 text-gray-500" />
          </div>
          
          <button 
            onClick={exportToCsv}
            className="bg-green-50 text-green-600 px-3 py-2 rounded-md flex items-center"
          >
            <FiDownload className="mr-1" /> Export
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-4">
          <p>Loading transfer history...</p>
        </div>
      ) : filteredTransfers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransfers.map((transfer, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatDate(transfer.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium">{transfer.itemName}</div>
                    <div className="text-xs text-gray-500">ID: {transfer.itemId}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                <div className="flex items-center justify-center">
                    <span>{transfer.from}</span>
                    <FiArrowRight className="mx-2 text-blue-500" />
                    <span>{transfer.to}</span>
                </div>
                </td>
                 <td className="px-4 py-3 whitespace-nowrap">
                   <div className="text-sm">
                     {transfer.quantity} {transfer.unit}
                     {transfer.type === 'serialized-product' && transfer.serialNumber && (
                       <div className="text-xs text-gray-500">
                         S/N: {transfer.serialNumber}
                       </div>
                     )}
                   </div>
                 </td>
                 <td className="px-4 py-3 whitespace-nowrap text-sm">
                   {transfer.transferredBy}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     ) : (
       <div className="text-center py-8">
         <p className="text-gray-500">No transfer records found</p>
       </div>
     )}
   </div>
 );
};

export default TransferHistoryTable;