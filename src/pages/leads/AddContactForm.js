import React, { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Country codes array
const countryCodes = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+971', country: 'UAE' },
  { code: '+86', country: 'China' },
  { code: '+49', country: 'Germany' },
];

// Project types for customers
const projectTypes = [
  'CCTV Camera',
  'Attendance System',
  'Safe and Locks',
  'Home/Office Automation',
  'IT & Networking Services',
  'Software & Website Development',
  'Custom'
];

const AddContactForm = ({ initialPhone = '', initialType = 'lead', onSuccess, onCancel }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [contactType, setContactType] = useState(initialType); // 'lead' or 'customer'
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneWithoutCode, setPhoneWithoutCode] = useState('');
  const [whatsappWithoutCode, setWhatsappWithoutCode] = useState('');
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Common form fields
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '+91',
    email: '',
    whatsappNumber: '+91',
    address: '',
    age: '',
  });
  
  // Lead-specific fields
  const [remarkText, setRemarkText] = useState('');
  const [remarkStatus, setRemarkStatus] = useState('neutral');
  
  // Customer-specific fields
  const [projectType, setProjectType] = useState('');
  const [customerRemark, setCustomerRemark] = useState('');
  
  // Handle branches for admin users
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // For admin users, fetch branches
  useEffect(() => {
    if (user.role === 'admin') {
      const fetchBranches = async () => {
        try {
          const response = await fetch(SummaryApi.getBranches.url, {
            method: SummaryApi.getBranches.method,
            credentials: 'include'
          });
          
          const data = await response.json();
          
          if (data.success) {
            setBranches(data.data);
            // If admin has a selected branch in context, use that
            if (user.selectedBranch) {
              setSelectedBranch(user.selectedBranch);
            }
          }
        } catch (err) {
          console.error('Error fetching branches:', err);
        }
      };
      
      fetchBranches();
    }
  }, [user]);
  
  // Handle initialPhone when the component mounts
  useEffect(() => {
    if (initialPhone) {
      // Check if initial phone has a country code
      if (initialPhone.startsWith('+')) {
        // Find the country code
        const matchedCode = countryCodes.find(cc => initialPhone.startsWith(cc.code));
        if (matchedCode) {
          setCountryCode(matchedCode.code);
          setPhoneWithoutCode(initialPhone.substring(matchedCode.code.length));
        } else {
          setPhoneWithoutCode(initialPhone);
        }
      } else {
        setPhoneWithoutCode(initialPhone);
      }
      
      // If initialPhone is a valid 10-digit number, check if it exists
      if (/^\d{10}$/.test(initialPhone)) {
        checkPhoneNumber(countryCode + initialPhone);
      }
    }
  }, [initialPhone]);
  
  // Update phone and whatsapp with country code
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      phoneNumber: countryCode + phoneWithoutCode,
      whatsappNumber: countryCode + whatsappWithoutCode
    }));
  }, [countryCode, phoneWithoutCode, whatsappWithoutCode]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle phone and whatsapp inputs separately
    if (name === 'phoneNumber' || name === 'whatsappNumber') {
      return; // These are handled by the country code inputs
    }
    
    setFormData({
      ...formData,
      [name]: value,
    });
  };
  
  // Check if phone number exists
  const checkPhoneNumber = async (phone) => {
    if (phone.length < 8) return; // Don't search for very short numbers
    
    try {
      const response = await fetch(`${SummaryApi.search.url}?query=${phone}`, {
        method: SummaryApi.search.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        const allResults = [...data.data.leads, ...data.data.customers];
        setSearchResults(allResults);
        setShowSearchResults(allResults.length > 0);
      }
    } catch (err) {
      console.error('Error searching:', err);
    }
  };
  
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhoneWithoutCode(value);
    
    // Check for existing leads/customers if number is long enough
    if (value.length >= 8) {
      checkPhoneNumber(countryCode + value);
    } else {
      setShowSearchResults(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validate phone number
    if (phoneWithoutCode.length < 8) {
      setError("Phone number must be at least 8 digits");
      return;
    }
    
    // Validate required fields based on contact type
    if (contactType === 'customer' && !projectType) {
      setError("Please select a project type");
      return;
    }
    
    // Prepare form data
    const dataToSubmit = {
      ...formData
    };
    
    // Add branch if admin and branch is selected
    if (user.role === 'admin' && selectedBranch) {
      dataToSubmit.branch = selectedBranch;
    }
    
    try {
      setLoading(true);
      
      if (contactType === 'lead') {
        // Add initial remark if provided
        if (remarkText) {
          dataToSubmit.initialRemark = {
            text: remarkText,
            status: remarkStatus
          };
          // Also set the initial status of the lead
    dataToSubmit.status = remarkStatus;
        }
        
        // Create lead
        const response = await fetch(SummaryApi.createLead.url, {
          method: SummaryApi.createLead.method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSubmit)
        });
        
        const data = await response.json();
        
        if (data.success) {
          setSuccess(true);
          // Notify parent component of success
          setTimeout(() => {
            if (onSuccess) onSuccess(data.data);
          }, 1500);
        } else {
          if (data.isCustomer) {
            setError("This phone number belongs to an existing customer");
          } else {
            setError(data.message || 'Failed to add lead');
          }
        }
      } else {
        // Customer-specific data
        dataToSubmit.projectType = projectType;
        dataToSubmit.initialRemark = customerRemark;
        
        // Create customer
        const response = await fetch(SummaryApi.createCustomer.url, {
          method: SummaryApi.createCustomer.method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSubmit)
        });
        
        const data = await response.json();
        
        if (data.success) {
          setSuccess(true);
          // Notify parent component of success
          // setTimeout(() => {
          //   if (onSuccess) onSuccess(data.data);
          // }, 1500);

          navigate('/work-orders');
        } else {
          setError(data.message || 'Failed to add customer');
        }
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error adding contact:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {contactType === 'lead' ? 'Lead' : 'Customer'} added successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Contact Type Selection */}
        <div className="mb-6 border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</label>
          <div className="flex gap-4">
            <button
              type="button"
              className={`px-4 py-2 rounded-md ${
                contactType === 'lead' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setContactType('lead')}
            >
              Lead
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-md ${
                contactType === 'customer' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setContactType('customer')}
            >
              Customer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name*</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
            <div className="flex">
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center justify-between w-20 p-2 border border-r-0 rounded-l bg-gray-50"
                  onClick={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
                >
                  <span>{countryCode}</span>
                  <span>▼</span>
                </button>
                
                {showCountryCodeDropdown && (
                  <div className="absolute z-10 mt-1 bg-white border rounded-md shadow-lg w-48">
                    {countryCodes.map(country => (
                      <div 
                        key={country.code} 
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setCountryCode(country.code);
                          setShowCountryCodeDropdown(false);
                        }}
                      >
                        <span className="font-medium">{country.code}</span> - {country.country}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <input 
                type="text"
                value={phoneWithoutCode}
                onChange={handlePhoneChange}
                placeholder="Enter phone number"
                className="w-full p-2 border rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {/* Existing records alert */}
            {showSearchResults && (
              <div className="mt-2 p-2 border rounded bg-yellow-50 text-sm">
                <p className="font-medium text-yellow-800">Existing records found:</p>
                <div className="mt-1 max-h-32 overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="flex justify-between items-center p-1 border-b">
                      <div>
                        <span className="font-medium">{result.name}</span> - {result.phoneNumber}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                        result.type === 'lead' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {result.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
            <div className="flex">
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center justify-between w-20 p-2 border border-r-0 rounded-l bg-gray-50"
                >
                  <span>{countryCode}</span>
                  <span>▼</span>
                </button>
              </div>
              
              <input 
                type="text"
                value={whatsappWithoutCode}
                onChange={(e) => setWhatsappWithoutCode(e.target.value)}
                placeholder="Enter WhatsApp number"
                className="w-full p-2 border rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center mt-1">
              <input 
                type="checkbox" 
                id="sameAsPhone" 
                className="mr-2"
                onChange={(e) => {
                  if(e.target.checked) {
                    setWhatsappWithoutCode(phoneWithoutCode);
                  }
                }}
              />
              <label htmlFor="sameAsPhone" className="text-xs text-gray-500">Same as phone number</label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <input 
              type="number"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>
          
          {user.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Branch</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea 
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
            ></textarea>
          </div>
        </div>
        
        {/* Customer-specific fields */}
        {contactType === 'customer' && (
          <div className="md:col-span-2 border-t mt-4 pt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type*</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Project Type</option>
                {projectTypes.map((type, index) => (
                  <option key={index} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Remark</label>
              <textarea
                value={customerRemark}
                onChange={(e) => setCustomerRemark(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Enter initial customer remarks or notes..."
              ></textarea>
            </div>
          </div>
        )}
        
        {/* Lead-specific fields */}
        {contactType === 'lead' && (
          <div className="md:col-span-2 border-t mt-4 pt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Remark</label>
              <textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Enter initial query or remarks..."
              ></textarea>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status:</label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-sm ${
                    remarkStatus === 'positive' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                  onClick={() => setRemarkStatus('positive')}
                >
                  Positive
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-sm ${
                    remarkStatus === 'neutral' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                  onClick={() => setRemarkStatus('neutral')}
                >
                  Neutral
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-sm ${
                    remarkStatus === 'negative' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                  onClick={() => setRemarkStatus('negative')}
                >
                  Negative
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 flex items-center hover:bg-gray-50"
          >
            <FiX className="mr-2" />
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600 disabled:opacity-50"
          >
            <FiSave className="mr-2" />
            {loading ? 'Saving...' : `Save ${contactType === 'lead' ? 'Lead' : 'Customer'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddContactForm;