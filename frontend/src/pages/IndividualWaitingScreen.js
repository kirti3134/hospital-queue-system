import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';
import { counterService } from '../services/counterService';
import '../styles/IndividualWaitingScreen.css';

const IndividualWaitingScreenRenamed = () => {
  const { counterId } = useParams();
  const socket = useSocket();
  const { settings } = useSettings();
  const [counterData, setCounterData] = useState(null);
  const [currentActiveTicket, setCurrentActiveTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);

  // Auto-refresh interval reference
  const autoRefreshIntervalRef = useRef(null);

  // Get theme settings with proper fallbacks
  const themeConfig = settings?.themes || {};
  const mainColor = themeConfig.primaryColor || '#1e3a8a';
  const secondaryColor = themeConfig.accentColor || '#dc2626';
  const textFontFamily = themeConfig.fontFamily || 'Inter, sans-serif';

  // Get hospital info
  const hospitalTitle = settings?.hospitalName || 'CITY HOSPITAL DELHI';
  const hospitalLogoImage = settings?.hospitalLogo || '';
  const hospitalLocation = settings?.hospitalCity || 'ISLAMABAD';

  useEffect(() => {
    console.log('🎯 IndividualWaitingScreenRenamed mounted for counter:', counterId);
    
    // Apply theme settings
    document.body.style.fontFamily = textFontFamily;
    document.body.style.overflow = 'hidden';

    fetchCounterInformation();
    initializeSocketListeners();
    startAutoRefresh();

    return () => {
      if (socket) {
        socket.off('counter-updated');
        socket.off('token-called');
        socket.off('token-completed');
        socket.off('token-recalled');
        socket.off('settings-updated');
      }
      stopAutoRefresh();
    };
  }, [counterId, socket, textFontFamily]);

  // ✅ ADDED: Auto-refresh functionality
  const startAutoRefresh = () => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    // ✅ AUTO-REFRESH: Update every 3 seconds for real-time updates
    autoRefreshIntervalRef.current = setInterval(() => {
      performSilentRefresh();
    }, 3000); // 3 seconds
  };

  const stopAutoRefresh = () => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
  };

  const performSilentRefresh = async () => {
    try {
      const counterResponse = await counterService.getCounterDetails(counterId);
      
      // Only update if data has actually changed
      if (JSON.stringify(counterData) !== JSON.stringify(counterResponse.counter) ||
          JSON.stringify(currentActiveTicket) !== JSON.stringify(counterResponse.counter?.currentTicket)) {
        
        setCounterData(counterResponse.counter);
        setCurrentActiveTicket(counterResponse.counter?.currentTicket || null);
        console.log('🔄 Auto-refresh: Counter data updated');
      }
    } catch (error) {
      console.log('Auto-refresh failed:', error.message);
    }
  };

  const fetchCounterInformation = async () => {
    try {
      setIsLoading(true);
      setErrorState(null);
      console.log('🔄 Loading counter data for:', counterId);
      
      let counterResponse;
      try {
        counterResponse = await counterService.getCounterDetails(counterId);
        console.log('✅ Counter data loaded from API:', counterResponse);
      } catch (apiError) {
        console.warn('⚠️ API failed, using mock data:', apiError);
        // Create comprehensive mock data
        counterResponse = {
          counter: {
            _id: counterId,
            counterNumber: parseInt(counterId) || 1,
            name: `Counter ${parseInt(counterId) || 1}`,
            department: { 
              _id: '1', 
              name: 'General OPD',
              code: 'GENERAL'
            },
            status: 'active',
            currentTicket: {
              _id: 'mock_ticket_1',
              ticketNumber: 'A101',
              patientName: 'John Doe',
              calledAt: new Date(),
              priority: 'normal',
              department: { name: 'General OPD' }
            },
            lastActivity: new Date()
          },
          queue: [],
          waitingCount: 0
        };
      }

      setCounterData(counterResponse.counter);
      setCurrentActiveTicket(counterResponse.counter?.currentTicket || null);
      
    } catch (error) {
      console.error('❌ Error loading counter data:', error);
      setErrorState(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ VOICE ANNOUNCEMENT HANDLER
  const processVoiceAnnouncement = async (announcementData) => {
    const { ticketNumber, counterNumber, isRecall, type, audioUrl } = announcementData;
    
    console.log(`🔊 INDIVIDUAL WAITING ANNOUNCEMENT: ${ticketNumber} for Counter ${counterNumber}`);
    
    try {
      if (type === 'mp3_announcement' && audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = 0.8;
        await audio.play();
      } else {
        const message = `${isRecall ? 'دوبارہ' : ''} ٹکٹ نمبر ${ticketNumber} کاؤنٹر ${counterNumber} پر تشریف لائیں`;
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = 'ur-PK';
          speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('❌ Individual waiting announcement failed:', error);
    }
  };

  const initializeSocketListeners = () => {
    if (!socket) {
      console.warn('⚠️ Socket not available for real-time updates');
      return;
    }

    console.log('🔌 Setting up socket listeners for counter:', counterId);
    
    socket.emit('join-counter', counterId);

    // ✅ VOICE ANNOUNCEMENTS
    socket.on('urdu-voice-announcement', async (data) => {
      console.log('🔊 IndividualWaitingScreen received voice announcement:', data);
      await processVoiceAnnouncement(data);
    });

    socket.on('counter-updated', (updatedCounter) => {
      console.log('🔄 Counter updated:', updatedCounter);
      if (updatedCounter._id === counterId) {
        setCounterData(updatedCounter);
        setCurrentActiveTicket(updatedCounter.currentTicket || null);
      }
    });

    socket.on('token-called', (data) => {
      console.log('📢 Token called:', data);
      if (data.counter._id === counterId) {
        setCounterData(data.counter);
        setCurrentActiveTicket(data.ticket);
      }
    });

    socket.on('token-completed', (data) => {
      console.log('✅ Token completed:', data);
      if (data.counter._id === counterId) {
        setCounterData(data.counter);
        setCurrentActiveTicket(null);
      }
    });

    socket.on('token-recalled', (data) => {
      console.log('🔁 Token recalled:', data);
      if (data.counter._id === counterId) {
        setCounterData(data.counter);
        setCurrentActiveTicket(data.ticket);
      }
    });

    // ✅ ADDED: Auto-refresh on voice call events
    socket.on('voice-call-initiated', (data) => {
      if (data.counterId === counterId) {
        setTimeout(() => {
          fetchCounterInformation();
        }, 1000);
      }
    });

    socket.on('call-request-completed', (data) => {
      if (data.counterId === counterId) {
        setTimeout(() => {
          fetchCounterInformation();
        }, 500);
      }
    });

    socket.on('connect', () => {
      console.log('🔗 Socket connected');
      socket.emit('join-counter', counterId);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  };

  if (isLoading) {
    return (
      <div className="theme-container dark-blue-theme">
        <div className="loading-spinner-container">
          <div className="spinner-3d-animation"></div>
          <div className="loading-text-content">Loading Counter Display...</div>
        </div>
      </div>
    );
  }

  if (errorState || !counterData) {
    return (
      <div className="theme-container dark-blue-theme">
        <div className="error-message-container">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Counter Not Available</h2>
          <div className="error-details-container">
            <p><strong>Counter ID:</strong> {counterId}</p>
            <p><strong>Error:</strong> {errorState || 'Counter not found'}</p>
          </div>
          <div className="error-actions-container">
            <button onClick={fetchCounterInformation} className="action-button primary-button">
              <i className="fas fa-redo"></i> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-container dark-blue-theme individual-waiting-panel">
      {/* Background Elements */}
      <div className="background-logo-container">
        {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="background-logo-blur" />}
      </div>
      
      <div className="border-lines-container">
        <div className="border-line horizontal-line top-line"></div>
        <div className="border-line horizontal-line bottom-line"></div>
        <div className="border-line vertical-line left-line"></div>
        <div className="border-line vertical-line right-line"></div>
      </div>
      
      <div className="corner-elements">
        <div className="corner-element top-left-corner blue-corner"></div>
        <div className="corner-element top-right-corner red-corner"></div>
        <div className="corner-element bottom-left-corner red-corner"></div>
        <div className="corner-element bottom-right-corner blue-corner"></div>
      </div>

      {/* Main Content */}
      <div className="main-content-wrapper individual-waiting-content">
        {/* Header Section with Logo */}
        <div className="panel-header-theme individual-waiting-header">
          <div className="hospital-branding-theme">
            {hospitalLogoImage && (
              <img src={hospitalLogoImage} alt="Hospital Logo" className="hospital-logo-img" />
            )}
            <div className="hospital-details-theme">
              <h1 className="hospital-title-theme">
                {hospitalTitle}
              </h1>
              <p className="hospital-location-theme">{hospitalLocation}</p>
              {/* <p className="arabic-text-theme">الخدمت رازی ہسپتال اسلام آباد</p> */}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="individual-main-panel">
          {/* Left Side - Counter Display with Exact Image Shape */}
          <div className="counter-display-panel">
            <div className="counter-shape-design">
              <div className="shape-design-top"></div>
              <div className="shape-design-middle"></div>
              <div className="shape-design-bottom"></div>
            </div>
            <div className="counter-label-text">Counter</div>
            <div className="counter-number-display-large">
              {counterData.counterNumber}
            </div>
          </div>

          {/* Right Side - Current Serving Token Number Only */}
          <div className="current-token-panel">
            <div className="serving-header-section">
              <h3 className="section-title-text">SERVED TOKEN</h3>
            </div>
            
            {currentActiveTicket ? (
              <div className="current-token-display-container">
                <div className="token-number-display-large">
                  {currentActiveTicket.ticketNumber}
                </div>
              </div>
            ) : (
              <div className="no-token-display-container">
                <i className="fas fa-user-clock"></i>
                <div className="no-token-message">No Active Token</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndividualWaitingScreenRenamed;