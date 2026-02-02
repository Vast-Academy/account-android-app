// src/components/GlobalSearch.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiUserPlus } from 'react-icons/fi';
import SummaryApi from '../common';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ leads: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  
  useEffect(() => {
    // Add click outside listener to close dropdown
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults({ leads: [], customers: [] });
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(delayDebounce);
  }, [query]);
  
  const performSearch = async () => {
    if (!query.trim()) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`${SummaryApi.search.url}?query=${encodeURIComponent(query)}`, {
        method: SummaryApi.search.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
        setShowResults(true);
      }
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = (item) => {
    setShowResults(false);
    setQuery('');
    
    if (item.type === 'lead') {
      navigate(`/leads/${item.id}`);
    } else {
      navigate(`/customers/${item.id}`);
    }
  };
  
  const handleAddNew = () => {
    // Check if query might be a phone number
    const isNumeric = /^\d+$/.test(query);
    
    if (isNumeric && query.length >= 8) {
      // Navigate to add lead with the phone number
      navigate(`/leads/add?phone=${query}`);
    } else {
      // Navigate to add lead with the name
      navigate(`/leads/add?name=${encodeURIComponent(query)}`);
    }
    
    setShowResults(false);
    setQuery('');
  };
  
  const totalResults = results.leads.length + results.customers.length;
  
  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <input
          type="text"
          placeholder="Search leads & customers..."
          className="w-64 pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) {
              setShowResults(true);
            }
          }}
        />
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        
        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
      
      {showResults && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-80 bg-white rounded-md shadow-lg overflow-hidden border">
          <div className="max-h-96 overflow-y-auto">
            {totalResults > 0 ? (
              <>
                {results.leads.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                      Leads ({results.leads.length})
                    </div>
                    {results.leads.map(lead => (
                      <div 
                        key={lead.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b flex items-center"
                        onClick={() => handleSelect(lead)}
                      >
                        <FiUser className="mr-3 text-blue-500" />
                        <div>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.phoneNumber}</div>
                        </div>
                        <span className={`ml-auto text-xs px-2 py-1 rounded-full capitalize ${
                          lead.status === 'positive' ? 'bg-green-100 text-green-800' :
                          lead.status === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {results.customers.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                      Customers ({results.customers.length})
                    </div>
                    {results.customers.map(customer => (
                      <div 
                        key={customer.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b flex items-center"
                        onClick={() => handleSelect(customer)}
                      >
                        <FiUserPlus className="mr-3 text-green-500" />
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-gray-500">{customer.phoneNumber}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                <p className="text-gray-500 mb-3">No results found for "{query}"</p>
                <button
                  onClick={handleAddNew}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm"
                >
                  Add as new lead
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;