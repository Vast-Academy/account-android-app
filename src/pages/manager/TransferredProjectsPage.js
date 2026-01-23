import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiUser, FiSearch, FiRefreshCw, FiEye } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import TransferProjectModal from './TransferProjectModal';

const TRANSFERRED_PROJECTS_CACHE_KEY = 'transferredProjectsData';

const TransferredProjectsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferredProjects, setTransferredProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);
  const [approvedProjects, setApprovedProjects] = useState([]);

  // Fetch transferred projects
  const fetchTransferredProjects = async (forceFresh = false) => {
  try {
    setLoading(true);
    setError(null);
    
    // Check if cached data exists and forceFresh is not true
    const cachedData = localStorage.getItem(TRANSFERRED_PROJECTS_CACHE_KEY);
    
    if (!forceFresh && cachedData) {
      const parsedData = JSON.parse(cachedData);
      
      setTransferredProjects(parsedData); // Set the cached projects
      setFilteredProjects(parsedData); // Set the filtered projects
      setLoading(false); // End loading
      return; // No need to fetch from API
    }

    // Fetch fresh data from API if no cache or forceFresh is true
    let branchParam = '';
    if (user.selectedBranch) {
      branchParam = `?branch=${user.selectedBranch}`;
    }
    
    const statusParam = branchParam ? '&status=transferring' : '?status=transferring';
    
    const response = await fetch(`${SummaryApi.getManagerProjects.url}${branchParam}${statusParam}`, {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      // Save the fetched data to state
      setTransferredProjects(data.data);
      setFilteredProjects(data.data);

      // Cache the fetched data in localStorage
      localStorage.setItem(TRANSFERRED_PROJECTS_CACHE_KEY, JSON.stringify(data.data));
    } else {
      setError(data.message || 'Failed to fetch transferred projects');
    }
  } catch (err) {
    setError('Server error. Please try again later.');
    console.error('Error fetching transferred projects:', err);
  } finally {
    setLoading(false);
  }
};

  
  // Initial data fetch
  useEffect(() => {
    fetchTransferredProjects();
  }, [user.selectedBranch]);
  
  // Filter projects when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProjects(transferredProjects);
      return;
    }
    
    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = transferredProjects.filter(project => 
      (project.customerName && project.customerName.toLowerCase().includes(lowercaseQuery)) ||
      (project.projectType && project.projectType.toLowerCase().includes(lowercaseQuery)) ||
      (project.technician && 
        (`${project.technician.firstName} ${project.technician.lastName}`).toLowerCase().includes(lowercaseQuery)) ||
      (project.orderId && project.orderId.toLowerCase().includes(lowercaseQuery))
    );
    
    setFilteredProjects(filtered);
  }, [searchQuery, transferredProjects]);
  
  // Format date function
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
  
  // Handle row click to expand/collapse details
  const handleRowClick = (projectId) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectId);
    }
  };
  
  // Handle transferring project
  const handleTransferProject = async (project) => {
    try {
      setLoading(true);
      
      // Fetch full project details
      const response = await fetch(`${SummaryApi.getWorkOrderDetails.url}/${project.customerId}/${project.orderId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedProject(data.data);
        setShowTransferModal(true);
      } else {
        console.error('API returned error:', data.message);
        // If API fails, use the basic project data we have
        setSelectedProject(project);
        setShowTransferModal(true);
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
      // Fall back to basic project data
      setSelectedProject(project);
      setShowTransferModal(true);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle project transfer completion
  const handleProjectTransferred = (updatedProject) => {
    // Update the project in the list - change status to transferred instead of removing
    setTransferredProjects(prev => 
      prev.map(p => {
        if (p.orderId === updatedProject.orderId && p.customerId === updatedProject.customerId) {
          return { ...p, status: 'transferred' };
        }
        return p;
      })
    );
    
    // Update filtered projects as well
    setFilteredProjects(prev => 
      prev.map(p => {
        if (p.orderId === updatedProject.orderId && p.customerId === updatedProject.customerId) {
          return { ...p, status: 'transferred' };
        }
        return p;
      })
    );
    
    // Close modal
    setShowTransferModal(false);
  };
  
  if (loading && !transferredProjects.length) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="">
      {/* Main Container with White Box */}
      <div className="p-6 bg-white rounded-lg shadow-md max-w-[1300px]">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800">Transferred Projects</h1>
          
          <button
            onClick={fetchTransferredProjects}
            className="flex items-center px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
        </div>
        
        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        
        {error && (
          <div className="mx-4 mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {/* Projects Table */}
        <div className="border-t">
          {filteredProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.NO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TECHNICIAN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CUSTOMER</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PROJECT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CATEGORY</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STOP REQUESTED</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProjects.map((project, index) => (
                    <React.Fragment key={`${project.customerId}-${project.orderId}`}>
                      <tr 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          expandedProject === `${project.customerId}-${project.orderId}` ? 'bg-gray-50' : ''
                        }`}
                        onClick={() => handleRowClick(`${project.customerId}-${project.orderId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {project.technician ? (
                            <div className="font-medium text-gray-900">
                              {project.technician.firstName} {project.technician.lastName}
                            </div>
                          ) : (
                            <span className="text-gray-500">Not Assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {project.projectType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            project.projectCategory === 'Repair' 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {project.projectCategory === 'Repair' ? 'Complaint' : 'New Installation'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(project.updatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs capitalize bg-red-100 text-red-800">
                            Transferring
                          </span>
                        </td>
                      </tr>
                      
                      {/* Expanded row */}
                      {expandedProject === `${project.customerId}-${project.orderId}` && (
                        <tr>
                          <td colSpan="8" className="px-6 py-4 bg-gray-50 border-b">
                            <div className="flex ">
                              
                            <button 
  onClick={(e) => {
    e.stopPropagation();
    handleTransferProject(project);
  }}
  className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
>
  <FiArrowLeft className="mr-2" /> 
  {project.status === 'transferring' ? 'View Details & Approve' : 'View Details'}
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
            <div className="p-8 text-center">
              {searchQuery ? (
                <p className="text-gray-500">
                  No transferred projects matching "{searchQuery}" found.
                </p>
              ) : (
                <p className="text-gray-500">
                  No transferred projects found.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Transfer Project Modal */}
      {showTransferModal && (
        <TransferProjectModal 
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onProjectTransferred={handleProjectTransferred}
        />
      )}
    </div>
  );
};

export default TransferredProjectsPage;