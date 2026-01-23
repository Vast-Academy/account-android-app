import React, { useState, useEffect } from 'react';
import { FiUsers } from 'react-icons/fi';
import Modal from '../../components/Modal';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';

const SelectTechnicianModal = ({ isOpen, onClose, onSelectTechnician }) => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  // Fetch technicians when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTechnicians();
    }
  }, [isOpen]);

  // Fetch technicians for the manager's branch
  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(SummaryApi.getManagerTechnician.url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTechnicians(data.data || []);
      } else {
        setError('Failed to fetch technicians');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching technicians:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle technician selection
  const handleTechnicianChange = (e) => {
    const techId = e.target.value;
    const tech = technicians.find(t => t._id === techId);
    setSelectedTechnician(tech);
  };

  // Handle confirmation
  const handleConfirm = () => {
    if (selectedTechnician) {
      onSelectTechnician(selectedTechnician);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Technician to Assign Inventory"
      size="md"
    >
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="technician">
                Select Technician
              </label>
              
              {technicians.length > 0 ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FiUsers className="h-5 w-5 text-gray-400" />
                  </div>
                  
                  <select
                    id="technician"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    onChange={handleTechnicianChange}
                    value={selectedTechnician?._id || ''}
                  >
                    <option value="">-- Select a technician --</option>
                    {technicians.map(tech => (
                      <option key={tech._id} value={tech._id}>
                        {tech.firstName} {tech.lastName} ({tech.username})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded-md">
                  <p className="text-gray-500">No technicians available for your branch.</p>
                </div>
              )}
            </div>

            {selectedTechnician && (
              <div className="mb-6 p-3 bg-blue-50 rounded-md">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Selected Technician:</h3>
                <p className="text-sm">
                  <span className="font-medium">{selectedTechnician.firstName} {selectedTechnician.lastName}</span><br />
                  Username: {selectedTechnician.username}<br />
                  Branch: {selectedTechnician.branch && typeof selectedTechnician.branch === 'object' 
                    ? selectedTechnician.branch.name 
                    : 'N/A'}
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedTechnician}
                className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white ${
                  !selectedTechnician
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-teal-500 hover:bg-teal-600'
                }`}
              >
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SelectTechnicianModal;