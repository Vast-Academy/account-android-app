import React, { useState } from 'react';
import SerializedProductsList from './SerializedProductsList';
import GenericProductsList from './GenericProductsList';
import ServicesList from './ServicesList';
import AllInventoryItems from './AllInventoryItems';
import UnifiedInventoryAssignmentModal from './UnifiedInventoryAssignmentModal';
import SelectTechnicianModal from '../technician/SelectTechnicianModal';
import { FiSearch, FiPackage } from 'react-icons/fi';
import { useNotification } from '../../context/NotificationContext';

const InventoryManagement = () => {
  // State to track which filter is currently selected
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { showNotification } = useNotification();
  
  // States for modals
  const [isTechnicianModalOpen, setIsTechnicianModalOpen] = useState(false);
  const [isAssignInventoryModalOpen, setIsAssignInventoryModalOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Function to handle filter button clicks
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  // Open technician selection modal
  const openAssignInventoryFlow = () => {
    setIsTechnicianModalOpen(true);
  };

  // Handle technician selection
  const handleTechnicianSelect = (technician) => {
    setSelectedTechnician(technician);
    setIsAssignInventoryModalOpen(true);
  };

  // Handle inventory assignment success
  const handleAssignmentSuccess = () => {
    showNotification('success', `Inventory successfully assigned to ${selectedTechnician.firstName} ${selectedTechnician.lastName}`);
    setIsAssignInventoryModalOpen(false);
    setSelectedTechnician(null);
    setRefreshCount(prev => prev + 1);
  };

  // Render the appropriate component based on activeFilter
  const renderContent = () => {
    switch (activeFilter) {
      case 'serialized':
        return <SerializedProductsList searchTerm={searchTerm} refreshTrigger={refreshCount}/>;
      case 'generic':
        return <GenericProductsList searchTerm={searchTerm} refreshTrigger={refreshCount} />;
      case 'services':
        return <ServicesList searchTerm={searchTerm} refreshTrigger={refreshCount} />;
      default:
        return <AllInventoryItems searchTerm={searchTerm} refreshTrigger={refreshCount}/>;
    }
  };

  return (
    <div>
      {/* Main container card with shadow */}
      <div className="px-6 bg-white rounded-lg shadow-md overflow-hidden max-w-[1300px]">
        {/* Header section with title and search */}
        <div className="py-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-1">
            <h1 className="text-2xl font-semibold text-gray-800">Inventory</h1>
            
          </div>
         
          {/* Filter and search row */}
          <div className="flex items-center justify-between mt-4">
             {/* Assign Inventory Button */}
             <button
              onClick={openAssignInventoryFlow}
              className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 flex items-center"
            >
              <FiPackage className="mr-2" />
              Assign Inventory
            </button>

            {/* Filter buttons */}
            <div className="flex space-x-2 mb-2 sm:mb-0">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  activeFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('serialized')}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  activeFilter === 'serialized'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Serialized
              </button>
              <button
                onClick={() => handleFilterChange('generic')}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  activeFilter === 'generic'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Generic
              </button>
              <button
                onClick={() => handleFilterChange('services')}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  activeFilter === 'services'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Services
              </button>
            </div>
           
          </div>
          {/* Search bar */}
          <div className="relative mt-4 w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>
       
        {/* Content section */}
        <div className="p-0">
          {renderContent()}
        </div>
      </div>

      {/* Select Technician Modal */}
      <SelectTechnicianModal
        isOpen={isTechnicianModalOpen}
        onClose={() => setIsTechnicianModalOpen(false)}
        onSelectTechnician={handleTechnicianSelect}
      />

      {/* Unified Inventory Assignment Modal */}
      {selectedTechnician && (
        <UnifiedInventoryAssignmentModal
          isOpen={isAssignInventoryModalOpen}
          onClose={() => setIsAssignInventoryModalOpen(false)}
          technician={selectedTechnician}
          onSuccess={handleAssignmentSuccess}
        />
      )}
    </div>
  );
};

export default InventoryManagement;