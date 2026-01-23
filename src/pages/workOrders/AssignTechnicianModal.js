// components/AssignTechnicianModal.jsx
import React, { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

const AssignTechnicianModal = ({ isOpen, onClose, workOrder, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [error, setError] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [instructions, setInstructions] = useState('');
  
  // Fetch technicians based on user role
  const fetchTechnicians = async () => {
    try {
      setLoadingTechnicians(true);
      
      // Use different endpoint based on role
      const endpoint = user.role === 'admin' 
        ? SummaryApi.getTechnicianUsers.url 
        : SummaryApi.getManagerTechnician.url;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTechnicians(data.data);
      } else {
        setError('Failed to load technicians');
      }
    } catch (err) {
      setError('Server error while loading technicians');
      console.error('Error fetching technicians:', err);
    } finally {
      setLoadingTechnicians(false);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      fetchTechnicians();
      // Reset form state
      setSelectedTechnician('');
      setInstructions('');
      setError(null);
    }
  }, [isOpen]);

  // कहीं useEffect imports के बाद और component के अंदर
useEffect(() => {
  if (isOpen && workOrder) {
    console.log("Modal workOrder:", workOrder); // यह console में दिखाएगा कि क्या initialRemark मिल रहा है
  }
}, [isOpen, workOrder]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedTechnician) {
      setError('Please select a technician');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(SummaryApi.assignTechnician.url, {
        method: SummaryApi.assignTechnician.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: workOrder.customerId,
          orderId: workOrder.orderId,
          technicianId: selectedTechnician,
          instructions
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onSuccess) onSuccess(data.data);
      } else {
        setError(data.message || 'Failed to assign technician');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error assigning technician:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen || !workOrder) return null;
  
  const isComplaint = workOrder.projectCategory === 'Repair';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {/* Added max-height and overflow-y-auto for scrolling */}
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isComplaint ? 'Assign Technician to Complaint' : 'Assign Technician'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>
        
        {/* Added overflow-y-auto to make only the content area scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="font-medium text-gray-700">
              {isComplaint ? 'Complaint Details:' : 'Work Order Details:'}
            </h3>
            <div className={`mt-2 p-3 rounded-md ${isComplaint ? 'bg-orange-50' : 'bg-gray-50'}`}>
              {isComplaint ? (
                <div className="mb-2 p-2 bg-white rounded border border-orange-200">
                  <p className="font-medium text-orange-700 mb-1">Project Information:</p>
                  <p><span className="font-medium">Type:</span> {workOrder.projectType}</p>
                  <p><span className="font-medium">Project ID:</span> {workOrder.projectId}</p>
                  <p><span className="font-medium">Created:</span> {
                    workOrder.projectCreatedAt 
                      ? new Date(workOrder.projectCreatedAt).toLocaleDateString() 
                      : new Date(workOrder.createdAt).toLocaleDateString()
                  }</p>
                </div>
              ) : (
                <p><span className="font-medium">Project:</span> {workOrder.projectType}</p>
              )}
              <p><span className="font-medium">Customer:</span> {workOrder.customerName}</p>
              
              {workOrder.initialRemark && (
                <p className="mt-2">
                  <span className="font-medium">
                    {isComplaint ? 'Complaint Remark:' : 'Project Remark:'}
                  </span>
                  <br />
                  <span className="text-gray-700">{workOrder.initialRemark}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Add this block to display original technician info for repair category */}
          {isComplaint && workOrder.originalTechnician && (
            <div className="mb-4">
              <h3 className="font-medium text-orange-700 mb-1">Setup Technician:</h3>
              <div className="mt-2 p-2 bg-white rounded border border-orange-200">
                <p><span className="font-medium">Name:</span> {workOrder.originalTechnician.firstName} {workOrder.originalTechnician.lastName}</p>
                {workOrder.originalTechnician.phoneNumber && (
                  <p><span className="font-medium">Phone:</span> {workOrder.originalTechnician.phoneNumber}</p>
                )}
                {workOrder.projectCreatedAt && (
                  <p><span className="font-medium">Project Completed on:</span> {new Date(workOrder.projectCreatedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )}
          
          {loadingTechnicians ? (
            <div className="py-4 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Technician*
                </label>
                {technicians.length > 0 ? (
                  <select
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a Technician</option>
                    {technicians.map(tech => (
                      <option key={tech._id} value={tech._id}>
                        {tech.firstName} {tech.lastName} - {tech.branch?.name || 'No Branch'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-yellow-600">No technicians available</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions for Technician
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder={`Enter instructions for the technician ${isComplaint ? 'handling this complaint' : ''}...`}
                ></textarea>
              </div>
            </form>
          )}
        </div>
        
        {/* Fixed footer for buttons */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={loading || technicians.length === 0 || !selectedTechnician}
              className={`px-4 py-2 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 ${
                isComplaint ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {loading ? 'Assigning...' : 'Assign Technician'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTechnicianModal;