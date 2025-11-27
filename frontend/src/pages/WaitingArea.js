import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';
import { authService } from '../services/authService';
import { departmentService } from '../services/departmentService';
import { counterService } from '../services/counterService';
import { ticketService } from '../services/ticketService';
import '../styles/WaitingArea.css';

const WaitingArea = () => {
  const { displayId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { settings } = useSettings();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [calledTickets, setCalledTickets] = useState([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);
  const [adIndex, setAdIndex] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [queueData, setQueueData] = useState({});
  const [counters, setCounters] = useState([]);
  const [activeCounters, setActiveCounters] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  // Get theme settings with proper fallbacks
  const themeConfig = settings?.themes || {};
  const mainColor = themeConfig.primaryColor || '#1e3a8a';
  const secondaryColor = themeConfig.accentColor || '#dc2626';
  const textFontFamily = themeConfig.fontFamily || 'Inter, sans-serif';

  // Get hospital info
  const hospitalTitle = settings?.hospitalName || 'CITY HOSPITAL DELHI';
  const hospitalLogoImage = settings?.hospitalLogo || '';
  const hospitalLocation = settings?.hospitalCity || 'ISLAMABAD';

  // Get waiting screen settings with proper fallbacks
  const waitingSettings = settings?.waitingScreen || {};
  const showAds = waitingSettings.showAds !== false;
  const soundNotifications = waitingSettings.soundNotifications !== false;
  const customMessage = waitingSettings.customMessage || '';
  const language = waitingSettings.language || 'en';

  // Get advertisements from settings
  const advertisements = settings?.advertisements || [];

  useEffect(() => {
    const validateAccess = () => {
      if (!authService.isAuthenticated()) {
        const adminToken = localStorage.getItem('adminAccessToken');
        const adminUser = localStorage.getItem('adminUser');
        
        if (adminToken && adminUser) {
          localStorage.setItem('accessToken', adminToken);
          localStorage.setItem('user', adminUser);
          localStorage.setItem('component', 'waiting');
          localStorage.setItem('loginTime', new Date().toISOString());
          
          localStorage.removeItem('adminAccessToken');
          localStorage.removeItem('adminUser');
          localStorage.removeItem('adminComponent');
        } else {
          navigate('/login/waiting');
          return;
        }
      }

      const accessValidation = authService.validateComponentAccess('waiting');
      if (!accessValidation.valid) {
        navigate(accessValidation.redirect);
        return;
      }
    };

    validateAccess();
    loadInitialData();
    setupSocketListeners();
    
    // Apply theme settings
    document.body.style.fontFamily = textFontFamily;

    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const announcementInterval = setInterval(() => {
      setAnnouncementIndex(prev => (prev + 1) % getAnnouncements().length);
    }, 10000);
    
    const adInterval = showAds ? setInterval(() => {
      setAdIndex(prev => (prev + 1) % getAdvertisements().length);
    }, 30000) : null;

    // ✅ AUTO-REFRESH: Update data every 3 seconds for real-time updates
    const refreshInterval = setInterval(() => {
      loadCounters();
      loadQueueData();
    }, 3000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(announcementInterval);
      if (adInterval) clearInterval(adInterval);
      clearInterval(refreshInterval);
      speechSynthesis.cancel();
    };
  }, [displayId, navigate, showAds, textFontFamily]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadDepartments();
      await loadCounters();
      await loadQueueData();
      await loadCalledTickets();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      console.log('🔄 Loading departments...');
      const departmentsData = await departmentService.getDepartments();
      const activeDepartments = departmentsData.filter(dept => dept.active !== false);
      setDepartments(activeDepartments);
      console.log(`✅ Loaded ${activeDepartments.length} departments`);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadCounters = async () => {
    try {
      console.log('🔄 Loading counters...');
      const countersData = await counterService.getAllCounters();
      console.log('📊 Raw counters data:', countersData);
      
      setCounters(countersData);
      setLastUpdate(new Date());
      
      // Update active counters based on loaded counters
      updateActiveCounters(countersData);
      
      console.log(`✅ Loaded ${countersData.length} counters, ${activeCounters.length} active`);
    } catch (error) {
      console.error('❌ Error loading counters:', error);
      // Fallback to demo data if API fails
      const demoCounters = getDemoCounters();
      setCounters(demoCounters);
      updateActiveCounters(demoCounters);
    }
  };

  const updateActiveCounters = (countersData) => {
    if (!countersData || !Array.isArray(countersData)) {
      console.warn('⚠️ No counters data provided to updateActiveCounters');
      setActiveCounters([]);
      return;
    }

    // Filter active counters - include both active and busy status
    const activeCountersData = countersData.filter(counter => {
      const isActive = counter.status === 'active' || counter.status === 'busy';
      console.log(`🔍 Counter ${counter.counterNumber}: status=${counter.status}, active=${isActive}`);
      return isActive;
    });
    
    // Sort by counter number
    activeCountersData.sort((a, b) => a.counterNumber - b.counterNumber);
    
    setActiveCounters(activeCountersData);
    console.log(`✅ Updated ${activeCountersData.length} active counters:`, 
      activeCountersData.map(c => `${c.counterNumber}(${c.status})`));
  };

  const getDemoCounters = () => {
    return [
      {
        _id: '1',
        counterNumber: 1,
        name: 'Reception Counter 1',
        status: 'active',
        department: { _id: '1', name: 'Reception', code: 'RECEPTION' },
        currentTicket: { 
          ticketNumber: 'A015', 
          calledAt: new Date(),
          patientName: 'John Doe'
        },
        type: 'reception'
      },
      {
        _id: '2',
        counterNumber: 2,
        name: 'OPD Counter 1',
        status: 'busy',
        department: { _id: '2', name: 'General OPD', code: 'OPD' },
        currentTicket: { 
          ticketNumber: 'B008', 
          calledAt: new Date(Date.now() - 5 * 60000),
          patientName: 'Jane Smith'
        },
        type: 'department'
      },
      {
        _id: '3',
        counterNumber: 3,
        name: 'Emergency Counter',
        status: 'active',
        department: { _id: '3', name: 'Emergency', code: 'ER' },
        currentTicket: null,
        type: 'emergency'
      }
    ];
  };

  const loadQueueData = async () => {
    try {
      console.log('🔄 Loading queue data from database...');
      
      // Load real queue data from API
      const queueStats = await ticketService.getQueueStats();
      const newQueueData = {};
      
      // Process queue data for each department
      departments.forEach(dept => {
        const deptStats = queueStats.find(stat => stat.departmentId === dept._id) || {};
        const waitingTickets = deptStats.waitingTickets || [];
        const servedToday = deptStats.servedToday || 0;
        
        // Get active counters for this department
        const deptCounters = counters.filter(counter => 
          counter.department?._id === dept._id && 
          (counter.status === 'active' || counter.status === 'busy')
        );
        
        // Get current serving ticket
        const currentTicket = counters.find(counter => 
          counter.department?._id === dept._id && 
          counter.currentTicket
        )?.currentTicket;

        newQueueData[dept._id] = {
          waitingCount: waitingTickets.length,
          servedToday: servedToday,
          avgWaitTime: dept.estimatedWaitTime || 15,
          activeCounters: deptCounters.length,
          currentTicket: currentTicket,
          waitingTickets: waitingTickets
        };
      });
      
      setQueueData(newQueueData);
      console.log('✅ Real queue data loaded successfully from database');
      
    } catch (error) {
      console.error('Error loading queue data from database:', error);
    }
  };

  const loadCalledTickets = async () => {
    try {
      console.log('🔄 Loading called tickets history...');
      const recentTickets = await ticketService.getRecentCalledTickets();
      if (recentTickets && recentTickets.length > 0) {
        setCalledTickets(recentTickets.slice(0, 8));
        console.log(`✅ Loaded ${recentTickets.length} recent called tickets`);
      } else {
        // Demo data for called tickets
        const demoCalledTickets = [
          {
            _id: '1',
            ticketNumber: 'A014',
            counterNumber: 1,
            department: { name: 'Reception' },
            announcementTime: new Date(Date.now() - 2 * 60000)
          },
          {
            _id: '2',
            ticketNumber: 'B007',
            counterNumber: 2,
            department: { name: 'OPD' },
            announcementTime: new Date(Date.now() - 5 * 60000)
          }
        ];
        setCalledTickets(demoCalledTickets);
      }
    } catch (error) {
      console.error('Error loading called tickets:', error);
    }
  };

  // ✅ VOICE ANNOUNCEMENT HANDLER
  const processVoiceAnnouncement = async (announcementData) => {
    const { ticketNumber, counterNumber, isRecall, type, audioUrl } = announcementData;
    
    console.log(`🔊 VOICE ANNOUNCEMENT: ${ticketNumber} for Counter ${counterNumber}`);
    
    try {
      // Play audio announcement if available
      if (type === 'mp3_announcement' && audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = 0.8;
        await audio.play();
      } else {
        // Fallback to TTS
        const message = `${isRecall ? 'دوبارہ' : ''} ٹکٹ نمبر ${ticketNumber} کاؤنٹر ${counterNumber} پر تشریف لائیں`;
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = 'ur-PK';
          speechSynthesis.speak(utterance);
        }
      }
      console.log('✅ Voice announcement completed');
    } catch (error) {
      console.error('❌ Voice announcement failed:', error);
    }
  };

  const setupSocketListeners = () => {
    if (!socket) {
      console.log('Running in demo mode - no socket connection');
      return;
    }
    
    socket.emit('join-display', displayId || 'main-waiting');

    // ✅ VOICE ANNOUNCEMENTS
    socket.on('urdu-voice-announcement', async (data) => {
      console.log('🔊 WaitingArea received voice announcement:', data);
      await processVoiceAnnouncement(data);
    });

    socket.on('counter-updated', (counter) => {
      console.log('🔄 Counter updated:', counter);
      setCounters(prev => prev.map(c => 
        c._id === counter._id ? counter : c
      ));
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('counter-created', (counter) => {
      console.log('🆕 Counter created:', counter);
      setCounters(prev => {
        const exists = prev.find(c => c._id === counter._id);
        if (!exists) {
          return [...prev, counter];
        }
        return prev;
      });
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('counter-deleted', (counterId) => {
      console.log('🗑️ Counter deleted:', counterId);
      setCounters(prev => prev.filter(c => c._id !== counterId));
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('token-called', (data) => {
      console.log('📢 Token called:', data);
      const { ticket, counter } = data;
      
      // Update called tickets
      const newCalledTicket = {
        ...ticket,
        counterNumber: counter.counterNumber,
        announcementTime: new Date()
      };

      setCalledTickets(prev => {
        const filtered = prev.filter(t => t._id !== ticket._id);
        return [newCalledTicket, ...filtered].slice(0, 8);
      });

      // Update active announcements
      setActiveAnnouncements(prev => {
        const filtered = prev.filter(a => a.ticketId !== ticket._id);
        const newAnnouncement = {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          counterNumber: counter.counterNumber,
          department: ticket.department?.name,
          timestamp: new Date()
        };
        return [newAnnouncement, ...filtered];
      });

      // Text to speech announcement
      textToSpeech(ticket.ticketNumber, counter.counterNumber, ticket.department?.name);
      
      // Update counters
      setCounters(prev => prev.map(c => 
        c._id === counter._id ? counter : c
      ));
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('token-completed', (data) => {
      console.log('✅ Token completed:', data);
      setCounters(prev => prev.map(c => 
        c._id === data.counter._id ? data.counter : c
      ));
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('token-recalled', (data) => {
      console.log('🔁 Token recalled:', data);
      const { ticket, counter } = data;
      textToSpeech(ticket.ticketNumber, counter.counterNumber, ticket.department?.name);
      setCounters(prev => prev.map(c => 
        c._id === counter._id ? counter : c
      ));
      setLastUpdate(new Date());
      updateActiveCounters(counters);
    });

    socket.on('ticket-generated', (data) => {
      console.log('🎫 New ticket generated:', data);
      // Update queue data when new ticket is generated
      setQueueData(prev => ({
        ...prev,
        [data.department._id]: {
          ...prev[data.department._id],
          waitingCount: (prev[data.department._id]?.waitingCount || 0) + 1
        }
      }));
    });

    socket.on('queue-updated', (data) => {
      console.log('📊 Queue updated:', data);
      // Update specific department queue data
      setQueueData(prev => ({
        ...prev,
        [data.departmentId]: data.queueData
      }));
    });

    socket.on('department-updated', () => {
      console.log('🏥 Department updated');
      // Reload departments when they are updated
      loadDepartments();
    });

    socket.on('settings-updated', () => {
      console.log('⚙️ Settings updated');
      // Reload data when settings are updated
      loadInitialData();
    });

    // Listen for counter status changes specifically
    socket.on('counter-status-changed', (data) => {
      console.log('🔄 Counter status changed:', data);
      setCounters(prev => prev.map(c => 
        c._id === data.counterId ? { ...c, status: data.status } : c
      ));
      updateActiveCounters(counters);
    });
  };

  const textToSpeech = (ticketNumber, counterNumber, departmentName) => {
    if (!soundNotifications) return;

    speechSynthesis.cancel();
    const announcementText = `Token number ${ticketNumber}, please proceed to counter number ${counterNumber} for ${departmentName}`;

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(announcementText);
      utterance.lang = language;
      utterance.rate = 0.85;
      utterance.pitch = 1.2;
      utterance.volume = 1;

      const voices = speechSynthesis.getVoices();
      const womenVoices = voices.filter(voice => 
        !voice.name.toLowerCase().includes('male') && 
        !voice.name.toLowerCase().includes('david')
      );

      if (womenVoices.length > 0) {
        utterance.voice = womenVoices[0];
      }

      setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 100);
    }
  };

  const closeAnnouncement = (ticketId) => {
    setActiveAnnouncements(prev => prev.filter(a => a.ticketId !== ticketId));
  };

  const getAnnouncements = () => {
    if (advertisements.length > 0 && showAds) {
      const activeAds = advertisements.filter(ad => ad.active);
      if (activeAds.length > 0) return activeAds.map(ad => ad.text);
    }
    
    const defaultAnnouncements = [
      "QUALITY HEALTHCARE SERVICES AVAILABLE • EMERGENCY CASES PRIORITIZED • MAINTAIN SOCIAL DISTANCING",
      "FREE HEALTH CHECKUP CAMP THIS WEEKEND • CONSULT OUR SPECIALISTS FOR EXPERT CARE • THANK YOU FOR YOUR PATIENCE",
      "NEW CARDIOLOGY DEPARTMENT NOW OPEN • STATE-OF-THE-ART MEDICAL EQUIPMENT • 24/7 EMERGENCY SERVICES AVAILABLE",
      "PLEASE HAVE YOUR DOCUMENTS READY • KEEP THE WAITING AREA CLEAN • FOLLOW STAFF INSTRUCTIONS"
    ];
    
    if (customMessage) {
      return [customMessage, ...defaultAnnouncements];
    }
    
    return defaultAnnouncements;
  };

  const getAdvertisements = () => {
    // Use advertisements from settings if available and active
    if (advertisements.length > 0 && showAds) {
      const activeAds = advertisements.filter(ad => ad.active);
      if (activeAds.length > 0) {
        return activeAds.map(ad => ({
          type: ad.type || 'text',
          video: ad.video,
          image: ad.image,
          content: ad.text,
          title: ad.title || "Hospital Information",
          subtitle: ad.subtitle || "Quality Healthcare Services"
        }));
      }
    }
    
    // Fallback to default advertisements
    return [
      { 
        type: 'text', 
        content: "Welcome to " + hospitalTitle + " • Your Health is Our Top Priority • 24/7 Emergency Services Available",
        title: "Quality Healthcare",
        subtitle: "Serving You with Excellence"
      }
    ];
  };

  const currentAd = getAdvertisements()[adIndex];

  return (
    <div className="theme-container dark-blue-theme waiting-area-theme">
      {/* Background Elements */}
      <div className="background-logo">
        {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="blured-logo" />}
      </div>
      
      <div className="square-lines">
        <div className="line horizontal top"></div>
        <div className="line horizontal bottom"></div>
        <div className="line vertical left"></div>
        <div className="line vertical right"></div>
      </div>
      
      <div className="corner-decorations">
        <div className="corner top-left blue"></div>
        <div className="corner top-right red"></div>
        <div className="corner bottom-left red"></div>
        <div className="corner bottom-right blue"></div>
      </div>

      <audio ref={audioRef} preload="auto" />

      {activeAnnouncements.map((announcement, index) => (
        <AnnouncementPopup
          key={announcement.ticketId}
          announcement={announcement}
          onClose={() => closeAnnouncement(announcement.ticketId)}
          index={index}
        />
      ))}

      <div className="content-wrapper waiting-content-wrapper">
        {/* Header Section */}
        <div className="dispenser-header-theme waiting-header-theme">
          <div className="hospital-brand-theme">
            {hospitalLogoImage ? (
              <img src={hospitalLogoImage} alt="Hospital Logo" className="hospital-logo-theme" />
            ) : (
              <div className="hospital-logo-theme-icon">
                <i className="fas fa-hospital-alt"></i>
              </div>
            )}
            <div className="hospital-info-theme">
              <h1 className="hospital-name-theme white-text">
                {hospitalTitle}
              </h1>
              <p className="hospital-city-theme">{hospitalLocation}</p>
            </div>
          </div>
          
          <div className="header-status-theme">
            <div className="status-indicator-theme online">
              <i className="fas fa-circle"></i>
              {socket ? 'Live Connected' : 'Demo Mode'}
            </div>
            <div className="current-time-theme">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="last-update">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="spinner-3d-animation"></div>
              <div className="loading-text">Loading Queue Data...</div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="waiting-main-content">
          {/* Advertisement Panel */}
          <div className="waiting-ad-panel">
            <div className="ad-content-section">
              {showAds ? (
                <div className="ad-queue-container">
                  <div className="ad-queue-header">
                    <h3 className="ad-queue-title">
                      <i className="fas fa-play-circle"></i>
                      ADVERTISEMENTS
                    </h3>
                    <div className="ad-queue-indicator">
                      {adIndex + 1} / {getAdvertisements().length}
                    </div>
                  </div>
                  
                  <div className="ad-content-queue">
                    {currentAd?.type === 'video' && currentAd?.video ? (
                      <div className="video-container">
                        <video 
                          ref={videoRef}
                          className="ad-video"
                          autoPlay 
                          muted 
                          loop
                          playsInline
                          key={currentAd.video}
                        >
                          <source src={currentAd.video} type="video/mp4" />
                          <source src={currentAd.video} type="video/webm" />
                          <source src={currentAd.video} type="video/ogg" />
                          Your browser does not support the video tag.
                        </video>
                        <div className="video-overlay">
                          <h3 className="video-title">{currentAd.title}</h3>
                          <p className="video-subtitle">{currentAd.subtitle}</p>
                        </div>
                      </div>
                    ) : currentAd?.type === 'image' && currentAd?.image ? (
                      <div className="image-container">
                        <img 
                          src={currentAd.image} 
                          alt="Advertisement" 
                          className="ad-image"
                          key={currentAd.image}
                        />
                        <div className="image-overlay">
                          <h3 className="image-title">{currentAd.title}</h3>
                          <p className="image-subtitle">{currentAd.subtitle}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-ad-container">
                        <div className="text-ad-content">
                          <h3 className="text-ad-title">{currentAd?.title || "Hospital Information"}</h3>
                          <p className="text-ad-subtitle">{currentAd?.subtitle || "Quality Healthcare Services"}</p>
                          <div className="text-ad-message">
                            {currentAd?.content || "24/7 Emergency Services • Expert Medical Professionals • Modern Medical Equipment"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="default-ad-content">
                  <div className="ad-text-content">
                    <h2 className="ad-main-title">
                      Welcome to {hospitalTitle}
                    </h2>
                    <p className="ad-main-subtitle">Your Health is Our Top Priority</p>
                  </div>
                </div>
              )}
            </div>

            {/* News Ticker */}
            <div className="news-ticker-section">
              <div className="ticker-container">
                <span className="ticker-label">ANNOUNCEMENT:</span>
                <div className="ticker-content">
                  <span className="ticker-text">
                    {getAnnouncements()[announcementIndex]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Counter Display Panel */}
          <div className="counter-queue-panel">
            <div className="panel-header-section">
              <h2 className="panel-title">
                <i className="fas fa-desktop"></i>
                SERVICE COUNTERS
              </h2>
              <div className="queue-summary">
                <span className="summary-item active">
                  {activeCounters.filter(c => c.status === 'active').length} Active
                </span>
                <span className="summary-item busy">
                  {activeCounters.filter(c => c.status === 'busy').length} Busy
                </span>
                <span className="summary-item total">
                  {counters.length} Total
                </span>
              </div>
            </div>
            
            {/* Counters Grid Display */}
            <div className="all-counters-grid">
              {counters.length > 0 ? (
                counters.map((counter) => (
                  <CounterCard 
                    key={counter._id}
                    counter={counter}
                  />
                ))
              ) : (
                <div className="no-active-counters">
                  <i className="fas fa-desktop"></i>
                  <div className="no-counters-text">
                    <div>No Counters Available</div>
                    <div className="counters-count">
                      Please configure counters in the admin panel
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Counter Card Component
const CounterCard = ({ counter }) => {
  return (
    <div className={`counter-card ${counter.status}`}>
      <div className="counter-card-header">
        <div className="counter-number">
          <i className="fas fa-desktop"></i>
          Counter {counter.counterNumber}
        </div>
        <div className={`counter-status ${counter.status}`}>
          <span className="status-dot"></span>
          {counter.status.toUpperCase()}
        </div>
      </div>
      
      <div className="counter-info">
        <div className="info-item">
          <i className="fas fa-user-md"></i>
          <span>{counter.name || `Operator ${counter.counterNumber}`}</span>
        </div>
        <div className="info-item">
          <i className="fas fa-building"></i>
          <span>{counter.department?.name || 'General'}</span>
        </div>
      </div>

      {/* Current Serving Ticket */}
      <div className="current-ticket-section">
        <div className="serving-label">NOW SERVING</div>
        <div className="ticket-number">
          {counter.currentTicket?.ticketNumber || '---'}
        </div>
        {counter.currentTicket?.patientName && (
          <div className="patient-name">
            {counter.currentTicket.patientName}
          </div>
        )}
        {counter.currentTicket?.calledAt && (
          <div className="call-time">
            Called: {new Date(counter.currentTicket.calledAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

// AnnouncementPopup Component
const AnnouncementPopup = ({ announcement, onClose, index }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <div className={`announcement-popup ${visible ? 'visible' : 'hidden'}`}>
      <div className="popup-content">
        <div className="popup-header">
          <div className="popup-icon">
            <i className="fas fa-bullhorn"></i>
          </div>
          <div className="popup-title">ATTENTION PLEASE</div>
          <button className="popup-close" onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="popup-body">
          <div className="announcement-token">
            Token: <span className="token-highlight">{announcement.ticketNumber}</span>
          </div>
          <div className="announcement-counter">
            Please proceed to: <span className="counter-highlight">Counter {announcement.counterNumber}</span>
          </div>
          {announcement.department && (
            <div className="announcement-department">
              Department: <span className="department-highlight">{announcement.department}</span>
            </div>
          )}
        </div>
        
        <div className="popup-footer">
          <i className="fas fa-info-circle"></i>
          Please have your documents ready when approaching the counter
        </div>
      </div>
    </div>
  );
};

export default WaitingArea;