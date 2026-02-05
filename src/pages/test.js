import React, { useState } from 'react';
import { Check, Shield, ChevronRight, Star, Globe } from 'lucide-react';

const ModernBusinessLandingPage = () => {
  // Add language state
  const [language, setLanguage] = useState('hinglish'); // Default is hinglish

  // Content translations
  const content = {
    hinglish: {
      // Hero section
      heroText: "Modern solution for business owners who want better control, security, and efficiency",
      problemTitle: "Kya Aap Apne Business Mein In Problems Se Pareshan Hain?",
      problems: [
        "Staff ko manage karna mushkil ho raha hai?",
        "Samaan ki chori ka dar hai?",
        "Staff ke kaaran customers cheat ho rahe hain aur ilzaam aap par lag raha hai?",
        "Har baar stock checking mein samaan kam milta hai?",
        "Warranty replacement apni jeb se karni padti hai?",
        "Computer kharab hone par data loss ka dar lagta hai?"
      ],
      dashboardDesc: "Hamara software aapko apne business ko secure aur efficient banane mein madad karega. Real-time monitoring, security features, aur easy management.",
      ctaText: "Agar aapke paas sirf 2 problems hain, to yeh solution aapka business badal dega",
      
      // Features section
      solutionTitle: "MeraSoftware Business Management Kit mein milega:",
      solutionDesc: "Hamara comprehensive solution aapke business ko secure aur efficient banayega",
      featureCard1Title: "Powerful Cloud Software",
      featureCard1Desc: "Kabhi bhi, kahin se bhi apne business ko monitor karen aur manage karen",
      featureCard2Title: "Lifetime Support",
      featureCard2Desc: "Kabhi bhi technical help chahiye? Hum hamesha available hain",
      featureCard3Title: "One-time Fees",
      featureCard3Desc: "No monthly charges, No yearly maintenance fees",
      
      // Benefits section
      benefitsTitle: "Aur Bhi Benefits:",
      benefits: [
        "Full Ownership after one-time purchase",
        "1 Week ki training aur full implementation support",
        "Regular updates for better security and features"
      ],
      demoButton: "Free Demo Scheduler",
      
      // Stats section
      impactTitle: "📈 Ab Tak Itne Logon Ne Hamare System Ka Fayda Uthaya Hai:",
      
      // CTA section
      decisionTitle: "🎯 Ab Decision Aapka Hai!",
      decisionDesc: "Apne business ki security aur growth ke liye aaj hi demo book karein",
      placeholderText: "Mobile Number",
      bookDemoButton: "Book Demo",
      freeText: "100% free consultation. No hidden charges."
    },
    english: {
      // Hero section
      heroText: "Modern solution for business owners who want better control, security, and efficiency",
      problemTitle: "Are You Facing These Problems in Your Business?",
      problems: [
        "Difficulty in managing staff?",
        "Fear of inventory theft?",
        "Customers being cheated by staff and you getting blamed?",
        "Finding less inventory during stock checking?",
        "Paying for warranty replacements from your pocket?",
        "Fear of data loss when computer malfunctions?"
      ],
      dashboardDesc: "Our software will help you make your business secure and efficient. Real-time monitoring, security features, and easy management.",
      ctaText: "If you have even 2 of these problems, this solution will transform your business",
      
      // Features section
      solutionTitle: "MeraSoftware Business Management Kit includes:",
      solutionDesc: "Our comprehensive solution will make your business secure and efficient",
      featureCard1Title: "Powerful Cloud Software",
      featureCard1Desc: "Monitor and manage your business anytime, from anywhere",
      featureCard2Title: "Lifetime Support",
      featureCard2Desc: "Need technical help anytime? We are always available",
      featureCard3Title: "One-time Fees",
      featureCard3Desc: "No monthly charges, No yearly maintenance fees",
      
      // Benefits section
      benefitsTitle: "Additional Benefits:",
      benefits: [
        "Full Ownership after one-time purchase",
        "1 Week of training and full implementation support",
        "Regular updates for better security and features"
      ],
      demoButton: "Free Demo Scheduler",
      
      // Stats section
      impactTitle: "📈 So Many People Have Benefited From Our System:",
      
      // CTA section
      decisionTitle: "🎯 Now It's Your Decision!",
      decisionDesc: "Book a demo today for the security and growth of your business",
      placeholderText: "Mobile Number",
      bookDemoButton: "Book Demo",
      freeText: "100% free consultation. No hidden charges."
    }
  };

  // Toggle language function
  const toggleLanguage = () => {
    setLanguage(language === 'hinglish' ? 'english' : 'hinglish');
  };

  // Get current language content
  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navigation - Updated with red, black, light blue color scheme */}
      <nav className="bg-black py-4 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="font-bold text-xl text-red-600">MeraSoftware</div>
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-300 hover:text-red-500 transition-colors">Features</a>
            <a href="#testimonials" className="text-gray-300 hover:text-red-500 transition-colors">Testimonials</a>
            <a href="#stats" className="text-gray-300 hover:text-red-500 transition-colors">Results</a>
            <a href="#contact" className="text-gray-300 hover:text-red-500 transition-colors">Contact</a>
          </div>
          <div className="flex items-center space-x-4">
            {/* Language toggle button */}
            <button 
              onClick={toggleLanguage} 
              className="flex items-center bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 transition duration-300 text-sm font-medium"
            >
              <Globe size={16} className="mr-2" />
              {language === 'hinglish' ? 'English' : 'हिंग्लिश'}
            </button>
            <button className="bg-red-600 text-white px-5 py-2 rounded-full hover:bg-red-700 transition duration-300 text-sm font-medium">
              Book Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Updated with red, black, light blue color scheme */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-gray-50 to-white text-gray-800">
        <div className="container mx-auto px-4 md:px-8">
          {/* Main Heading - Updated Style */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center mr-2">
                <Shield size={20} className="text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-600">MeraSoftware</h2>
            </div>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              {currentContent.heroText}
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:space-x-8 mt-10">
            {/* Left Side with Questions - Updated Card Style */}
            <div className="w-full md:w-1/2 mb-8 md:mb-0">
              <div className="bg-white p-8 rounded-2xl shadow-sm h-full border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{currentContent.problemTitle}</h2>
                <ul className="space-y-5">
                  {currentContent.problems.map((problem, index) => (
                    <li key={index} className="flex items-start">
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-red-100 flex items-center justify-center mr-3 mt-1">
                        <Check size={16} className="text-red-600" />
                      </div>
                      <span className="text-gray-800 text-lg font-medium">{problem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Right Side with Image - Updated Style */}
            <div className="w-full md:w-1/2">
              <div className="bg-white p-8 rounded-2xl shadow-sm h-full border border-gray-100">
                <div className="relative aspect-video mb-6 overflow-hidden rounded-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-blue-400 flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="w-16 h-16 bg-black/20 backdrop-blur-sm rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Shield size={24} className="text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white">MeraSoftware Dashboard</h3>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">{currentContent.dashboardDesc}</p>
                <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-sm text-gray-500">
                  <span className="font-medium text-red-600">Latest Version: 2.1</span>
                  <span>Updated: April 2025</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Call to Action - English version with color combination */}
          <div className="mt-12 text-center">
            {language === 'hinglish' ? (
              <h2 className="text-3xl font-bold">
                Agar aapke paas <span className="text-red-600">inmein se 2 problems bhi</span> hain, to yeh <span className="text-red-600">solution</span> aapka <span className="text-red-600">business badal dega</span>
              </h2>
            ) : (
              <h2 className="text-3xl font-bold">
                If you have <span className="text-red-600">just 2 of these problems</span>, this <span className="text-red-600">solution</span> will <span className="text-red-600">transform your business</span>
              </h2>
            )}
          </div>
        </div>
      </section>

      {/* Product Info Section - Updated Card Style */}
      <section className="py-20 bg-white" id="features">
        <div className="container mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <span className="px-4 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium mb-4 inline-block">Our Solution</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              <span className="text-red-600">{currentContent.solutionTitle}</span>
            </h2>
            <p className="text-gray-700 max-w-2xl mx-auto">
              {currentContent.solutionDesc}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature Card 1 - Updated Style */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition duration-300 hover:shadow-md">
              <div className="h-2 bg-red-600"></div>
              <div className="p-8">
                <div className="w-12 h-12 bg-blue-100 text-red-600 rounded-lg flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-4.5-8.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 8.5V4a1 1 0 00-1-1H9a1 1 0 00-1 1v4.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{currentContent.featureCard1Title}</h3>
                <p className="text-gray-700 mb-6">
                  {currentContent.featureCard1Desc}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Real-time monitoring</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Mobile access</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Automatic backups</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Feature Card 2 - Updated Style */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition duration-300 hover:shadow-md">
              <div className="h-2 bg-red-600"></div>
              <div className="p-8">
                <div className="w-12 h-12 bg-blue-100 text-red-600 rounded-lg flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{currentContent.featureCard2Title}</h3>
                <p className="text-gray-700 mb-6">
                  {currentContent.featureCard2Desc}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>24/7 technical support</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Regular updates</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Training materials</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Feature Card 3 - Updated Style */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition duration-300 hover:shadow-md">
              <div className="h-2 bg-red-600"></div>
              <div className="p-8">
                <div className="w-12 h-12 bg-blue-100 text-red-600 rounded-lg flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{currentContent.featureCard3Title}</h3>
                <p className="text-gray-700 mb-6">
                  {currentContent.featureCard3Desc}
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Full ownership</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>No hidden costs</span>
                  </li>
                  <li className="flex items-center">
                    <Check size={16} className="text-red-600 mr-2" />
                    <span>Lifetime access</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Additional Benefits - Updated Style */}
          <div className="mt-16 bg-blue-50 p-8 rounded-2xl border border-blue-100 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">{currentContent.benefitsTitle}</h3>
                <ul className="space-y-4">
                  {currentContent.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center">
                      <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center mr-3">
                        <Check size={14} className="text-red-600" />
                      </div>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <button className="bg-red-600 text-white text-lg px-8 py-3 rounded-full hover:bg-red-700 transition duration-300 flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-1">
                  <span>{currentContent.demoButton}</span>
                  <ChevronRight size={20} className="ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the component remains unchanged */}
      {/* Statistics Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-gray-50 to-white" id="stats">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <span className="px-4 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium mb-4 inline-block">Our Impact</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            {currentContent.impactTitle}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-red-600 mb-2">500+</div>
              <div className="text-gray-700">Businesses Transformed</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-red-600 mb-2">95%</div>
              <div className="text-gray-700">Inventory Loss Reduction</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-red-600 mb-2">40%</div>
              <div className="text-gray-700">Average Sales Growth</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-red-600 mb-2">24/7</div>
              <div className="text-gray-700">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white" id="testimonials">
        <div className="container mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <span className="px-4 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium mb-4 inline-block">Testimonials</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              💬 Real Customers, Real Results
            </h2>
            <p className="text-gray-700 max-w-2xl mx-auto">
              Here's what our customers are saying about their experience with MeraSoftware
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition duration-300 hover:shadow-md">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={16} className="text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Is software ke baad mere business mein chori 95% kam ho gayi hai! Staff ka management bhi aasan ho gaya hai."
              </p>
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <span className="text-red-600 font-bold">RS</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Rajesh Sharma</div>
                  <div className="text-gray-500 text-sm">Delhi Electronics</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition duration-300 hover:shadow-md">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={16} className="text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Staff management aasan ho gaya aur bikri 40% badh gayi! Cloud system hone ke karan kabhi bhi business check kar sakti hoon."
              </p>
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <span className="text-red-600 font-bold">AP</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Anita Patel</div>
                  <div className="text-gray-500 text-sm">Mumbai Retail</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition duration-300 hover:shadow-md">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={16} className="text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Data loss ka dar khatam ho gaya hai aur inventory tracking automated ho gayi hai. Best investment mere business ke liye!"
              </p>
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <span className="text-red-600 font-bold">VK</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Vijay Kumar</div>
                  <div className="text-gray-500 text-sm">Pune Hardware</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call To Action */}
      <section className="py-20 bg-black" id="contact">
        <div className="container mx-auto px-4 md:px-8">
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="md:w-2/3 text-left mb-6 md:mb-0">
                <span className="px-4 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium mb-4 inline-block">Ready?</span>
                <h2 className="text-2xl font-bold mb-2 text-gray-900">
                  {currentContent.decisionTitle}
                </h2>
                <p className="text-gray-700">
                  {currentContent.decisionDesc}
                </p>
              </div>
              <div className="md:w-1/3">
                <div className="flex flex-col space-y-3">
                  <input 
                    type="text" 
                    placeholder={currentContent.placeholderText} 
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition duration-300">
                    {currentContent.bookDemoButton}
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    {currentContent.freeText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-gray-800 text-white">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">MeraSoftware</h3>
              <p className="text-gray-300 mb-6">
                Business solution that protects your business and helps it grow.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-blue-300 hover:text-blue-400 transition-colors">Facebook</a>
                <a href="#" className="text-blue-300 hover:text-blue-400 transition-colors">Twitter</a>
                <a href="#" className="text-blue-300 hover:text-blue-400 transition-colors">LinkedIn</a>
                <a href="#" className="text-blue-300 hover:text-blue-400 transition-colors">YouTube</a>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Contact Us</h3>
              <p className="text-gray-300">
                Email: contact@merasoftware.com<br />
                Phone: +91 98765 43210<br />
                Address: Tech Hub, Sector 62, Noida, UP
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 text-center text-gray-400 text-sm border-t border-gray-800">
            <p>© {new Date().getFullYear()} MeraSoftware. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModernBusinessLandingPage;