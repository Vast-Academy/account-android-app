import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Clipboard, 
  CheckSquare, 
  List, 
  Bell, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Sun, 
  Moon,
  ArrowLeft,
  Activity,
  Eye,
  Home,
  LogOut,
  X,
  Phone, 
  MessageSquare,
  ChevronDown,
  FileText,
  
} from 'lucide-react';
import { LuCctv } from "react-icons/lu";
import { useAuth } from '../../context/AuthContext';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import InventoryDetailsModal from './InventoryDetailsModal';
import WorkOrderDetailsModal from './WorkOrderDetailsModal';
import ReturnInventoryModal from './ReturnInventoryModal';
import GenerateBillModal from './GenerateBillModal';
import { FiPause } from 'react-icons/fi';
import UserSettingsModal from '../users/UserSettingsModal';

const TechnicianDashboard = () => {
  const { user, logout } = useAuth();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false); // Default light mode
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize with value from sessionStorage, default to 'home' if not set
    return sessionStorage.getItem('technicianDashboardActiveTab') || 'home';
  });
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState({
    inventory: 0,
    workOrders: 0
  });
  
  
  // States for modals
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  // New states for inventory tab UI changes
  const [activeInventoryTab, setActiveInventoryTab] = useState('products'); // 'products' or 'services'
  const [productSortType, setProductSortType] = useState('serialized'); // 'serialized' or 'generic'
  const [serviceSortType, setServiceSortType] = useState('nameAsc'); // 'nameAsc', 'nameDesc', 'priceLowHigh', 'priceHighLow'

  // Ref for scroll container to detect scroll position
  const inventoryListRef = useRef(null);

  const [inventoryFilter, setInventoryFilter] = useState('All');
  const [expandedItems, setExpandedItems] = useState([]);
  // Add these state variables
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showStopProjectModal, setShowStopProjectModal] = useState(false);
  const [pauseProjectRemark, setPauseProjectRemark] = useState('');
  const [showBillModal, setShowBillModal] = useState(false);
  const [showPauseConfirmationModal, setShowPauseConfirmationModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferRemark, setTransferRemark] = useState('');
  const [transferredProjects, setTransferredProjects] = useState([]);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // नया कॉन्स्टेंट जोड़ें
const CACHE_STALENESS_TIME = 15 * 1000;

  // Handle logout
  const handleLogout = () => {
    setShowLogoutPopup(false); // Close popup first
    sessionStorage.removeItem('technicianDashboardActiveTab');
    logout(); // Call the logout function from AuthContext
    // Redirect to login page will be handled by AuthContext/Router
  };

  // Add these functions to handle customer interactions
const handleCallCustomer = (project) => {
  if (project.customerPhone) {
    // Record this action in status history
    addActivityToHistory(project, `Call initiated to customer`);
    
    // Actually make the call
    window.location.href = `tel:${project.customerPhone}`;
  } else {
    alert('Customer phone number not available');
  }
};

const handleMessageCustomer = (project) => {
  if (project.customerWhatsapp || project.customerPhone) {
    // Record this action in status history
    addActivityToHistory(project, `WhatsApp message initiated to customer`);
    
    // Open WhatsApp with the number
    const phoneNumber = project.customerWhatsapp || project.customerPhone;
    window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`, '_blank');
  } else {
    alert('Customer contact number not available');
  }
};

// Add this function with your other customer interaction functions
const handleCallOriginalTechnician = (project) => {
  if (project.originalTechnician && project.originalTechnician.phoneNumber) {
    // Record this action in status history
    addActivityToHistory(project, `Call initiated to setup technician (${project.originalTechnician.firstName} ${project.originalTechnician.lastName})`);
    
    // Actually make the call
    window.location.href = `tel:${project.originalTechnician.phoneNumber}`;
  } else {
    alert('Original technician phone number not available');
  }
};

// Function to add activity to history
const addActivityToHistory = async (project, activityText) => {
  try {
    const response = await fetch(SummaryApi.addWorkOrderRemark.url, {
      method: SummaryApi.addWorkOrderRemark.method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        customerId: project.customerId,
        orderId: project.orderId,
        remark: activityText,
        activityType: 'communication'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the work order in our state
      setWorkOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.orderId === project.orderId) {
            const updatedOrder = {
              ...order,
              statusHistory: [
                ...order.statusHistory || [],
                {
                  status: 'communication',
                  remark: activityText,
                  updatedBy: user._id,
                  updatedAt: new Date()
                }
              ]
            };
            return updatedOrder;
          }
          return order;
        });
      });
    }
  } catch (err) {
    console.error('Error recording activity:', err);
  }
};
  
// Function to stop/pause the project
// पॉज़ प्रोजेक्ट फंक्शन को अपडेट करें
const handleStopProject = (project) => {
  if (!pauseProjectRemark.trim()) {
    return;
  }
  
  // पहले कन्फर्मेशन दिखाएं बजाय सीधे पॉज़ करने के
  setShowPauseConfirmationModal(true);
};

// कन्फर्मेशन के बाद पॉज़ का लॉजिक
const confirmPauseProject = async (project) => {
  try {
    setLoading(true);
    
    const response = await fetch(SummaryApi.updateWorkOrderStatus.url, {
      method: SummaryApi.updateWorkOrderStatus.method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        customerId: project.customerId,
        orderId: project.orderId,
        status: 'paused',
        remark: pauseProjectRemark
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the work orders state
      setWorkOrders(prevOrders => 
        prevOrders.map(order => 
          order.orderId === project.orderId ? {...order, status: 'paused'} : order
        )
      );
      
      // Close the modals
      setShowStopProjectModal(false);
      setShowPauseConfirmationModal(false);
      
      // Clear the remark
      setPauseProjectRemark('');
      
      // Navigate back to home
      handleTabChange('home');
    } else {
      alert(data.message || 'Failed to pause project');
    }
  } catch (err) {
    console.error('Error pausing project:', err);
    alert('Server error. Please try again.');
  } finally {
    setLoading(false);
  }
};

// Function to stop/transfer the project
const handleTransferProject = async (project) => {
  if (!transferRemark.trim()) {
    return;
  }
  
  try {
    setLoading(true);
    
    const response = await fetch(SummaryApi.updateWorkOrderStatus.url, {
      method: SummaryApi.updateWorkOrderStatus.method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        customerId: project.customerId,
        orderId: project.orderId,
        status: 'transferring',
        remark: transferRemark
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the work orders state - don't remove yet, just update status
      setWorkOrders(prevOrders => 
        prevOrders.map(order => 
          order.orderId === project.orderId ? {...order, status: 'transferring'} : order
        )
      );
      
      // Close the modal
      setShowTransferModal(false);
      
      // Clear the remark
      setTransferRemark('');
      
      // Navigate back to home
      handleTabChange('home');
    } else {
      alert(data.message || 'Failed to stop project');
    }
  } catch (err) {
    console.error('Error stopping project:', err);
    alert('Server error. Please try again.');
  } finally {
    setLoading(false);
  }
};

// Add a handler for bill generation completion
const handleBillGenerated = async (selectedItems, paymentCompleted = false) => {
  console.log('Bill items:', selectedItems, 'Payment completed:', paymentCompleted);
  
  if (paymentCompleted) {
    // If payment is completed, update the project status to pending-approval
    try {
      // First, find the active project to get all necessary details
      const activeProject = workOrders.find(order => order.status === 'in-progress');
      
      if (activeProject) {
        // Update the work order in our state - move from in-progress to pending-approval
        const updatedWorkOrders = workOrders.map(order => {
          if (order.orderId === activeProject.orderId) {
            return { ...order, status: 'pending-approval' };
          }
          return order;
        });
        
        setWorkOrders(updatedWorkOrders);
        
        // Update localStorage cache
        const cachedOrders = localStorage.getItem('technicianWorkOrders');
        if (cachedOrders) {
          const parsedOrders = JSON.parse(cachedOrders);
          const updatedCachedOrders = parsedOrders.map(order => {
            if (order.orderId === activeProject.orderId) {
              return { ...order, status: 'pending-approval' };
            }
            return order;
          });
          
          localStorage.setItem('technicianWorkOrders', JSON.stringify(updatedCachedOrders));
          localStorage.setItem('technicianWorkOrdersTimestamp', new Date().getTime().toString());
        }
        
        // Redirect to home tab since project is no longer in-progress
        handleTabChange('home');
        
        // Show a success message
        // alert('Payment completed. Project has been marked for approval.');
      }
    } catch (err) {
      console.error('Error updating project status:', err);
    }
    
    // Refresh work orders data to get the updated state with payment info
    fetchWorkOrders();

    // Add this line to refresh the inventory data
    fetchInventory(true); 
  }
};

// Update the handleWorkOrderClick function to handle bill generation separately
const handleGenerateBill = (activeProject) => {
  setSelectedWorkOrder(activeProject);
  setShowBillModal(true);
};

// Add a helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

  // Toggle profile popup
  const toggleLogoutPopup = () => {
    setShowLogoutPopup(!showLogoutPopup);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && !event.target.closest('.relative')) {
        setProfileDropdownOpen(false);
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);


   // Function to handle tab changes
   const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Store the active tab in sessionStorage
    sessionStorage.setItem('technicianDashboardActiveTab', tab);
  };
  
  // Load theme preference from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('technicianDashboardTheme');
    if (savedTheme !== null) {
      setDarkMode(savedTheme === 'dark');
    }
  }, []);

  // Toggle theme and save to localStorage
  const toggleTheme = () => {
    const newThemeValue = !darkMode;
    setDarkMode(newThemeValue);
    localStorage.setItem('technicianDashboardTheme', newThemeValue ? 'dark' : 'light');
  };
  
  // Filter work orders to show only those from the last 2 days
  const getActiveWorkOrders = () => {
    // Filter by required statuses
    return workOrders.filter(order => 
      order.status === 'assigned' || 
      order.status === 'in-progress' || 
      order.status === 'paused' ||
      order.status === 'transferring'
    ).sort((a, b) => {
      // Sort by most recently updated
      if (a.updatedAt && b.updatedAt) {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
      return 0;
    });
  };

  // Add a helper function to check status text
const getStatusDisplayText = (status) => {
  switch(status) {
    case 'transferring': return 'Transfer Pending';
    case 'transferred': return 'Transferred';
    default: return status;
  }
};

  // Get quantity of an item (for sorting and display)
const getItemQuantity = (item) => {
  if (item.type === 'serialized-product') {
    return item.serializedItems?.filter(si => si.status === 'active').length || 0;
  } else {
    return item.genericQuantity || 0;
  }
};

// Handle expanding/collapsing items
const handleItemExpand = (itemKey, item) => {
  if (item.type === 'serialized-product') {
    if (expandedItems.includes(itemKey)) {
      setExpandedItems(expandedItems.filter(id => id !== itemKey));
    } else {
      setExpandedItems([...expandedItems, itemKey]);
    }
  }
};

  // Filter and sort products for 'products' tab
  const getSortedProductItems = () => {
    // Separate serialized and generic items
    const serializedItems = inventoryItems.filter(item => item.type === 'serialized-product');
    const genericItems = inventoryItems.filter(item => item.type === 'generic-product');

    // Sort serialized and generic by quantity descending
    const sortedSerialized = serializedItems.sort((a, b) => getItemQuantity(b) - getItemQuantity(a));
    const sortedGeneric = genericItems.sort((a, b) => getItemQuantity(b) - getItemQuantity(a));

    // Return combined list with serialized first then generic
    return [...sortedSerialized, ...sortedGeneric];
  };

  // Sort services for 'services' tab based on serviceSortType
  const getSortedServiceItems = () => {
    const serviceItems = inventoryItems.filter(item => item.type === 'service');

    let sortedServices = [...serviceItems];
    switch(serviceSortType) {
      case 'nameAsc':
        sortedServices.sort((a, b) => a.itemName.localeCompare(b.itemName));
        break;
      case 'nameDesc':
        sortedServices.sort((a, b) => b.itemName.localeCompare(a.itemName));
        break;
      case 'priceLowHigh':
        sortedServices.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case 'priceHighLow':
        sortedServices.sort((a, b) => b.salePrice - a.salePrice);
        break;
      default:
        break;
    }
    return sortedServices;
  };

  // Scroll event handler to detect when generic items come into view in products tab
  const handleInventoryScroll = () => {
    if (!inventoryListRef.current) return;
    const scrollTop = inventoryListRef.current.scrollTop;
    const scrollHeight = inventoryListRef.current.scrollHeight;
    const clientHeight = inventoryListRef.current.clientHeight;

    // Simple heuristic: if scrolled near bottom, select generic button
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      if (productSortType !== 'generic') {
        setProductSortType('generic');
      }
    } else {
      if (productSortType !== 'serialized') {
        setProductSortType('serialized');
      }
    }
  };

  // Effect to add scroll listener when products tab is active
  useEffect(() => {
    if (activeInventoryTab === 'products' && inventoryListRef.current) {
      const refCurrent = inventoryListRef.current;
      refCurrent.addEventListener('scroll', handleInventoryScroll);
      return () => {
        refCurrent.removeEventListener('scroll', handleInventoryScroll);
      };
    }
  }, [activeInventoryTab, productSortType]);

// Computed property for filtered items
const getFilteredInventoryItems = () => {
  if (inventoryFilter === 'All') {
    return inventoryItems;
  }
  return inventoryItems.filter(item => item.category === inventoryFilter);
};

const filteredInventoryItems = getFilteredInventoryItems();

  // Fetch technician inventory
  const fetchInventory = async (forceFresh = false) => {
    try {
      setLoading(true);

      // If forceFresh is true, clear any cached inventory data
    if (forceFresh) {
      localStorage.removeItem('technicianInventory');
      // The timestamp can also be removed or reset
      setLastRefreshTime(prev => ({...prev, inventory: 0}));
    }
      
      // चेक करें अगर कैश डेटा है और स्टेल नहीं है
      const cachedInventory = localStorage.getItem('technicianInventory');
      const currentTime = new Date().getTime();
      
      // कैश चेक केवल तभी करें जब forceFresh false हो
      if (!forceFresh && cachedInventory) {
        setInventoryItems(JSON.parse(cachedInventory));
        console.log("Using cached inventory data");
        
        // एक हिडन API कॉल करें जो डेटा को बैकग्राउंड में अपडेट करेगा
        fetchFreshInventoryInBackground();
      } else {
        // ताज़ा डेटा फेच करें
        await fetchFreshInventory();
      }
    } catch (err) {
      // अगर एरर है लेकिन कैश्ड डेटा है, तो उसे फॉलबैक के रूप में इस्तेमाल करें
      const cachedInventory = localStorage.getItem('technicianInventory');
      if (cachedInventory) {
        setInventoryItems(JSON.parse(cachedInventory));
        console.log("Using cached inventory data after fetch error");
      } else {
        setError('Error loading inventory. Please try again later.');
        console.error('Error fetching inventory:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // बैकग्राउंड में ताजा इन्वेंटरी डेटा फेच करें
const fetchFreshInventoryInBackground = async () => {
  try {
    const response = await fetch(SummaryApi.getTechnicianInventory.url, {
      method: SummaryApi.getTechnicianInventory.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // डेटा कैश करें
      localStorage.setItem('technicianInventory', JSON.stringify(data.data));
      
      // स्टेट अपडेट करें, केवल अगर कुछ अलग है
      if (JSON.stringify(data.data) !== JSON.stringify(inventoryItems)) {
        setInventoryItems(data.data);
        console.log("Inventory data updated in background");
      }
      
      // रिफ्रेश टाइम अपडेट करें
      setLastRefreshTime(prev => ({...prev, inventory: new Date().getTime()}));
    }
  } catch (err) {
    console.error('Error fetching inventory in background:', err);
  }
};

// नया फंक्शन जो डायरेक्ट API से ताज़ा डेटा प्राप्त करता है
const fetchFreshInventory = async () => {
  try {
    const response = await fetch(SummaryApi.getTechnicianInventory.url, {
      method: SummaryApi.getTechnicianInventory.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setInventoryItems(data.data);
      
      // कैश अपडेट करें
      localStorage.setItem('technicianInventory', JSON.stringify(data.data));
      
      // रिफ्रेश टाइम अपडेट करें
      setLastRefreshTime(prev => ({...prev, inventory: new Date().getTime()}));
    } else {
      setError('Failed to load inventory: ' + data.message);
    }
  } catch (err) {
    throw err;
  }
};

  // Handle inventory returned
  const handleInventoryReturned = () => {
    // Clear inventory cache to force a refresh
    localStorage.removeItem('technicianInventory');
    localStorage.removeItem('technicianInventoryTimestamp');
    // Reload inventory data
    fetchInventory();
  };

 // fetchWorkOrders फंक्शन को अपडेट करें
const fetchWorkOrders = async (forceFresh = false) => {
  try {
    // कैश चेक केवल तभी करें जब forceFresh false हो
    const cachedOrders = localStorage.getItem('technicianWorkOrders');
    
    if (!forceFresh && cachedOrders) {
      const parsedData = JSON.parse(cachedOrders);
      
      // सक्रिय और पूरे किए गए वर्क ऑर्डर्स को अलग करें
      const active = [];
      const completed = [];
      const transferred = [];
      
      parsedData.forEach(order => {
        if (order.status === 'completed') {
          completed.push(order);
        } else if (order.status === 'transferring' || order.status === 'transferred') {
          transferred.push(order);
        } else {
          active.push(order);
        }
      });
      
      setWorkOrders(active);
      setCompletedOrders(completed);
      setTransferredProjects(transferred);
      console.log("Using cached work orders data");
      
      // बैकग्राउंड में फ्रेश डेटा फेच करें
      fetchFreshWorkOrdersInBackground();
    } else {
      // ताज़ा डेटा फेच करें
      await fetchFreshWorkOrders();
    }
  } catch (err) {
    // फॉलबैक के रूप में कैश का उपयोग करें
    const cachedOrders = localStorage.getItem('technicianWorkOrders');
    if (cachedOrders) {
      const parsedData = JSON.parse(cachedOrders);
      
      // सक्रिय और पूरे किए गए वर्क ऑर्डर्स को अलग करें
      const active = [];
      const completed = [];
      
      parsedData.forEach(order => {
        if (order.status === 'completed') {
          completed.push(order);
        } else {
          active.push(order);
        }
      });
      
      setWorkOrders(active);
      setCompletedOrders(completed);
      console.log("Using cached work orders data after fetch error");
    } else {
      setError('Error loading work orders. Please try again later.');
      console.error('Error fetching work orders:', err);
    }
  } finally {
    setLoading(false);
  }
};

// बैकग्राउंड में ताजा वर्क ऑर्डर डेटा फेच करें
const fetchFreshWorkOrdersInBackground = async () => {
  try {
    const response = await fetch(SummaryApi.getTechnicianWorkOrders.url, {
      method: SummaryApi.getTechnicianWorkOrders.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // डेटा कैश करें
      localStorage.setItem('technicianWorkOrders', JSON.stringify(data.data));
      
      // सक्रिय और पूरे किए गए वर्क ऑर्डर्स को अलग करें
      const active = [];
      const completed = [];
      
      data.data.forEach(order => {
        if (order.status === 'completed') {
          completed.push(order);
        } else {
          active.push(order);
        }
      });
      
      // चेक करें कि क्या डेटा अलग है, अगर हां तो ही स्टेट अपडेट करें
      if (JSON.stringify(active) !== JSON.stringify(workOrders) || 
          JSON.stringify(completed) !== JSON.stringify(completedOrders)) {
        setWorkOrders(active);
        setCompletedOrders(completed);
        console.log("Work orders updated in background");
      }
      
      // रिफ्रेश टाइम अपडेट करें
      setLastRefreshTime(prev => ({...prev, workOrders: new Date().getTime()}));
    }
  } catch (err) {
    console.error('Error fetching work orders in background:', err);
  }
};

// Then add this function to your TechnicianDashboard component
const handleProjectStarted = () => {
  console.log("Project started callback received");
  
  // Dispatch event to ensure all components are updated
  if (selectedWorkOrder) {
    const isComplaint = selectedWorkOrder.projectCategory === 'Repair' || 
                       selectedWorkOrder.projectType?.toLowerCase().includes('repair') ||
                       selectedWorkOrder.projectType?.toLowerCase().includes('complaint');
    
    if (isComplaint) {
      // Set the flag for complaint initiated
      sessionStorage.setItem('newComplaintInitiated', 'true');
      
      // Force refresh of work orders
      fetchWorkOrders(true);
      
      // Navigate to current-project tab
      handleTabChange('current-project');
    }
  }
};

// Add this to handle complaint initialization event
useEffect(() => {
  const handleComplaintInitiated = (event) => {
    console.log("Complaint initiated event received:", event.detail);
    
    // Force a refresh of work orders data
    fetchWorkOrders(true);
    
    // For immediate UI update, we can also directly update the state
    // This way we don't need to wait for fetchWorkOrders to complete
    if (event.detail) {
      const { orderId, projectType } = event.detail;
      
      // Update any matching work order in the state
      setWorkOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.orderId === orderId) {
            return {
              ...order,
              projectCategory: 'Repair', // Ensure this is set correctly
              status: 'in-progress',
              // Add placeholder for originalTechnician until full refresh happens
              originalTechnician: order.originalTechnician || {
                firstName: 'Loading...',
                lastName: ''
              }
            };
          }
          return order;
        });
      });
      
      // Navigate to current-project tab
      handleTabChange('current-project');
    }
  };
  
  // Add event listener
  window.addEventListener('complaintInitiated', handleComplaintInitiated);
  
  // Cleanup
  return () => {
    window.removeEventListener('complaintInitiated', handleComplaintInitiated);
  };
}, []);

// नया फंक्शन जो सीधे API से ताज़ा डेटा प्राप्त करता है
const fetchFreshWorkOrders = async () => {
  try {
    const response = await fetch(SummaryApi.getTechnicianWorkOrders.url, {
      method: SummaryApi.getTechnicianWorkOrders.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Process the data to ensure project categories are properly set
      const processedData = data.data.map(order => {
        let updatedOrder = { ...order };
        
        // If projectType contains repair-related keywords but category is not set
        if ((order.projectType?.toLowerCase().includes('repair') || 
             order.projectType?.toLowerCase().includes('complaint')) && 
            !order.projectCategory) {
          updatedOrder.projectCategory = 'Repair';
        }
        
        // Ensure we keep any originalTechnician data if it was already in state
        if (!updatedOrder.originalTechnician) {
          const existingOrder = workOrders.find(o => o.orderId === order.orderId);
          if (existingOrder && existingOrder.originalTechnician) {
            updatedOrder.originalTechnician = existingOrder.originalTechnician;
          }
        }
        
        return updatedOrder;
      });
      
      // Split active and completed work orders
      const active = [];
      const completed = [];
      const transferred = [];
      
      processedData.forEach(order => {
        if (order.status === 'completed') {
          completed.push(order);
        } else if (order.status === 'transferring' || order.status === 'transferred') {
          transferred.push(order);
        } else {
          active.push(order);
        }
      });
      
      setWorkOrders(active);
      setCompletedOrders(completed);
      setTransferredProjects(transferred);
      
      // Update cache
      localStorage.setItem('technicianWorkOrders', JSON.stringify(processedData));
      
      // Update refresh time
      setLastRefreshTime(prev => ({...prev, workOrders: new Date().getTime()}));
    } else {
      setError('Failed to load work orders: ' + data.message);
    }
  } catch (err) {
    throw err;
  }
};

  // Calculate total units across all inventory items
  const calculateTotalUnits = () => {
    return inventoryItems.reduce((total, item) => {
      if (item.type === 'serialized-product') {
        const activeCount = item.serializedItems?.filter(si => si.status === 'active').length || 0;
        return total + activeCount;
      } else {
        return total + (item.genericQuantity || 0);
      }
    }, 0);
  };



  const getCategoryColorClass = (category) => {
    if (category === 'Repair') {
      return darkMode ? 'bg-purple-600' : 'bg-purple-500';
    }
    // Default to blue for 'New Installation'
    return darkMode ? 'bg-blue-600' : 'bg-blue-500';
  };

  // Get status color
  const getStatusColor = (status) => {
    if (darkMode) {
      switch(status) {
        case 'assigned': return 'bg-blue-500';
        case 'in-progress': return 'bg-purple-500';
        case 'pending-approval': return 'bg-amber-500';
        case 'paused': return 'bg-orange-500';
        case 'completed': return 'bg-green-500';
        default: return 'bg-blue-500';
      }
    } else {
      switch(status) {
        case 'assigned': return 'bg-blue-600';
        case 'in-progress': return 'bg-purple-600';
        case 'pending-approval': return 'bg-amber-600';
        case 'paused': return 'bg-orange-600';
        case 'completed': return 'bg-green-600';
        default: return 'bg-blue-600';
      }
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      await fetchInventory();
      await fetchWorkOrders();
    };
    
    loadData();
  }, []);

  // Handle inventory item click
  const handleInventoryClick = (item) => {
    setSelectedInventory(item);
    setShowInventoryModal(true);
  };

  // Handle work order click
  const handleWorkOrderClick = async (workOrder) => {
    // Check the status and redirect or open modal based on it
  if (workOrder.status === 'in-progress') {
    // Redirect to current-project tab
    handleTabChange('current-project');
    return;
  } else if (workOrder.status === 'pending-approval') {
    // Redirect to pending-approval-projects tab
    handleTabChange('pending-approval-projects');
    return;
  } else if (workOrder.status === 'completed') {
    // Redirect to pending-approval-projects tab
    handleTabChange('completed');
    return;
  } else if (workOrder.status === 'paused') {
    // For paused projects, open the modal
    // Logic to fetch data and show modal
  } else if (workOrder.status === 'assigned') {
    // For assigned projects, open the modal
    // Logic to fetch data and show modal
  }

    // अगर workOrder में पहले से billingInfo है, तो नवीनतम डेटा फेच करें
    if (workOrder.billingInfo && workOrder.billingInfo.length > 0) {
      try {
        const response = await fetch(`${SummaryApi.getWorkOrderDetails.url}/${workOrder.customerId}/${workOrder.orderId}`, {
          method: SummaryApi.getWorkOrderDetails.method,
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
          // अपडेटेड वर्क ऑर्डर को सेट करें
          setSelectedWorkOrder(data.data);
        } else {
          // अगर फेच फेल होता है तो मूल वर्क ऑर्डर को सेट करें
          setSelectedWorkOrder(workOrder);
        }
      } catch (err) {
        console.error('Error fetching detailed work order:', err);
        setSelectedWorkOrder(workOrder);
      }
    } else {
      // अगर कोई पेमेंट नहीं है तो सीधे सेट करें
      setSelectedWorkOrder(workOrder);
    }
    
    setShowWorkOrderModal(true);
  };

  // Handle work order status update
  const handleWorkOrderStatusUpdate = (updatedWorkOrder) => {
    console.log("Work order updated:", updatedWorkOrder);
    
    // Update the selected work order
    if (selectedWorkOrder && selectedWorkOrder.orderId === updatedWorkOrder.orderId) {
      setSelectedWorkOrder(updatedWorkOrder);
    }
    
    // Update the work order in our state
    if (updatedWorkOrder.status === 'completed') {
      // Move to completed orders
      setWorkOrders(prevOrders => 
        prevOrders.filter(order => order.orderId !== updatedWorkOrder.orderId)
      );
      setCompletedOrders(prevOrders => [updatedWorkOrder, ...prevOrders]);
    } else {
      setWorkOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.orderId === updatedWorkOrder.orderId) {
            return updatedWorkOrder;
          }
          return order;
        });
      });
    }
    
    // Update localStorage cache
    const cachedOrders = localStorage.getItem('technicianWorkOrders');
    if (cachedOrders) {
      const parsedOrders = JSON.parse(cachedOrders);
      const updatedOrders = parsedOrders.map(order => {
        if (order.orderId === updatedWorkOrder.orderId) {
          return updatedWorkOrder;
        }
        return order;
      });
      
      localStorage.setItem('technicianWorkOrders', JSON.stringify(updatedOrders));
      localStorage.setItem('technicianWorkOrdersTimestamp', new Date().getTime().toString());
    }

    // Agar project resumed hua hai, to current-project tab par switch kar do
  if (updatedWorkOrder.status === 'in-progress') {
    handleTabChange('current-project');
  }
  };

  if (loading) return <LoadingSpinner />;

  // Filter active inventory items (with quantity > 0 or active serial numbers)
  const activeInventoryItems = inventoryItems.filter(item => {
    if (item.type === 'serialized-product') {
      return item.serializedItems && item.serializedItems.some(si => si.status === 'active');
    } else {
      return item.genericQuantity > 0;
    }
  });

  // Get work orders from the last 2 days for tasks display
  const activeWorkOrders = getActiveWorkOrders();

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gradient-to-b from-gray-900 to-gray-800 text-white' : 'bg-gradient-to-b from-gray-100 to-white text-gray-800'}`}>
      {/* Header */}
      <header className={`p-4 ${darkMode ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-purple-500'} rounded-b-xl mx-2 shadow-xl text-white`}>
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
  <div 
    className="relative"
  >
    <div 
      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
      className="w-12 h-12 rounded-full bg-white p-1 overflow-hidden border-2 border-white shadow-lg cursor-pointer"
    >
      <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
        👨
      </div>
    </div>
    
    {/* Profile Dropdown */}
    {profileDropdownOpen && (
      <div 
        className={`absolute left-[-10px] top-16 w-48 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-md shadow-lg py-1 z-50 border`}
      >
        <div className={`px-4 py-2 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-100'}`}>
          <p className={`text-sm font-medium capitalize ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {user?.firstName} {user?.lastName}
          </p>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
            {user?.role || 'User'}
          </p>
        </div>
        
        <button 
          onClick={() => {
            // Add your settings functionality here
            setShowSettingsModal(true);
            setProfileDropdownOpen(false);
          }}
          className={`w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
        
        <button 
          onClick={() => {
            toggleLogoutPopup();
            setProfileDropdownOpen(false);
          }}
          className={`w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    )}
  </div>
  <div>
    <p className={`${darkMode ? 'text-blue-100' : 'text-blue-50'} text-xs font-medium tracking-wide`}>Welcome back,</p>
    <h1 className="font-bold text-xl">{user?.firstName || 'Technician'}</h1>
  </div>
</div>
          
          <div className="flex ">
  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center`}>
    <button 
      onClick={() => {
        fetchFreshInventory();
        fetchFreshWorkOrders();
      }}
      className={`p-2 rounded-full mr-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
    </button>
    {/* {lastRefreshTime.workOrders > 0 && (
      <span>
        Last updated: {new Date(lastRefreshTime.workOrders).toLocaleTimeString()}
      </span>
    )} */}
  </div>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all"
            >
              {darkMode ? <Sun size={20} className="text-white" /> : <Moon size={20} className="text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4">
        {activeTab === 'home' && (
          <>
            {/* Date Section */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>Today's Schedule</h2>
                <p className={`${darkMode ? 'text-white' : 'text-gray-800'} font-bold text-lg`}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {/* <button className={`${darkMode ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-blue-400 to-purple-400'} p-2 rounded-lg shadow-lg flex items-center text-white`}>
                <Calendar size={18} className="mr-2" />
                <span className="text-sm font-medium">Calendar</span>
              </button> */}
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div 
                className={`${darkMode ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-blue-400 to-blue-500'} rounded-2xl shadow-lg p-4 relative overflow-hidden text-white cursor-pointer`}
                onClick={() => handleTabChange('current-project')}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-blue-400 rounded-full opacity-20 -mt-10 -mr-10"></div>
                <div className="relative z-10">
                  <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                    <Clipboard size={20} />
                  </div>
                  <p className={`${darkMode ? 'text-blue-100' : 'text-blue-50'} text-xs font-medium mb-1`}>Active Assignments</p>
                  <div className="flex items-end">
                  <p className="text-3xl font-bold">
                    {workOrders.filter(order => order.status === 'assigned' || order.status === 'in-progress').length}
                  </p>
                    <p className={`${darkMode ? 'text-blue-200' : 'text-blue-100'} ml-2 mb-1 text-xs`}>tasks</p>
                  </div>
                </div>
              </div>
              <div 
                className={`${darkMode ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-amber-400 to-amber-500'} rounded-2xl shadow-lg p-4 relative overflow-hidden text-white cursor-pointer`}
                onClick={() => handleTabChange('pending-approval-projects')}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-amber-400 rounded-full opacity-20 -mt-10 -mr-10"></div>
                <div className="relative z-10">
                  <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                    <Activity size={20} />
                  </div>
                  <p className={`${darkMode ? 'text-amber-100' : 'text-amber-50'} text-xs font-medium mb-1`}>Pending Approvals</p>
                <div className="flex items-end">
                  <p className="text-3xl font-bold">
                    {workOrders.filter(order => order.status === 'pending-approval').length}
                  </p>
                  <p className={`${darkMode ? 'text-amber-200' : 'text-amber-100'} ml-2 mb-1 text-xs`}>tasks</p>
                </div>
                </div>
              </div>
              <div 
                className={`${darkMode ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-green-400 to-green-500'} rounded-2xl shadow-lg p-4 relative overflow-hidden text-white cursor-pointer`}
                onClick={() => handleTabChange('transferred-projects')}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-green-400 rounded-full opacity-20 -mt-10 -mr-10"></div>
                <div className="relative z-10">
                  <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                    <CheckSquare size={20} />
                  </div>
                  <p className={`${darkMode ? 'text-green-100' : 'text-green-50'} text-xs font-medium mb-1`}>Completed</p>
                  <div className="flex items-end">
                    <p className="text-3xl font-bold">{completedOrders.length}</p>
                    <p className={`${darkMode ? 'text-green-200' : 'text-green-100'} ml-2 mb-1 text-xs`}>tasks</p>
                  </div>
                </div>
              </div>
              <div 
                className={`${darkMode ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-purple-400 to-purple-500'} rounded-2xl shadow-lg p-4 relative overflow-hidden text-white cursor-pointer`}
                onClick={() => handleTabChange('inventory')}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-purple-400 rounded-full opacity-20 -mt-10 -mr-10"></div>
                <div className="relative z-10">
                  <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                    <Package size={20} />
                  </div>
                  <p className={`${darkMode ? 'text-purple-100' : 'text-purple-50'} text-xs font-medium mb-1`}>Inventory Items</p>
                  <div className="flex items-end">
                    <p className="text-3xl font-bold">{calculateTotalUnits()}</p>
                    <p className={`${darkMode ? 'text-purple-200' : 'text-purple-100'} ml-2 mb-1 text-xs`}>units</p>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Task List (All Work Orders) */}
            <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
              <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'} flex justify-between items-center`}>
                <h2 className="font-bold text-lg">Your Tasks</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setShowReturnModal(true)}
                    className={`text-xs ${darkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-500 hover:bg-orange-600'} text-white px-3 py-1 rounded-full transition-colors flex items-center`}
                  >
                    <ArrowLeft size={14} className="mr-1" /> Return
                  </button>
                  <button 
                    onClick={() => setShowInventoryModal(true)}
                    className={`text-xs ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white px-3 py-1 rounded-full transition-colors`}
                  >
                    View Inventory
                  </button>
                </div>
              </div>
              <div>
              {activeWorkOrders.length > 0 ? (
  activeWorkOrders.map((order, index) => (
    <div
      key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`}
      className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
      onClick={() => handleWorkOrderClick(order)}
    >
      <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getCategoryColorClass(order.projectCategory || 'New Installation')} flex items-center justify-center`}>
  {order.projectCategory === 'Repair' ? (
    <Package size={18} className="text-white" />
  ) : (
    <Clipboard size={18} className="text-white" />
  )}
</div>
        <div className="flex-grow">
          <div className="flex justify-between">
            <h3 className={`font-medium truncate max-w-[150px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {order.projectType}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs capitalize ${
            order.status === 'assigned' ? `${darkMode ? 'bg-blue-600/40' : 'bg-blue-100'} ${darkMode ? 'text-blue-100' : 'text-blue-800'}` :
            order.status === 'in-progress' ? `${darkMode ? 'bg-purple-600/40' : 'bg-purple-100'} ${darkMode ? 'text-purple-100' : 'text-purple-800'}` :
            order.status === 'pending-approval' ? `${darkMode ? 'bg-amber-600' : 'bg-amber-100'} ${darkMode ? 'text-amber-100' : 'text-amber-600'}` :
            order.status === 'paused' ? `${darkMode ? 'bg-orange-600/40' : 'bg-orange-100'} ${darkMode ? 'text-orange-100' : 'text-orange-800'}` :
            order.status === 'transferring' ? `${darkMode ? 'bg-red-600/40' : 'bg-red-100'} ${darkMode ? 'text-red-100' : 'text-red-800'}` :
            `${darkMode ? 'bg-green-600/40' : 'bg-green-100'} ${darkMode ? 'text-green-100' : 'text-green-800'}`
          }`}>
            {order.status}
          </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Add Project Category Badge */}
            <div className={`inline-flex items-center ${
  order.projectCategory === 'Repair' 
    ? `${darkMode ? 'bg-purple-600/40 text-purple-100' : 'bg-purple-100 text-purple-800'}` 
    : `${darkMode ? 'bg-blue-600/40 text-blue-100' : 'bg-blue-100 text-blue-800'}`
} text-xs px-2 py-1 rounded-full`}>
  {order.projectCategory || 'New Installation'}
</div>
            
            {order.customerName && (
              <div className={`inline-flex items-center ${darkMode ? 'text-gray-400 bg-gray-700/50' : 'text-gray-600 bg-gray-200/70'} text-xs px-2 py-1 rounded-full`}>
                <User size={12} className="mr-1" />
                {order.customerName}
              </div>
            )}
            {order.location && (
              <div className={`inline-flex items-center ${darkMode ? 'text-gray-400 bg-gray-700/50' : 'text-gray-600 bg-gray-200/70'} text-xs px-2 py-1 rounded-full`}>
                <MapPin size={12} className="mr-1" />
                {order.location}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ))
) : (
  <div className="p-8 text-center">
    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No tasks assigned yet</p>
  </div>
)}
              </div>
            </div>
          </>
        )}

{/* Modify the inventory tab section in TechnicianDashboard.jsx */}

{activeTab === 'inventory' && (
  <div className="flex flex-col space-y-6">
    {/* Inventory Summary */}
    <div className={`${darkMode ? 'bg-gradient-to-br from-teal-600 to-teal-800' : 'bg-gradient-to-br from-teal-500 to-teal-600'} p-6 rounded-2xl shadow-xl text-white`}>
      <div className="flex items-center mb-4">
        <div className="w-16 h-16 bg-teal-700 rounded-full flex items-center justify-center shadow-xl mr-4">
          <Package size={32} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold mb-1">My Inventory</p>
          <p className={`${darkMode ? 'text-teal-200' : 'text-teal-100'}`}>Manage your stock</p>
        </div>
      </div>
      <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
        <div className="flex justify-between items-center mb-2">
          <span className={`${darkMode ? 'text-teal-200' : 'text-teal-100'}`}>Total Units:</span>
          <span className="text-white text-xl font-bold">{calculateTotalUnits()} items</span>
        </div>
        <div className="flex justify-center mt-4">
          <button 
            onClick={() => setShowReturnModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
          >
            <ArrowLeft size={16} className="mr-2" /> Return Items
          </button>
        </div>
      </div>
    </div>

    {/* Inventory List */}
    <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
      <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Inventory Items</h2>
        </div>
        
      {/* New tabs for Products and Services */}
      <div className="flex space-x-4 border-b border-gray-300 mb-4">
        <button
          className={`py-2 px-4 font-semibold rounded-t-lg ${
            activeInventoryTab === 'products' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveInventoryTab('products')}
        >
          Products
        </button>
        <button
          className={`py-2 px-4 font-semibold rounded-t-lg ${
            activeInventoryTab === 'services' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveInventoryTab('services')}
        >
          Services
        </button>
      </div>

      {/* Render inventory content based on activeInventoryTab */}
      {activeInventoryTab === 'products' ? (
        <>
          {/* Sorting buttons for products */}
          <div className="flex space-x-2 mb-4">
            <button
              className={`px-4 py-1.5 rounded-full text-sm ${
                productSortType === 'serialized' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setProductSortType('serialized')}
            >
              Serialized
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-sm ${
                productSortType === 'generic' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setProductSortType('generic')}
            >
              Generic
            </button>
          </div>

          {/* Products list */}
          <div
            ref={inventoryListRef}
            className="space-y-1 border border-gray-300 rounded-md p-2 max-h-[400px] overflow-auto"
          >
            {getSortedProductItems().map((item, index) => {
              const itemKey = item._id || item.id || item.itemId || `item-${item.itemName}-${index}`;
              const itemCount = getItemQuantity(item);
              const isSerialized = item.type === 'serialized-product';

              return (
                <div
                  key={itemKey}
                  className="p-2 border rounded-md cursor-pointer hover:bg-gray-100"
                  onClick={() => handleInventoryClick(item)}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{item.itemName}</div>
                    <div>{itemCount} {item.unit || 'Pcs'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Sorting buttons for services */}
          <div className="flex space-x-2 mb-4">
            <button
              className={`px-4 py-1.5 rounded-full text-sm ${
                serviceSortType.includes('name') ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => {
                setServiceSortType(prev => (prev === 'nameAsc' ? 'nameDesc' : 'nameAsc'));
              }}
            >
              Name {serviceSortType === 'nameAsc' ? 'A to Z' : 'Z to A'}
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-sm ${
                serviceSortType.includes('price') ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => {
                setServiceSortType(prev => (prev === 'priceLowHigh' ? 'priceHighLow' : 'priceLowHigh'));
              }}
            >
              Price {serviceSortType === 'priceLowHigh' ? 'Low to High' : 'High to Low'}
            </button>
          </div>

          {/* Services list */}
          <div className="space-y-1 border border-gray-300 rounded-md p-2 max-h-[400px] overflow-auto">
            {getSortedServiceItems().map((item, index) => {
              const itemKey = item._id || item.id || item.itemId || `service-${item.itemName}-${index}`;
              return (
                <div
                  key={itemKey}
                  className="p-2 border rounded-md cursor-pointer hover:bg-gray-100"
                  onClick={() => handleInventoryClick(item)}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{item.itemName}</div>
                    <div>₹{item.salePrice}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>
      
      <div className="space-y-1">
      {filteredInventoryItems.length > 0 ? (
  filteredInventoryItems.map((item, index) => {
    const itemKey = item._id || item.id || item.itemId || `item-${item.itemName}-${Date.now()}`;
    const itemCount = item.type === 'service' ? 'N/A' : getItemQuantity(item);
    const isExpanded = expandedItems.includes(itemKey);
    
    return (
      <div key={itemKey}>
        <div 
          className={`p-4 ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'} cursor-pointer transition-colors`}
          onClick={() => handleItemExpand(itemKey, item)}
        >
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full ${
              item.type === 'service' 
                ? (darkMode ? 'bg-teal-600' : 'bg-teal-500') 
                : (darkMode ? 'bg-teal-600' : 'bg-teal-500')
            } flex items-center justify-center mr-3 text-white font-bold`}>
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{item.itemName}</p>
                <div className="flex items-center">
                  {item.type === 'serialized-product' && (
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      width="18" 
                      height="18" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className={`mr-2 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                  {item.type === 'service' ? (
                    <div className={`px-3 py-1 rounded-full ${darkMode ? 'bg-purple-600/30 text-purple-200' : 'bg-teal-100 text-teal-800'}`}>
                      ₹{item.salePrice}
                    </div>
                  ) : (
                    <div className={`px-3 py-1 rounded-full ${darkMode ? 'bg-teal-600/30 text-teal-200' : 'bg-teal-100 text-teal-800'}`}>
                      {itemCount} {item.unit || 'Pcs'}
                    </div>
                  )}
                </div>
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
                {item.type === 'service' ? 'Service' : item.type.replace('-product', '')}
              </p>
            </div>
          </div>
        </div>
        
        {/* Expanded view for serialized items - keep this unchanged */}
        {item.type === 'serialized-product' && isExpanded && (
          <div className={`px-4 pb-4 ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <div className="ml-11 border-l-2 border-teal-500 pl-4 space-y-2">
              {item.serializedItems.filter(serial => serial.status === 'active').map((serial, idx) => (
                <div 
                  key={serial.serialNumber || idx} 
                  className={`p-2 rounded ${darkMode ? 'bg-gray-700/50' : 'bg-white'} text-sm`}
                >
                  <div className="flex justify-between">
                    <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Serial Number:
                    </span>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {serial.serialNumber}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  })
) : (
  <div className="p-8 text-center">
    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {inventoryFilter === 'All' 
        ? 'No inventory items assigned yet' 
        : `No ${inventoryFilter.toLowerCase()} items found`}
    </p>
  </div>
)}
      </div>
    </div>
  </div>
)}

{activeTab === 'current-project' && (
  <div className="flex flex-col space-y-4">
    {(() => {
      const activeProject = workOrders.find(order => order.status === 'in-progress');
      
      if (!activeProject) {
        return (
          <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-xl shadow-lg p-8 text-center`}>
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clipboard size={32} className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Active Project</h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
              You don't have any in-progress project at the moment.
            </p>
            <button
              onClick={() => handleTabChange('home')}
              className={`px-4 py-2 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-md`}
            >
              Go to Home
            </button>
          </div>
        );
      }
      
      // Get most recent status update for brief history
      const recentUpdate = activeProject.statusHistory && 
        activeProject.statusHistory.length > 0 ? 
        activeProject.statusHistory[activeProject.statusHistory.length - 1] : null;
        
      return (
        <>
          {/* Active Project Card - Blue Header Card */}
          <div className=" bg-blue-500 rounded-xl shadow-sm p-4 text-white">
            <div className="flex items-center mb-3">
              <div className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Active Projects</h2>
                <p className="text-sm opacity-80">Current assignment</p>
              </div>
            </div>
            
            {/* Project Card */}
            <div className="bg-blue-400 bg-opacity-30 rounded-lg p-4 mt-2">
              <h3 className="font-semibold">{activeProject.projectType}</h3>
              <p className="text-sm opacity-80 mt-1">Type: {activeProject.projectCategory || 'New Installation'}</p>
              <button
  onClick={() => handleGenerateBill(activeProject)}
  className="flex items-center justify-center mt-4 w-full bg-blue-600 text-white rounded-lg p-2"
>
  <FileText size={18} className="mr-2" />
  <span>Generate Bill</span>
</button>
            </div>
          </div>
          
          {/* Customer Card */}
          <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-xl shadow-lg p-4`}>
            <h3 className="text-lg font-semibold text-blue-800">{activeProject.customerName}</h3>
            {activeProject.customerAddress && (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{activeProject.customerAddress}</p>
            )}
            
            {/* Contact Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={() => handleMessageCustomer(activeProject)}
                className="bg-blue-500 text-white rounded-lg py-2 flex items-center justify-center"
              >
                <MessageSquare size={18} className="mr-2" /> Message
              </button>
              <button
                onClick={() => handleCallCustomer(activeProject)}
                className="bg-green-500 text-white rounded-lg py-2 flex items-center justify-center"
              >
                <Phone size={18} className="mr-2" /> Call
              </button>
            </div>
          </div>

          {/* Original Technician Card - Only show for Repair/Complaint projects */}
          {(activeProject.projectCategory === 'Repair' || 
  activeProject.projectType?.toLowerCase().includes('repair') || 
  activeProject.projectType?.toLowerCase().includes('complaint')) && (
  <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-xl shadow-lg p-4`}>
    <h3 className="text-lg font-semibold text-purple-800">Setup Technician</h3>
    {activeProject.originalTechnician ? (
      <>
        <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {activeProject.originalTechnician.firstName} {activeProject.originalTechnician.lastName}
        </p>
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Installation date: {activeProject.projectCreatedAt ? formatDate(activeProject.projectCreatedAt) : 'N/A'}
        </p>
        
        {/* Call Original Technician Button */}
        <div className="mt-3">
          <button
            onClick={() => handleCallOriginalTechnician(activeProject)}
            className="bg-purple-500 text-white rounded-lg py-2 w-full flex items-center justify-center"
          >
            <Phone size={18} className="mr-2" /> Call Original Technician
          </button>
        </div>
      </>
    ) : (
      // Loading state or placeholder when originalTechnician data is not yet available
      <div className="py-2">
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
          Original technician details loading...
        </p>
        <div className="mt-3">
          <button
            disabled
            className="bg-purple-300 text-white rounded-lg py-2 w-full flex items-center justify-center"
          >
            <Phone size={18} className="mr-2" /> Call Original Technician
          </button>
        </div>
      </div>
    )}
  </div>
)}
          
          {/* Report History Card */}
          <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-xl shadow-lg p-4`}>
            <h3 className="font-bold text-lg mb-3">Report History</h3>
            
            {/* Recent updates section */}
            {recentUpdate && (
              <div className="mb-3">
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Recent updates</p>
                <div className="mt-2 border-l-4 border-blue-500 pl-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{recentUpdate.updatedBy && recentUpdate.updatedBy.toString() === user._id.toString() ? 'Technician' : 'Manager'}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatDate(recentUpdate.updatedAt)}
                    </p>
                  </div>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {recentUpdate.remark || `Status changed to ${recentUpdate.status}`}
                  </p>
                </div>
              </div>
            )}
            
            {/* View Complete History Button */}
            <button
              onClick={() => setShowFullHistory(true)}
              className={`w-full py-2 ${darkMode ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-600'} rounded-lg flex items-center justify-center`}
            >
              <Eye size={18} className="mr-2" /> View Complete History
            </button>
          </div>
          
          <div className="flex gap-4 mt-6">
  {/* Pause Project Button */}
  <button
    onClick={() => setShowStopProjectModal(true)}
    className={`flex-1 py-3 ${darkMode ? 'bg-orange-900' : 'bg-orange-500'} text-white rounded-xl font-medium flex items-center justify-center`}
  >
    <FiPause size={18} className="mr-2" /> Pause Project
  </button>
  
  {/* Stop Project Button */}
  <button
    onClick={() => setShowTransferModal(true)}
    className={`flex-1 py-3 ${darkMode ? 'bg-red-900' : 'bg-red-500'} text-white rounded-xl font-medium flex items-center justify-center`}
  >
    <ArrowLeft size={18} className="mr-2" /> Stop Project
  </button>
</div>
          
          {/* Full History Modal */}
          {showFullHistory && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center px-4">
    <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Report History</h3>
        <button
          onClick={() => setShowFullHistory(false)}
          className="p-1"
        >
          <X size={20} />
        </button>
      </div>
     
      <div className="p-4 max-h-[70vh] overflow-y-auto">
        {/* Manager's initial instruction */}
        <div className="mb-3">
          <div className={`rounded-lg p-3 max-w-xs mb-2 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <div className="flex justify-between mb-1">
              <p className="font-medium text-sm">Manager</p>
              <p className="text-xs opacity-70">
                {formatDate(activeProject.assignedAt || activeProject.createdAt).split(',')[0]}
              </p>
            </div>
            <p className="text-sm">
              {activeProject.initialRemark || 'Assignment created for ' + activeProject.projectType}
            </p>
            <span className="text-xs opacity-70 flex justify-end">
              {formatDate(activeProject.assignedAt || activeProject.createdAt).split(',')[1]}
            </span>
          </div>
          
          {activeProject.instructions && (
          <div className={`rounded-lg p-3 max-w-xs ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <div className="flex justify-between mb-1">
              <p className="font-medium text-sm">Manager</p>
              <p className="text-xs opacity-70">
                {formatDate(activeProject.assignedAt || activeProject.createdAt).split(',')[0]}
              </p>
            </div>
            <p className="text-sm">
              {activeProject.instructions}
            </p>
            <span className="text-xs opacity-70 flex justify-end">
              {formatDate(activeProject.assignedAt || activeProject.createdAt).split(',')[1]}
            </span>
          </div>
          )}

        </div>
       
        {/* Status history as chat messages */}
        {activeProject.statusHistory && activeProject.statusHistory.map((history, index) => {
          const isTechnician = history.updatedBy && history.updatedBy.toString() === user._id.toString();
          return (
            <div
              key={index}
              className={`mb-3 ${isTechnician ? 'flex justify-end' : ''}`}
            >
              <div className={`rounded-lg p-3 max-w-xs ${
                isTechnician
                  ? `${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`
                  : `${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`
              }`}>
                <div className="flex justify-between mb-1">
                  <p className="font-medium text-sm">
                    {isTechnician ? 'Technician' : 'Manager'}
                  </p>
                  <p className="text-xs opacity-70">
                    {formatDate(history.updatedAt).split(',')[0]}
                  </p>
                </div>
                <p className="text-sm">
                  {history.remark || `Status changed to ${history.status}`}
                </p>
                <span className="text-xs opacity-70 flex justify-end">
                  {formatDate(history.updatedAt).split(',')[1]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 border-t">
        <button 
          onClick={() => setShowFullHistory(false)} 
          className={`w-full py-2 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-lg`}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
          
          {/* Stop Project Modal */}
          {showStopProjectModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
              <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl`}>
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold text-lg">Stop Work</h3>
                  <button 
                    onClick={() => setShowStopProjectModal(false)}
                    className="p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4">
                  <p className="block text-gray-700 mb-2 font-medium">Remarks</p>
                  <textarea
                    className={`w-full p-3 rounded-lg ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'} border mb-4`}
                    rows="4"
                    placeholder="Enter your remarks here..."
                    value={pauseProjectRemark}
                    onChange={(e) => setPauseProjectRemark(e.target.value)}
                  ></textarea>
                  
                  <div className="flex p-4 border-t">
                    <button
                      onClick={() => setShowStopProjectModal(false)}
                      className="flex-1 mr-2 py-2 border border-gray-300 rounded-lg text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleStopProject(activeProject)}
                      className="flex-1 ml-2 py-2 bg-red-500 text-white rounded-lg"
                      disabled={!pauseProjectRemark.trim()}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pause Confirmation Modal */}
{showPauseConfirmationModal && (
  <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
    <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Confirm Pause</h3>
        <button 
          onClick={() => setShowPauseConfirmationModal(false)}
          className="p-1"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-center mb-4">
          You are about to pause your project with the following reason:
        </p>
        <div className={`p-3 rounded-md mb-4 text-gray-700 ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100'}`}>
          "{pauseProjectRemark}"
        </div>
        <p className="text-center mb-6 font-medium">
          Are you sure you want to pause this project?
        </p>
        
        <div className="flex p-4 border-t">
          <button
            onClick={() => setShowPauseConfirmationModal(false)}
            className="flex-1 mr-2 py-2 border border-gray-300 rounded-lg text-gray-700"
          >
            No
          </button>
          <button
           onClick={() => confirmPauseProject(activeProject)}
            className="flex-1 ml-2 py-2 bg-red-500 text-white rounded-lg"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Transfer Project Modal */}
{showTransferModal && (
  <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
    <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">Stop Project</h3>
        <button 
          onClick={() => setShowTransferModal(false)}
          className="p-1"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-gray-600 mb-4">
          Stopping a project will transfer it back to the manager for reassignment.
          Please provide a detailed reason for stopping this project.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Stopping Project*
        </label>
        <textarea
          className={`w-full p-3 rounded-lg ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'} border mb-4`}
          rows="4"
          placeholder="Enter detailed reason for stopping this project..."
          value={transferRemark}
          onChange={(e) => setTransferRemark(e.target.value)}
        ></textarea>
        
        <div className="flex p-4 border-t">
          <button
            onClick={() => setShowTransferModal(false)}
            className="flex-1 mr-2 py-2 border border-gray-300 rounded-lg text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => handleTransferProject(activeProject)}
            className="flex-1 ml-2 py-2 bg-red-500 text-white rounded-lg"
            disabled={!transferRemark.trim()}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  </div>
)}
        </>
      );
    })()}
  </div>
)}
          
        {activeTab === 'all-projects' && (
          <div className="flex flex-col space-y-6">
            {/* Projects Summary */}
            <div className={`${darkMode ? 'bg-gradient-to-br from-amber-600 to-amber-800' : 'bg-gradient-to-br from-amber-500 to-amber-600'} p-6 rounded-2xl shadow-xl text-white`}>
              <div className="flex items-center mb-4">
                <div className="w-16 h-16 bg-amber-700 rounded-full flex items-center justify-center shadow-xl mr-4">
                  <List size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold mb-1">All Projects</p>
                  <p className={`${darkMode ? 'text-amber-200' : 'text-amber-100'}`}>Overview of your assignments</p>
                </div>
              </div>
              
              <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`${darkMode ? 'text-amber-200' : 'text-amber-100'}`}>Total Projects:</span>
                  <span className="text-white text-xl font-bold">{workOrders.length + completedOrders.length}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className={`${darkMode ? 'bg-amber-800/50' : 'bg-amber-700/50'} p-3 rounded-lg cursor-pointer`}
                  onClick={() => handleTabChange('assigned-projects')}>
                    <p className="text-2xl font-bold">{workOrders.filter(order => order.status === 'assigned').length}</p>
                    <p className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-100'}`}>Assigned</p>
                  </div>
                  <div className={`${darkMode ? 'bg-amber-800/50' : 'bg-amber-700/50'} p-3 rounded-lg cursor-pointer`}
                  onClick={() => handleTabChange('pending-approval-projects')}>
                    <p className="text-2xl font-bold">{workOrders.filter(order => order.status === 'pending-approval').length}</p>
                    <p className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-100'}`}>Approval</p>
                  </div>
                  <div className={`${darkMode ? 'bg-amber-800/50' : 'bg-amber-700/50'} p-3 rounded-lg cursor-pointer`}
                  onClick={() => handleTabChange('paused-projects')}>
                    <p className="text-2xl font-bold">{workOrders.filter(order => order.status === 'paused').length}</p>
                    <p className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-100'}`}>Paused</p>
                  </div>
                  <div className={`${darkMode ? 'bg-amber-800/50' : 'bg-amber-700/50'} p-3 rounded-lg cursor-pointer`}
                  onClick={() => handleTabChange('completed')}>
                    <p className="text-2xl font-bold">{completedOrders.length}</p>
                    <p className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-100'}`}>Completed</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Active Work Orders */}
            <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden mb-4`}>
              <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
                <h2 className="font-bold text-lg">Active Assignments</h2>
              </div>
              
              <div>
                {workOrders.length > 0 ? (
                  workOrders.map((order) => (
                    <div 
                      key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
                      className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
                      onClick={() => handleWorkOrderClick(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center max-w-[200px]">
                          <div className={`w-10 h-10 rounded-full ${getStatusColor(order.status)} flex items-center justify-center mr-3`}>
                            <Clipboard size={18} className="text-white" />
                          </div>
                          <div>
                            <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              {order.projectType}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Order ID: {order.orderId}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${
            order.status === 'assigned' ? `${darkMode ? 'bg-blue-600/40' : 'bg-blue-100'} ${darkMode ? 'text-blue-100' : 'text-blue-800'}` :
            order.status === 'in-progress' ? `${darkMode ? 'bg-purple-600/40' : 'bg-purple-100'} ${darkMode ? 'text-purple-100' : 'text-purple-800'}` :
            order.status === 'pending-approval' ? `${darkMode ? 'bg-amber-600' : 'bg-amber-100'} ${darkMode ? 'text-amber-100' : 'text-amber-600'}` :
            order.status === 'paused' ? `${darkMode ? 'bg-orange-600/40' : 'bg-orange-100'} ${darkMode ? 'text-orange-100' : 'text-orange-800'}` :
            order.status === 'transferring' ? `${darkMode ? 'bg-red-600/40' : 'bg-red-100'} ${darkMode ? 'text-red-100' : 'text-red-800'}` :
            `${darkMode ? 'bg-green-600/40' : 'bg-green-100'} ${darkMode ? 'text-green-100' : 'text-green-800'}`
          }`}>
            {order.status}
          </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No active assignments</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          
        {activeTab === 'completed' && (
          <div className="flex flex-col space-y-6">
            {/* Completed Summary */}
            <div className={`${darkMode ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-green-500 to-green-600'} p-6 rounded-2xl shadow-xl text-white`}>
              <div className="flex items-center mb-4">
                <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center shadow-xl mr-4">
                  <CheckSquare size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold mb-1">Completed Projects</p>
                  <p className={`${darkMode ? 'text-green-200' : 'text-green-100'}`}>Your finished assignments</p>
                </div>
              </div>
              
              <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`${darkMode ? 'text-green-200' : 'text-green-100'}`}>Total completed:</span>
                  <span className="text-white text-xl font-bold">{completedOrders.length} projects</span>
                </div>
                
                {completedOrders.length > 0 && (
                  <button 
                    onClick={() => handleWorkOrderClick(completedOrders[0])}
                    className="bg-green-700 hover:bg-green-800 text-white w-full py-2 rounded-lg flex items-center justify-center mt-2"
                  >
                    <Eye size={16} className="mr-2" /> View Latest Completed
                  </button>
                )}
              </div>
            </div>
            
            {/* Completed Work Orders */}
            <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
              <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
                <h2 className="font-bold text-lg">Completed Assignments</h2>
              </div>
              
              <div>
                {completedOrders.length > 0 ? (
                  completedOrders.map((order) => (
                    <div 
                      key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
                      className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
                      onClick={() => handleWorkOrderClick(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full ${getStatusColor(order.status)} flex items-center justify-center mr-3`}>
                            <CheckSquare size={18} className="text-white" />
                          </div>
                          <div>
                            <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                              {order.projectType}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Order ID: {order.orderId}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${darkMode ? 'bg-green-600/40 text-green-100' : 'bg-green-100 text-green-800'}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No completed assignments yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

{activeTab === 'pending-approval-projects' && (
  <div className="flex flex-col space-y-6">
    {/* Pending Approval Summary */}
    <div className={`${darkMode ? 'bg-gradient-to-br from-amber-600 to-amber-800' : 'bg-gradient-to-br from-amber-500 to-amber-600'} p-6 rounded-2xl shadow-xl text-white`}>
      <div className="flex items-center mb-4">
        <div className="w-16 h-16 bg-amber-700 rounded-full flex items-center justify-center shadow-xl mr-4">
          <Activity size={32} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold mb-1">Pending Approvals</p>
          <p className={`${darkMode ? 'text-amber-200' : 'text-amber-100'}`}>Projects awaiting approval</p>
        </div>
      </div>
      
      <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
        <div className="flex justify-between items-center mb-4">
          <span className={`${darkMode ? 'text-amber-200' : 'text-amber-100'}`}>Total Pending:</span>
          <span className="text-white text-xl font-bold">{workOrders.filter(order => order.status === 'pending-approval').length} projects</span>
        </div>
        
        <button 
          onClick={() => handleTabChange('home')}
          className="bg-amber-700 hover:bg-amber-800 text-white w-full py-2 rounded-lg flex items-center justify-center mt-2"
        >
          <Home size={16} className="mr-2" /> Back to Home
        </button>
      </div>
    </div>
    
    {/* Pending Approval Projects List */}
    <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
      <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h2 className="font-bold text-lg">Pending Approval Projects</h2>
      </div>
      
      <div>
        {workOrders.filter(order => order.status === 'pending-approval').length > 0 ? (
          workOrders.filter(order => order.status === 'pending-approval').map((order) => (
            <div 
              key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
              className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
              onClick={() => handleWorkOrderClick(order)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center max-w-[200px]">
                  <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-amber-600' : 'bg-amber-500'} flex items-center justify-center mr-3`}>
                    <Activity size={18} className="text-white" />
                  </div>
                  <div>
                    <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {order.projectType}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Order ID: {order.orderId}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs capitalize ${darkMode ? 'bg-amber-600/40 text-amber-100' : 'bg-amber-100 text-amber-800'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No pending approval projects</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{activeTab === 'paused-projects' && (
  <div className="flex flex-col space-y-6">
    {/* Paused Projects Summary */}
    <div className={`${darkMode ? 'bg-gradient-to-br from-orange-600 to-orange-800' : 'bg-gradient-to-br from-orange-500 to-orange-600'} p-6 rounded-2xl shadow-xl text-white`}>
      <div className="flex items-center mb-4">
        <div className="w-16 h-16 bg-orange-700 rounded-full flex items-center justify-center shadow-xl mr-4">
          <Clock size={32} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold mb-1">Paused Projects</p>
          <p className={`${darkMode ? 'text-orange-200' : 'text-orange-100'}`}>Temporarily stopped assignments</p>
        </div>
      </div>
      
      <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
        <div className="flex justify-between items-center mb-4">
          <span className={`${darkMode ? 'text-orange-200' : 'text-orange-100'}`}>Total Paused:</span>
          <span className="text-white text-xl font-bold">{workOrders.filter(order => order.status === 'paused').length} projects</span>
        </div>
        
        <button 
          onClick={() => handleTabChange('home')}
          className="bg-orange-700 hover:bg-orange-800 text-white w-full py-2 rounded-lg flex items-center justify-center mt-2"
        >
          <Home size={16} className="mr-2" /> Back to Home
        </button>
      </div>
    </div>
    
    {/* Paused Projects List */}
    <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
      <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h2 className="font-bold text-lg">Paused Projects</h2>
      </div>
      
      <div>
        {workOrders.filter(order => order.status === 'paused').length > 0 ? (
          workOrders.filter(order => order.status === 'paused').map((order) => (
            <div 
              key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
              className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
              onClick={() => handleWorkOrderClick(order)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center max-w-[200px]">
                  <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-orange-600' : 'bg-orange-500'} flex items-center justify-center mr-3`}>
                    <Clock size={18} className="text-white" />
                  </div>
                  <div>
                    <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {order.projectType}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Order ID: {order.orderId}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs capitalize ${darkMode ? 'bg-orange-600/40 text-orange-100' : 'bg-orange-100 text-orange-800'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No paused projects</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{activeTab === 'assigned-projects' && (
  <div className="flex flex-col space-y-6">
    {/* Assigned Projects Summary */}
    <div className={`${darkMode ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 'bg-gradient-to-br from-blue-500 to-blue-600'} p-6 rounded-2xl shadow-xl text-white`}>
      <div className="flex items-center mb-4">
        <div className="w-16 h-16 bg-blue-700 rounded-full flex items-center justify-center shadow-xl mr-4">
          <Clipboard size={32} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold mb-1">Assigned Projects</p>
          <p className={`${darkMode ? 'text-blue-200' : 'text-blue-100'}`}>New assignments ready to start</p>
        </div>
      </div>
      
      <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
        <div className="flex justify-between items-center mb-4">
          <span className={`${darkMode ? 'text-blue-200' : 'text-blue-100'}`}>Total Assigned:</span>
          <span className="text-white text-xl font-bold">{workOrders.filter(order => order.status === 'assigned').length} projects</span>
        </div>
        
        <button 
          onClick={() => handleTabChange('home')}
          className="bg-blue-700 hover:bg-blue-800 text-white w-full py-2 rounded-lg flex items-center justify-center mt-2"
        >
          <Home size={16} className="mr-2" /> Back to Home
        </button>
      </div>
    </div>
    
    {/* Assigned Projects List */}
    <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
      <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h2 className="font-bold text-lg">Assigned Projects</h2>
      </div>
      
      <div>
        {workOrders.filter(order => order.status === 'assigned').length > 0 ? (
          workOrders.filter(order => order.status === 'assigned').map((order) => (
            <div 
              key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
              className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
              onClick={() => handleWorkOrderClick(order)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center max-w-[200px]">
                  <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} flex items-center justify-center mr-3`}>
                    <Clipboard size={18} className="text-white" />
                  </div>
                  <div>
                    <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {order.projectType}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Order ID: {order.orderId}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs capitalize ${darkMode ? 'bg-blue-600/40 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No assigned projects</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{activeTab === 'transferred-projects' && (
  <div className="flex flex-col space-y-6">
    {/* Transferred Projects Summary */}
    <div className={`${darkMode ? 'bg-gradient-to-br from-red-600 to-red-800' : 'bg-gradient-to-br from-red-500 to-red-600'} p-6 rounded-2xl shadow-xl text-white`}>
      <div className="flex items-center mb-4">
        <div className="w-16 h-16 bg-red-700 rounded-full flex items-center justify-center shadow-xl mr-4">
          <ArrowLeft size={32} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold mb-1">Transferred Projects</p>
          <p className={`${darkMode ? 'text-red-200' : 'text-red-100'}`}>Projects transferred to others</p>
        </div>
      </div>
      
      <div className={`${darkMode ? 'bg-white/10' : 'bg-white/20'} rounded-xl p-4 backdrop-blur-sm`}>
        <div className="flex justify-between items-center mb-4">
          <span className={`${darkMode ? 'text-red-200' : 'text-red-100'}`}>Total Transferred:</span>
          <span className="text-white text-xl font-bold">{transferredProjects.length} projects</span>
        </div>
      </div>
    </div>
    
    {/* Transferred Projects List */}
    <div className={`${darkMode ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' : 'bg-white/80 backdrop-blur-sm border border-gray-200'} rounded-2xl shadow-xl overflow-hidden`}>
      <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h2 className="font-bold text-lg">Transferred Projects</h2>
      </div>
      
      <div>
        {transferredProjects.length > 0 ? (
          transferredProjects.map((order) => (
            <div 
              key={order.orderId || `order-${Math.random().toString(36).substr(2, 9)}`} 
              className={`p-4 ${darkMode ? 'border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50' : 'border-b border-gray-200 last:border-b-0 hover:bg-gray-100/50'} transition-colors cursor-pointer`}
              onClick={() => handleWorkOrderClick(order)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center max-w-[200px]">
                  <div className={`w-10 h-10 rounded-full bg-red-500 flex items-center justify-center mr-3`}>
                    <ArrowLeft size={18} className="text-white" />
                  </div>
                  <div>
                    <p className={`font-medium truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {order.projectType}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Order ID: {order.orderId}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs capitalize bg-red-100 text-red-800`}>
                  {order.status === 'transferred' ? 'Transferred' : 'Transfer Pending'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No transferred projects</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
      </main>
      
      {/* Bottom Navigation */}
      <footer className={`${darkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} p-1`}>
        <div className="grid grid-cols-5 gap-1 px-2 pt-1">
          <button 
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl flex-1 mx-1  h-14 ${
              activeTab === 'home' 
                ? `${darkMode ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-blue-500 to-blue-600'} text-white shadow-lg` 
                : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`
            }`}
          >
             <div className="h-5 flex items-center">
         <Home size={20} />
      </div>
      <div className="h-5 flex items-center">
         <span className="text-xs mt-1">Home</span>
      </div>
          </button>
          <button 
            onClick={() => handleTabChange('inventory')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl flex-1 mx-1 ${
              activeTab === 'inventory' 
                ? `${darkMode ? 'bg-gradient-to-r from-teal-600 to-teal-700' : 'bg-gradient-to-r from-teal-500 to-teal-600'} text-white shadow-lg` 
                : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`
            }`}
          >
             <div className="h-5 flex items-center">
         <LuCctv size={24} />
      </div>
      <div className="h-5 flex items-center">
         <span className="text-xs mt-1">{calculateTotalUnits()}</span>
      </div>
          </button>
          <button 
            onClick={() => handleTabChange('all-projects')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl flex-1 mx-1 ${
              activeTab === 'all-projects' 
                ? `${darkMode ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-amber-500 to-amber-600'} text-white shadow-lg` 
                : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`
            }`}
          >
            <div className="h-5 flex items-center">
            <List size={20} />
            </div>
            <div className="h-5 flex items-center">
            <span className="text-xs mt-1">All</span>
            </div>
          </button>

          <button 
            onClick={() => handleTabChange('pending-approval-projects')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl flex-1 mx-1 ${
              activeTab === 'pending-approval-projects' 
                ? `${darkMode ?  'bg-gradient-to-br from-amber-600 to-amber-800' : 'bg-gradient-to-br from-amber-500 to-amber-600'} text-white shadow-lg` 
                : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`
            }`}
          >
            <div className="h-5 flex items-center">
            <CheckSquare size={20} />
            </div>
            <div className="h-5 flex items-center">
            <span className="text-xs mt-1">Approval</span>
            </div>
          </button>

          <button 
            onClick={() => handleTabChange('current-project')}
            className={`flex flex-col items-center py-2 px-4 rounded-xl flex-1 mx-1 ${
              activeTab === 'current-project' 
                ? `${darkMode ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-blue-500 to-blue-600'} text-white shadow-lg` 
                : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`
            }`}
          >
            <div className="h-5 flex items-center">
            <Clipboard size={20} />
            </div>
            <div className="h-5 flex items-center">
            <span className="text-xs mt-1">Current</span>
            </div>
          </button>
         
        </div>
      </footer>
      
      {/* Add bottom padding to prevent content from being hidden behind fixed footer */}
      {/* <div className="pb-16"></div> */}

      {/* Logout Confirmation Popup */}
{showLogoutPopup && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className={`${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} rounded-xl shadow-2xl p-6 max-w-sm w-full mx-auto`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>Confirm Logout</h3>
        <button 
          onClick={() => setShowLogoutPopup(false)}
          className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        >
          <X size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
        </button>
      </div>
      <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        Are you sure you want to logout from your account?
      </p>
      <div className="flex justify-end space-x-3">
        <button 
          onClick={() => setShowLogoutPopup(false)}
          className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
        >
          Cancel
        </button>
        <button 
          onClick={handleLogout}
          className={`px-4 py-2 rounded-lg flex items-center ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
        >
          <LogOut size={16} className="mr-2" />
          Logout
        </button>
      </div>
    </div>
  </div>
)}
      
      {/* Modals */}
      {showInventoryModal && (
        <InventoryDetailsModal 
          isOpen={showInventoryModal}
          onClose={() => {
            setShowInventoryModal(false);
            setSelectedInventory(null);
          }}
          inventory={inventoryItems}
          selectedItem={selectedInventory}
        />
      )}
      
      {showWorkOrderModal && (
        <WorkOrderDetailsModal 
          isOpen={showWorkOrderModal}
          onClose={() => {
            setShowWorkOrderModal(false);
            if (selectedWorkOrder && selectedWorkOrder.billingInfo && selectedWorkOrder.billingInfo.length > 0) {
              fetchWorkOrders();
            }
            setSelectedWorkOrder(null);
          }}
          workOrder={selectedWorkOrder}
          onStatusUpdate={handleWorkOrderStatusUpdate}
          onProjectStarted={handleProjectStarted}
          darkMode={darkMode}
        />
      )}

      {showReturnModal && (
        <ReturnInventoryModal 
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          onInventoryReturned={handleInventoryReturned}
        />
      )}

{showBillModal && (
  <GenerateBillModal
    isOpen={showBillModal}
    onClose={() => setShowBillModal(false)}
    workOrder={selectedWorkOrder}
    onBillGenerated={handleBillGenerated}
  />
)}

<UserSettingsModal 
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
/>
    </div>
  );
};

export default TechnicianDashboard;