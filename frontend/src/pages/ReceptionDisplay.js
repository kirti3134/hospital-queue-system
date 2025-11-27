import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';
import { displayService } from '../services/displayService';
import '../styles/ReceptionDisplay.css';

const ReceptionDisplay = () => {
  const { displayId = 'reception-1' } = useParams();
  const socket = useSocket();
  const { settings } = useSettings();
  const [currentTickets, setCurrentTickets] = useState([]);
  const [departmentQueues, setDepartmentQueues] = useState([]);
  const [displaySettings, setDisplaySettings] = useState({});

  useEffect(() => {
    loadDisplayData();
    setupSocketListeners();

    // ✅ AUTO-REFRESH: Update reception data every 3 seconds
    const autoRefreshInterval = setInterval(() => {
      loadDisplayData();
    }, 3000);

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [displayId]);

  const loadDisplayData = async () => {
    try {
      const displayData = await displayService.getDisplayData(displayId);
      setCurrentTickets(displayData.currentTickets || []);
      setDepartmentQueues(displayData.departmentCounts || []);
      
      if (displayData.display?.settings) {
        setDisplaySettings(displayData.display.settings);
      }
    } catch (error) {
      console.error('Error loading display data:', error);
    }
  };

  // ✅ VOICE ANNOUNCEMENT HANDLER
  const processVoiceAnnouncement = async (announcementData) => {
    const { ticketNumber, counterNumber, isRecall, type, audioUrl } = announcementData;
    
    console.log(`🔊 RECEPTION ANNOUNCEMENT: ${ticketNumber} for Counter ${counterNumber}`);
    
    try {
      if (type === 'mp3_announcement' && audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = 0.9;
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
      console.error('❌ Reception announcement failed:', error);
    }
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.emit('join-display', displayId);

    // ✅ VOICE ANNOUNCEMENTS
    socket.on('urdu-voice-announcement', async (data) => {
      console.log('🔊 ReceptionDisplay received voice announcement:', data);
      await processVoiceAnnouncement(data);
    });

    socket.on('token-called', () => {
      loadDisplayData();
    });

    socket.on('token-completed', () => {
      loadDisplayData();
    });

    socket.on('ticket-generated', () => {
      loadDisplayData();
    });
  };

  const getThemeClass = () => {
    return displaySettings.theme || 'default';
  };

  return (
    <div className={`reception-display ${getThemeClass()}`}>
      {displaySettings.showLogo && (
        <div className="display-header">
          <div className="hospital-branding">
            <i className="fas fa-hospital-alt"></i>
            <div className="hospital-info">
              <h1>{settings?.hospitalName || 'City Hospital Delhi'}</h1>
              <p>Reception Display</p>
            </div>
          </div>
        </div>
      )}

      <div className="reception-content">
        <div className="now-serving-section">
          <h2 className="section-title">
            <i className="fas fa-bullhorn"></i>
            NOW SERVING
          </h2>
          
          <div className="current-tickets">
            {currentTickets.map(ticket => (
              <div key={ticket._id} className="serving-ticket">
                <div className="ticket-number">{ticket.ticketNumber}</div>
                <div className="ticket-details">
                  <div className="department">{ticket.department?.name}</div>
                  <div className="counter">Counter {ticket.assignedCounter?.counterNumber}</div>
                </div>
              </div>
            ))}
            {currentTickets.length === 0 && (
              <div className="no-active-calls">
                <div className="placeholder">No active calls</div>
                <div className="subtext">Please wait for your number</div>
              </div>
            )}
          </div>
        </div>

        <div className="queues-section">
          <h3 className="section-title">Department Queues</h3>
          <div className="queues-grid">
            {departmentQueues.map(dept => (
              <div key={dept._id} className="queue-card">
                <div className="dept-name">{dept.name}</div>
                <div className="waiting-count">{dept.waitingCount || 0}</div>
                <div className="waiting-text">Waiting</div>
              </div>
            ))}
          </div>
        </div>

        {displaySettings.showAds && (
          <div className="advertisement-section">
            <div className="ad-content">
              <p>Quality Healthcare Services | Emergency: 24/7 | Pharmacy: Open</p>
            </div>
          </div>
        )}

        {displaySettings.customMessage && (
          <div className="custom-message">
            {displaySettings.customMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceptionDisplay;