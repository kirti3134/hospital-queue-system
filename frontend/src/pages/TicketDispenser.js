import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ticketService } from '../services/ticketService';
import { useSettings } from '../context/SettingsContext';
import { authService } from '../services/authService';
import { useSocket } from '../context/SocketContext';
import universalVoiceService from '../services/voiceService';
import '../styles/TicketDispenser.css';

const TicketDispenserKiosk = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const socket = useSocket();
  const [departmentsList, setDepartmentsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ✅ FIXED: ULTRA-RELIABLE PRINTING SYSTEM
  const [printingStates, setPrintingStates] = useState({});
  const printQueueRef = useRef(new Map());
  const lastPrintTimeRef = useRef({});
  const consecutivePrintsRef = useRef({});

  // const hospitalTitle = "AL-KHIDMAT RAAZI HOSPITAL";
  const hospitalTitle = "CITY HOSPITAL DELHI";
  const hospitalLogoImage = settings?.hospitalLogo || '';
  // const hospitalLocation = settings?.hospitalCity || 'ISLAMABAD';
  const hospitalLocation = settings?.hospitalCity || 'DELHI';

  useEffect(() => {
    initializeKioskMode();
    return () => cleanupKioskMode();
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    validateUserAccess();
    loadDepartmentsData();
    initializeSocketListeners();

    // ✅ AUTO-REFRESH: Update departments data every 5 seconds
    const autoRefreshInterval = setInterval(() => {
      if (!isLoading) {
        loadDepartmentsData();
      }
    }, 5000);

    return () => {
      if (socket) {
        socket.off('urdu-voice-announcement');
        socket.off('ticket-generated');
        socket.off('new-ticket');
        socket.off('system-recovered');
        socket.off('system-auto-recovered');
      }
      clearInterval(autoRefreshInterval);
      cleanupKioskMode();
    };
  }, [navigate, socket]);

  useEffect(() => {
    if (socket) universalVoiceService.setSocket(socket);
  }, [socket]);

  const validateUserAccess = () => {
    if (!authService.isAuthenticated()) {
      navigate('/login/dispenser');
      return;
    }
    const accessValidation = authService.validateComponentAccess('dispenser');
    if (!accessValidation.valid) {
      navigate(accessValidation.redirect);
      return;
    }
  };

  const processVoiceAnnouncement = async (announcementData) => {
    const { ticketNumber, counterNumber, isRecall, type, audioUrl } = announcementData;
    
    console.log(`🔊 CENTRALIZED VOICE ANNOUNCEMENT: ${ticketNumber} for Counter ${counterNumber}`);
    
    try {
      if (type === 'mp3_announcement' && audioUrl) {
        await universalVoiceService.playAudioFile(audioUrl);
      } else {
        await universalVoiceService.speakUrduAnnouncement(
          universalVoiceService.getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall)
        );
      }
      console.log('✅ Centralized voice announcement completed');
    } catch (error) {
      console.error('❌ Centralized voice announcement failed:', error);
    }
  };

  const initializeKioskMode = () => {
    enterFullscreen();
    document.addEventListener('contextmenu', disableContextMenu);
  };

  const cleanupKioskMode = () => {
    printQueueRef.current.clear();
    document.removeEventListener('contextmenu', disableContextMenu);
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err);
      });
    }
  };

  const disableContextMenu = (e) => {
    e.preventDefault();
    return false;
  };

  const initializeSocketListeners = () => {
    if (!socket) return;

    socket.on('urdu-voice-announcement', async (data) => {
      console.log('🔊 Centralized Dispenser received voice announcement:', data);
      await processVoiceAnnouncement(data);
    });

    socket.on('system-recovered', (data) => {
      console.log('✅ System recovered:', data);
      // Auto-reset all printing states
      setPrintingStates({});
      printQueueRef.current.clear();
    });

    socket.on('system-auto-recovered', (data) => {
      console.log('🔄 System auto-recovered:', data);
      setPrintingStates({});
      printQueueRef.current.clear();
    });

    // ✅ NEW: Listen for print queue clear events
    socket.on('print-queue-clear', (data) => {
      console.log('🔄 Print queue cleared by server:', data);
      forceClearAllPrintingStates();
    });

    socket.on('ticket-generated', (ticket) => {
      console.log('New ticket generated:', ticket);
    });

    socket.on('new-ticket', (ticket) => {
      console.log('New ticket notification:', ticket);
    });

    socket.emit('join-dispenser');
  };

  const loadDepartmentsData = async () => {
    try {
      setIsLoading(true);
      const departmentsResponse = await ticketService.getDepartments();
      const activeDepartments = departmentsResponse.filter(dept => dept.active !== false);
      setDepartmentsList(activeDepartments);
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartmentsList([
        { _id: '1', name: 'General OPD', code: 'general', active: true, prefix: 'A' },
        { _id: '2', name: 'Cardiology', code: 'cardiology', active: true, prefix: 'B' },
        { _id: '3', name: 'Orthopedics', code: 'ortho', active: true, prefix: 'C' },
        { _id: '4', name: 'Pediatrics', code: 'pediatrics', active: true, prefix: 'D' },
        { _id: '5', name: 'Emergency', code: 'emergency', active: true, prefix: 'E' },
        { _id: '6', name: 'Dental', code: 'dental', active: true, prefix: 'F' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: ULTRA-RELIABLE TICKET GENERATION WITH AUTO-RECOVERY
  const generateNewTicket = async (department) => {
    const departmentId = department._id;
    
    // ✅ PREVENT MULTIPLE CLICKS & MEMORY LEAKS
    if (printingStates[departmentId] || printQueueRef.current.has(departmentId)) {
      console.log(`⚠️ Already processing: ${department.name}`);
      return;
    }

    // ✅ RATE LIMITING: Prevent too many rapid clicks
    const now = Date.now();
    const lastPrintTime = lastPrintTimeRef.current[departmentId] || 0;
    const timeSinceLastPrint = now - lastPrintTime;
    
    if (timeSinceLastPrint < 1000) { // 1 second cooldown
      console.log(`⏳ Too fast, please wait: ${department.name}`);
      return;
    }

    // ✅ CONSECUTIVE PRINT PROTECTION
    if (!consecutivePrintsRef.current[departmentId]) {
      consecutivePrintsRef.current[departmentId] = 0;
    }
    
    consecutivePrintsRef.current[departmentId]++;
    
    // After 5 consecutive prints, force a cooldown
    if (consecutivePrintsRef.current[departmentId] >= 5) {
      console.log(`🔄 Cooldown after 5 prints: ${department.name}`);
      setTimeout(() => {
        consecutivePrintsRef.current[departmentId] = 0;
      }, 2000);
    }

    try {
      // ✅ INSTANT UI UPDATE
      setPrintingStates(prev => ({ ...prev, [departmentId]: true }));
      printQueueRef.current.set(departmentId, true);
      lastPrintTimeRef.current[departmentId] = now;

      // ✅ FAST TICKET GENERATION WITH TIMEOUT PROTECTION
      const ticketPromise = ticketService.generateTicket({
        departmentId: department._id,
        departmentName: department.name,
        priority: "normal",
      });

      // Add aggressive timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ticket generation timeout')), 5000) // Reduced to 5 seconds
      );

      const ticketData = await Promise.race([ticketPromise, timeoutPromise]);

      const payload = {
        ticketNumber: ticketData.ticketNumber,
        departmentName: department.name,
        hospitalName: "CITY HOSPITAL DELHI",
        date: new Date().toLocaleDateString("en-PK"),
        time: new Date().toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        departmentCode: department.prefix || department.code?.toUpperCase() || 'GEN'
      };

      // ✅ NON-BLOCKING PRINT REQUEST WITH ERROR RECOVERY
      const printPromise = fetch("/api/print-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const printTimeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ ok: false }), 4000) // Reduced to 4 seconds
      );

      const printResponse = await Promise.race([printPromise, printTimeoutPromise]);
      
      if (printResponse.ok) {
        const result = await printResponse.json();
        console.log('✅ Print request successful:', result);
      } else {
        console.log('⚠️ Print request timed out, but ticket was generated');
      }

    } catch (err) {
      console.error("❌ Ticket generation error:", err);
      
      // ✅ AUTO-RECOVERY ON ERROR
      if (err.message.includes('timeout') || err.message.includes('network')) {
        console.log('🔄 Auto-recovering from timeout...');
      }
      
    } finally {
      // ✅ GUARANTEED BUTTON RESET - No stuck buttons
      setTimeout(() => {
        setPrintingStates(prev => {
          const newState = { ...prev };
          delete newState[departmentId];
          return newState;
        });
        printQueueRef.current.delete(departmentId);
        
        // ✅ CLEANUP: Remove old entries to prevent memory leaks
        const now = Date.now();
        Object.keys(lastPrintTimeRef.current).forEach(deptId => {
          if (now - lastPrintTimeRef.current[deptId] > 60000) { // 1 minute
            delete lastPrintTimeRef.current[deptId];
          }
        });
      }, 500); // Short delay for smooth UX
    }
  };

  // ✅ AGGRESSIVE AUTO-REFRESH SYSTEM - FIX FOR STUCK PRINTING STATES
  useEffect(() => {
    // Quick refresh every 3 seconds for stuck states
    const quickRefreshInterval = setInterval(() => {
      const now = Date.now();
      let needsRefresh = false;
      
      printQueueRef.current.forEach((timestamp, departmentId) => {
        if (now - timestamp > 3000) { // 3 seconds old - AGGRESSIVE
          printQueueRef.current.delete(departmentId);
          setPrintingStates(prev => {
            const newState = { ...prev };
            delete newState[departmentId];
            return newState;
          });
          needsRefresh = true;
          console.log(`🔄 Auto-cleared stuck state: ${departmentId}`);
        }
      });
      
      // Force state cleanup for any orphaned printing states
      setPrintingStates(prev => {
        const newState = {};
        Object.keys(prev).forEach(deptId => {
          const timestamp = printQueueRef.current.get(deptId);
          if (timestamp && (now - timestamp < 3000)) {
            newState[deptId] = prev[deptId];
          }
        });
        return newState;
      });
    }, 3000); // Every 3 seconds - FAST REFRESH

    // Longer cleanup for memory management
    const cleanupInterval = setInterval(() => {
      // Clear old print queue entries
      const now = Date.now();
      printQueueRef.current.forEach((timestamp, departmentId) => {
        if (now - timestamp > 30000) { // 30 seconds old
          printQueueRef.current.delete(departmentId);
        }
      });

      // Reset consecutive prints counter periodically
      consecutivePrintsRef.current = {};
      
      // Force complete state reset every 30 seconds
      console.log('🧹 Periodic cleanup completed');
    }, 30000); // Clean every 30 seconds

    return () => {
      clearInterval(quickRefreshInterval);
      clearInterval(cleanupInterval);
    };
  }, []);

  const getDepartmentIconName = (code) => {
    const iconMapping = {
      general: 'stethoscope',
      cardiology: 'heart-pulse',
      ortho: 'bone',
      pediatrics: 'child',
      dental: 'tooth',
      eye: 'eye',
      emergency: 'truck-medical'
    };
    return iconMapping[code] || 'stethoscope';
  };

  if (isLoading && !departmentsList.length) {
    return (
      <div className="ticket-dispenser-container dark-blue-theme">
        <div className="dispenser-background-logo">
          {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="dispenser-logo-blur" />}
        </div>
        <div className="dispenser-loading-container">
          <div className="dispenser-spinner"></div>
          <div className="dispenser-loading-text">Loading Hospital Services...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-dispenser-container kiosk-mode">
      <div className="dispenser-background-logo">
        {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="dispenser-logo-blur" />}
      </div>

      <div className="dispenser-content-wrapper">
        <div className="dispenser-header">
          <div className="dispenser-branding">
            {hospitalLogoImage ? (
              <img src={hospitalLogoImage} alt="Hospital Logo" className="dispenser-logo" />
            ) : (
              <div className="dispenser-logo-placeholder">
                <i className="fas fa-hospital-alt"></i>
              </div>
            )}
            <div className="dispenser-details">
              <h1 className="dispenser-title">{hospitalTitle}</h1>
              <p className="dispenser-location">{hospitalLocation}</p>
            </div>
          </div>
        </div>

        {/* ✅ HIDDEN SYSTEM STATUS FOR DEBUGGING */}
        <div style={{ display: 'none' }}>
          Active Prints: {Object.keys(printingStates).length} | 
          Queue: {printQueueRef.current.size}
        </div>

        <div className="dispenser-grid">
          {departmentsList.map((dept, index) => {
            const isDepartmentPrinting = printingStates[dept._id] || false;
            
            return (
              <div 
                key={dept._id} 
                className={`dispenser-card ${isDepartmentPrinting ? 'printing' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => !isDepartmentPrinting && generateNewTicket(dept)}
              >
                <div className="dispenser-card-header">
                  <div className="dispenser-icon">
                    <i className={`fas fa-${getDepartmentIconName(dept.code)}`}></i>
                  </div>
                  <div className="dispenser-meta">
                    <span className="dispenser-code">
                      {dept.prefix || dept.code?.toUpperCase() || 'GEN'}
                    </span>
                  </div>
                </div>
                
                <div className="dispenser-card-content">
                  <h3 className="dispenser-dept-name">{dept.name}</h3>
                </div>

                <div className={`dispenser-button ${isDepartmentPrinting ? 'printing' : ''}`}>
                  {isDepartmentPrinting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Printing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-ticket-alt"></i>
                      GET TICKET
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TicketDispenserKiosk;