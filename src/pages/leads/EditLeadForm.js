import React, { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

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

const EditLeadForm = ({ leadId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingLead, setFetchingLead] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneWithoutCode, setPhoneWithoutCode] = useState('');
  const [whatsappWithoutCode, setWhatsappWithoutCode] = useState('');
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    whatsappNumber: '',
    address: '',
    age: '',
    status: 'neutral'
  });
  
  // Handle branches for admin users
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Fetch lead data
  useEffect(() => {
    const fetchLead = async () => {
      try {
        setFetchingLead(true);
        setError(null);
        
        const response = await fetch(`${SummaryApi.getLead.url}/${leadId}`, {
          method: SummaryApi.getLead.method,
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
          const lead = data.data;
          
          // Extract country code from phone number
          let extractedCountryCode = '+91'; // Default
          for (const cc of countryCodes) {
            if (lead.phoneNumber.startsWith(cc.code)) {
              extractedCountryCode = cc.code;
              break;
            }
          }
          
          setCountryCode(extractedCountryCode);
          setPhoneWithoutCode(lead.phoneNumber.substring(extractedCountryCode.length));
          
          if (lead.whatsappNumber) {
            setWhatsappWithoutCode(lead.whatsappNumber.substring(extractedCountryCode.length));
          }
          
          setFormData({
            name: lead.name || '',
            phoneNumber: lead.phoneNumber || '',
            email: lead.email || '',
            whatsappNumber: lead.whatsappNumber || '',
            address: lead.address || '',
            age: lead.age || '',
            status: lead.status || 'neutral'
          });
          
          // Set branch if exists
          if (lead.branch && lead.branch._id) {
            setSelectedBranch(lead.branch._id);
          }
        } else {
          setError(data.message || 'Failed to fetch lead details');
        }
      } catch (err) {
        setError('Server error. Please try again later.');
        console.error('Error fetching lead:', err);
      } finally {
        setFetchingLead(false);
      }
    };
    
    fetchLead();
  }, [leadId]);
  
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
          }
        } catch (err) {
          console.error('Error fetching branches:', err);
        }
      };
      
      fetchBranches();
    }
  }, [user]);
  
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
  
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhoneWithoutCode(value);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validate phone number
    if (phoneWithoutCode.length < 8) {
      setError("Phone number must be at least 8 digits");
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
      
      const response = await fetch(`${SummaryApi.updateLead.url}/${leadId}`, {
        method: SummaryApi.updateLead.method,
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
        setError(data.message || 'Failed to update lead');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error updating lead:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (fetchingLead) {
    return (
      <div className="p-4 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Lead updated successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="neutral">Neutral</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
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
             />
          </div>
        </div>
        
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
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditLeadForm;