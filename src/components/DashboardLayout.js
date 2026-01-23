import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiHome, FiUsers, FiSettings, 
  FiPackage, FiClipboard, FiMenu, 
  FiBell, FiLogOut, FiChevronDown,
  FiBriefcase, FiFileText, FiTool, FiRefreshCw,
  FiActivity,
  FiArrowLeft,
  FiRepeat, FiShield 
} from 'react-icons/fi';
import { Replace, Layers, Users, Building, X, User } from 'lucide-react';
import ManagerStatusChecker from './ManagerStatusChecker';
import UserSettingsModal from '../pages/users/UserSettingsModal';
// import GlobalSearch from './GlobalSearch';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usersDropdownOpen, setUsersDropdownOpen] = useState(false);
  const [branchesDropdownOpen, setBranchesDropdownOpen] = useState(false);
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false);
  const [leadsDropdownOpen, setLeadsDropdownOpen] = useState(false);
  const [showTransferOption, setShowTransferOption] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  
  useEffect(() => {
    // Check if user is a manager and has activeManagerStatus='active'
    if (user && user.role === 'manager' && user.activeManagerStatus === 'active') {
      setShowTransferOption(true);
    } else {
      setShowTransferOption(false);
    }
  }, [user]);

  useEffect(() => {
    // If the user is technician, immediately redirect to technician dashboard
    if (user && user.role === 'technician') {
      navigate('/technician-dashboard');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    setShowLogoutPopup(false); // Close popup first
    logout(); // Call the logout function from AuthContext
  };

  // Toggle profile popup
  const toggleLogoutPopup = () => {
    setShowLogoutPopup(!showLogoutPopup);
  };
  
  // Function to toggle dropdowns and close others
  const toggleDropdown = (dropdownName) => {
    // Check if the clicked dropdown is already open
    let isCurrentlyOpen = false;
    
    switch(dropdownName) {
      case 'users':
        isCurrentlyOpen = usersDropdownOpen;
        break;
      case 'branches':
        isCurrentlyOpen = branchesDropdownOpen;
        break;
      case 'inventory':
        isCurrentlyOpen = inventoryDropdownOpen;
        break;
      case 'leads':
        isCurrentlyOpen = leadsDropdownOpen;
        break;
      default:
        break;
    }
    
    // Close all dropdowns first
    setUsersDropdownOpen(false);
    setBranchesDropdownOpen(false);
    setInventoryDropdownOpen(false);
    setLeadsDropdownOpen(false);
    
    // If the clicked dropdown wasn't already open, then open it
    // If it was open, leave it closed
    if (!isCurrentlyOpen) {
      switch(dropdownName) {
        case 'users':
          setUsersDropdownOpen(true);
          break;
        case 'branches':
          setBranchesDropdownOpen(true);
          break;
        case 'inventory':
          setInventoryDropdownOpen(true);
          break;
        case 'leads':
          setLeadsDropdownOpen(true);
          break;
        default:
          break;
      }
    }
  };
  
  // Add this useEffect in your component
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

  // Define navigation items by role
  const getNavItemsByRole = () => {
    // Default items that show for everyone - empty for now
    let navItems = [];
    
    if (user) {
      // Common item for Admin and Manager
      if (user.role === 'admin' || user.role === 'manager') {
        navItems.push({ name: 'Dashboard', path: '/dashboard', icon: FiHome });
      }
      
      // Admin specific items
      if (user.role === 'admin') {
        navItems = [
          ...navItems,
          {
            name: 'Branches',
            icon: Building,
            path: '/branches'
          },
          {
            name: 'Managers',
            icon: Users,
            path: '/users/managers'
          },
          {
            name: 'Technicians',
            icon: Layers,
            path: '/users/technicians'
          },
          {
            name: 'Inventory',
            icon: FiPackage,
            path: '/inventory-items'
          },
        ];
      }
      
      // Manager specific items
      if (user.role === 'manager') {
        navItems = [
          ...navItems,
          // Only show ownership transfer for active managers
          // showTransferOption && {
          //   name: 'Ownership Transfer',
          //   path: '/ownership-transfer',
          //   icon: FiRefreshCw
          // },
          {
            name: 'User Management',
            path: '/users/technicians',
            icon: FiUsers
          },
          {
            name: 'Customers',
            path: '/contacts',
            icon: FiUsers
          },
          { name: 'Work Orders', path: '/work-orders', icon: FiTool },
          { name: 'Projects', path: '/manager-dashboard', icon: FiActivity },
          { name: 'Transferring Requests', path: '/transferred-projects', icon: FiArrowLeft },
          {
            name: 'Inventory',
            path: '/inventory',
            icon: FiPackage
          },
          { name: 'Returned Inventory', path: '/returned-inventory', icon: FiRepeat },
          { name: 'Replacement Warranty', path: '/replacement-warranty', icon: FiShield  },
          { name: 'Logs', path: '/inventory-transfer-history', icon: FiRefreshCw },
        ];
      }
      
      // Technician specific items
      if (user.role === 'technician') {
        navItems = [
          { name: 'Technician Dashboard', path: '/technician-dashboard', icon: FiTool }
        ];
      }
    }
    
    // Filter out undefined items (from conditional rendering)
    return navItems.filter(item => item);
  };
  
  const filteredNavItems = getNavItemsByRole();
  
  return (
    <div className={`${user?.role === 'technician' ? '' : 'flex'} h-screen bg-gray-100`}>
      <ManagerStatusChecker/>

      {user?.role !== 'technician' && (
      <>
        {/* Sidebar overlay for mobile */}
        <div 
          className={`md:hidden fixed inset-0 z-20 bg-gray-900 bg-opacity-50 transition-opacity duration-200 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        ></div>
      
      {/* Sidebar */}
      <div 
        className={`fixed z-30 inset-y-0 left-0 w-64 bg-gray-800 text-white shadow-lg transition-transform duration-200 ease-in-out transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:inset-0`}
      >
        <div className="flex p-4 h-16 border-b">
          <h1 className="text-2xl font-bold text-white">CMS Panel</h1>
        </div>
        
        <nav className="mt-5">
          <ul>
            {filteredNavItems.map((item, index) => (
              <li key={index}>
                {item.dropdown ? (
                  <div>
                    <button
                      onClick={item.toggle}
                      className={`w-full flex items-center justify-between px-4 py-3 text-white hover:bg-indigo-50 hover:text-indigo-700`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                      </div>
                      <FiChevronDown className={`w-4 h-4 transition-transform duration-200 ${item.isOpen ? 'transform rotate-180' : ''}`} />
                    </button>
                    
                    <div className={`bg-gray-50 transition-all duration-200 overflow-hidden ${item.isOpen ? 'max-h-60' : 'max-h-0'}`}>
                      {item.items.map((subItem, subIndex) => (
                        <Link
                          key={subIndex}
                          to={subItem.path}
                          className={`flex pl-12 py-2 text-sm text-white hover:bg-indigo-50 hover:text-indigo-700 ${
                            location.pathname === subItem.path ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-700' : ''
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 text-white hover:bg-gray-700 ${
                      location.pathname === item.path ? 'bg-blue-600 border-indigo-700' : ''
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.name}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
      </>
    )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
       {/* Conditionally show header for non-technicians */}
      {user?.role !== 'technician' ? (
        <header className="flex items-center justify-between h-16 px-4 bg-white shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-gray-600 focus:outline-none md:hidden"
          >
            <FiMenu className="w-6 h-6" />
          </button>

          <div className="relative flex items-center">
  <button 
    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
    className="flex items-center focus:outline-none"
    aria-haspopup="true"
    aria-expanded={profileDropdownOpen}
  >
    <div className="cursor-pointer">
    <User size={26}/>
    </div>
  </button>
  
  {/* Profile Dropdown */}
  {profileDropdownOpen && (
    <div 
      className="absolute left-0 right-0 top-8 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200"
    >
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-sm font-medium capitalize">{user?.firstName} {user?.lastName}</p>
        <p className="text-xs text-gray-500 capitalize">{user?.role || 'User'}</p>
      </div>
      
      <button 
        onClick={() => {
          setShowSettingsModal(true);
          setProfileDropdownOpen(false);
        }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
      >
        <FiSettings className="mr-2 h-4 w-4" />
        Settings
      </button>
      
      <button 
        onClick={() => {
          toggleLogoutPopup();
          setProfileDropdownOpen(false);
        }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
      >
        <FiLogOut className="mr-2 h-4 w-4" />
        Logout
      </button>
    </div>
  )}
        </div>
          
          <div className="flex-1 px-2 flex items-center">
          <p className="text-xl font-semibold text-gray-800 capitalize">{user?.firstName} {user?.lastName} ({user?.role || 'User'}) </p>
          </div>
          
          <div className="flex items-center">
            {/* <button className="p-1 mr-4 text-gray-500 hover:text-gray-600 relative">
              <FiBell className="w-6 h-6" />
              <span className="absolute top-0 right-0 bg-red-500 rounded-full w-4 h-4 text-white text-xs flex items-center justify-center">
                0
              </span>
            </button> */}
            
      

     {/* Logout Confirmation Popup */}
{showLogoutPopup && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className={` bg-white border border-gray-200 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-auto`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-bold text-lg text-gray-800`}>Confirm Logout</h3>
        <button 
          onClick={() => setShowLogoutPopup(false)}
          className={`p-1 rounded-full hover:bg-gray-100`}
        >
          <X size={20} className={'text-gray-500'} />
        </button>
      </div>
      <p className={`mb-6 text-gray-600`}>
        Are you sure you want to logout from your account?
      </p>
      <div className="flex justify-end space-x-3">
        <button 
          onClick={() => setShowLogoutPopup(false)}
          className={`px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800`}
        >
          Cancel
        </button>
        <button 
          onClick={handleLogout}
          className={`px-4 py-2 rounded-lg flex items-center bg-red-600 hover:bg-red-700 text-white`}
        >
          <FiLogOut size={16} className="mr-2" />
          Logout
        </button>
      </div>
    </div>
  </div>
)}

          </div>
        </header>
         ) : null}
        
        {/* Page content */}
      <main className={`flex-1 overflow-auto ${user?.role !== 'technician' ? 'p-4' : 'p-0'}`}>
        <Outlet /> {/* This is where page components will be rendered */}
      </main>
    </div>
    
    {/* Settings Modal */}
<UserSettingsModal 
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
/>
  </div>
);
};

export default DashboardLayout;