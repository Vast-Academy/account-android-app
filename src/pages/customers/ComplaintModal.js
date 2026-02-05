// components/customers/ComplaintModal.jsx
import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const ComplaintModal = ({ isOpen, onClose, customerId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [customerProjects, setCustomerProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [complaintRemark, setComplaintRemark] = useState('');
  const [fetchingProjects, setFetchingProjects] = useState(false);
  
 // Fetch customer's existing completed projects
const fetchCustomerProjects = async () => {
  if (!customerId) return;
  
  try {
    setFetchingProjects(true);
    setError(null);
    
    const response = await fetch(`${SummaryApi.getCustomer.url}/${customerId}`, {
      method: SummaryApi.getCustomer.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success && data.data.projects && data.data.projects.length > 0) {
      // Filter projects to include only those with completed work orders
      const completedProjects = [];
      
      // Loop through all projects
      for (const project of data.data.projects) {
        // Find work orders for this project
        const matchingWorkOrder = data.data.workOrders && 
          data.data.workOrders.find(wo => 
            wo.projectId === project.projectId && wo.status === 'completed'
          );
        
        // If there's a completed work order for this project, add it to our list
        if (matchingWorkOrder) {
          completedProjects.push(project);
        }
      }
      
      setCustomerProjects(completedProjects);
      
      // Auto-select the first project if available
      if (completedProjects.length > 0) {
        setSelectedProjectId(completedProjects[0].projectId);
      } else {
        setError('No completed projects found for this customer');
      }
    } else {
      setError('No projects found for this customer');
    }
  } catch (err) {
    setError('Server error. Please try again later.');
    console.error('Error fetching customer projects:', err);
  } finally {
    setFetchingProjects(false);
  }
};
  
  // Fetch projects when modal opens
  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerProjects();
      // Reset form state
      setComplaintRemark('');
      setError(null);
    }
  }, [isOpen, customerId]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    
    if (!complaintRemark.trim()) {
      setError('Please enter complaint details');
      return;
    }
    
    try {
      setLoading(true);
      
      // Find the selected project to get its type
      const projectDetails = customerProjects.find(p => p.projectId === selectedProjectId);
      
      if (!projectDetails) {
        setError('Selected project not found');
        setLoading(false);
        return;
      }
      
      // Use the existing work order API but specify repair category
      const response = await fetch(SummaryApi.createWorkOrder.url, {
        method: SummaryApi.createWorkOrder.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          projectType: projectDetails.projectType,
          projectCategory: 'Repair', // Always "Repair" for complaints
          initialRemark: complaintRemark,
          existingProjectId: selectedProjectId // Pass the existing project ID
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onSuccess) onSuccess(data.data);
        onClose();

        navigate('/work-orders');
      } else {
        setError(data.message || 'Failed to create complaint');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error creating complaint:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create Complaint</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {fetchingProjects ? (
          <div className="py-4 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project*
              </label>
              {customerProjects.length > 0 ? (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a Project</option>
                  {customerProjects.map(project => (
                    <option key={project.projectId} value={project.projectId}>
                      {project.projectType} ({project.projectId}) - {new Date(project.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-yellow-600">No projects available for this customer</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complaint Details*
              </label>
              <textarea
                value={complaintRemark}
                onChange={(e) => setComplaintRemark(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Enter details about the complaint..."
                required
              ></textarea>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={loading || customerProjects.length === 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Complaint'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ComplaintModal;