import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';
import { counterService } from '../services/counterService';
import { authService } from '../services/authService';
import '../styles/CounterInterface.css';

const CounterInterfaceRenamed = () => {
  const { counterId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { settings } = useSettings();
  
  const [counterData, setCounterData] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketQueue, setTicketQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [connectionState, setConnectionState] = useState('connected');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [departmentList, setDepartmentList] = useState([]);
  const [targetDepartment, setTargetDepartment] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentView, setCurrentView] = useState('queue');
  const [callInProgress, setCallInProgress] = useState(false);
  const [buttonCooldown, setButtonCooldown] = useState(false);

  const themeConfig = settings?.themes || {};
  const mainColor = themeConfig.primaryColor || '#1e3a8a';
  const highlightColor = themeConfig.accentColor || '#dc2626';
  const textFontFamily = themeConfig.fontFamily || 'Inter, sans-serif';

  const hospitalTitle = settings?.hospitalName || 'CITY HOSPITAL DELHI';
  const hospitalLogoImage = settings?.hospitalLogo || '';
  const hospitalLocation = settings?.hospitalCity || 'ISLAMABAD';

  useEffect(() => {
    document.body.style.fontFamily = textFontFamily;
    document.body.style.overflow = 'auto';

    initializeCounterSystem();
    loadDepartmentData();
    
    return () => {
      removeSocketListeners();
    };
  }, [counterId, textFontFamily]);

  // ✅ FIXED: CALL NEXT PATIENT WITH PROPER VALIDATION
  const callNextInQueue = async () => {
    if (ticketQueue.length === 0) {
      addToSystemLogs('No tickets in queue', 'warning');
      return;
    }

    if (counterData?.status === 'busy') {
      addToSystemLogs('Currently serving a patient', 'warning');
      return;
    }

    if (callInProgress || buttonCooldown) {
      addToSystemLogs('Action already in progress', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      setCallInProgress(true);
      setButtonCooldown(true);
      addToSystemLogs('Calling next patient...', 'info');
      
      const nextTicket = ticketQueue[0];
      
      // Send request to centralized system
      socket.emit('request-voice-call', {
        ticket: nextTicket,
        counter: counterData,
        isRecall: false,
        source: 'counter'
      });
      
      addToSystemLogs(`Call request sent: ${nextTicket.ticketNumber}`, 'success');
      
      // ✅ OPTIMIZED: Auto-disable button for 1.5 seconds only
      setTimeout(() => {
        setCallInProgress(false);
        setButtonCooldown(false);
      }, 1500);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      addToSystemLogs(`Call failed: ${errorMessage}`, 'error');
      setCallInProgress(false);
      setButtonCooldown(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: RECALL CURRENT TICKET
  const recallCurrentTicket = async () => {
    if (!activeTicket) {
      addToSystemLogs('No active ticket to recall', 'warning');
      return;
    }

    if (callInProgress || buttonCooldown) {
      addToSystemLogs('Action already in progress', 'warning');
      return;
    }
    
    try {
      setIsLoading(true);
      setCallInProgress(true);
      setButtonCooldown(true);
      addToSystemLogs('Recalling current patient...', 'info');
      
      socket.emit('request-voice-recall', {
        ticket: activeTicket,
        counter: counterData,
        isRecall: true,
        source: 'counter'
      });
      
      addToSystemLogs(`Recall request sent: ${activeTicket.ticketNumber}`, 'warning');
      
      // ✅ OPTIMIZED: Auto-disable button for 1.5 seconds only
      setTimeout(() => {
        setCallInProgress(false);
        setButtonCooldown(false);
      }, 1500);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      addToSystemLogs(`Recall failed: ${errorMessage}`, 'error');
      setCallInProgress(false);
      setButtonCooldown(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: COMPLETE CURRENT SERVICE WITH AUTO-RELOAD
  const completeCurrentService = async () => {
    if (!activeTicket) {
      addToSystemLogs('No active ticket to complete', 'warning');
      return;
    }
    
    try {
      setIsLoading(true);
      addToSystemLogs('Completing current service...', 'info');
      
      await counterService.completeTicket(counterId);
      addToSystemLogs(`Completed ticket: ${activeTicket.ticketNumber}`, 'success');
      
      // ✅ OPTIMIZED: AUTO-RELOAD after completion with minimal delay
      setTimeout(() => {
        loadCounterInformation();
      }, 100);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      addToSystemLogs(`Completion failed: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: FULL PAGE RELOAD FUNCTION
  const reloadFullPage = () => {
    addToSystemLogs('Reloading full page...', 'info');
    window.location.reload();
  };

  const initiateTicketTransfer = async () => {
    if (!activeTicket) {
      addToSystemLogs('No active ticket to transfer', 'warning');
      return;
    }

    if (!targetDepartment) {
      addToSystemLogs('Please select a department to transfer to', 'warning');
      return;
    }

    try {
      setIsTransferring(true);
      addToSystemLogs(`Transferring ticket to ${targetDepartment}...`, 'info');
      
      await counterService.transferTicket(counterId, targetDepartment);
      addToSystemLogs(`Transferred ticket ${activeTicket.ticketNumber} to ${targetDepartment}`, 'info');
      
      setShowTransferDialog(false);
      setTargetDepartment('');
      
      setTimeout(() => {
        loadCounterInformation();
      }, 500);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      addToSystemLogs(`Transfer failed: ${errorMessage}`, 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const openTransferDialog = () => {
    if (!activeTicket) {
      addToSystemLogs('No active ticket to transfer', 'warning');
      return;
    }
    setShowTransferDialog(true);
  };

  const closeTransferDialog = () => {
    setShowTransferDialog(false);
    setTargetDepartment('');
  };

  // ✅ FIXED: REFRESH COUNTER DATA
  const refreshCounterData = async () => {
    try {
      setIsLoading(true);
      await loadCounterInformation();
      addToSystemLogs('Manual refresh completed', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const openWaitingDisplay = () => {
    const baseUrl = window.location.origin;
    const waitingUrl = `${baseUrl}/waiting/counter/${counterId}`;
    window.open(waitingUrl, `Waiting_${counterId}`, 'width=1400,height=900,location=no,menubar=no,toolbar=no');
  };

  const getPriorityDetails = (priority) => {
    const priorityTypes = {
      emergency: { label: 'Emergency', color: '#dc2626', icon: 'fa-truck-medical' },
      priority: { label: 'Priority', color: '#ea580c', icon: 'fa-star' },
      senior: { label: 'Senior', color: '#7c3aed', icon: 'fa-user-tie' },
      child: { label: 'Child', color: '#0891b2', icon: 'fa-child' },
      normal: { label: 'Normal', color: '#059669', icon: 'fa-user' }
    };
    return priorityTypes[priority] || priorityTypes.normal;
  };

  const getStatusColorCode = (status) => {
    const statusColors = {
      active: '#059669',
      busy: '#dc2626',
      break: '#d97706',
      offline: '#6b7280'
    };
    return statusColors[status] || statusColors.offline;
  };

  const loadDepartmentData = async () => {
    try {
      const departmentsResponse = await counterService.getDepartments();
      setDepartmentList(departmentsResponse.filter(dept => dept.active !== false));
    } catch (error) {
      console.error('Failed to load departments:', error);
      addToSystemLogs('Failed to load departments', 'error');
    }
  };

  const initializeCounterSystem = async () => {
    if (!await validateUserAccess()) return;
    await loadCounterInformation();
    setupSocketListeners();
  };

  const validateUserAccess = async () => {
    if (!authService.isAuthenticated()) {
      navigate('/login/counter');
      return false;
    }

    const currentUser = authService.getCurrentUser();
    const currentComponent = authService.getCurrentComponent();
    
    if (currentComponent !== 'counter') {
      navigate('/login/counter');
      return false;
    }

    if (currentUser?.counter && currentUser.counter._id !== counterId && currentUser.counter !== counterId) {
      alert('Access denied to this counter');
      navigate('/counter/select');
      return false;
    }

    return true;
  };

  // ✅ FIXED: LOAD COUNTER INFORMATION WITH BETTER ERROR HANDLING
  const loadCounterInformation = async () => {
    try {
      setIsLoading(true);
      const counterDetails = await counterService.getCounterDetails(counterId);
      
      setCounterData(counterDetails.counter);
      setActiveTicket(counterDetails.counter?.currentTicket || null);
      setTicketQueue(counterDetails.queue || []);
      
      addToSystemLogs('Counter data loaded successfully', 'success');
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('Failed to load counter data:', error);
      addToSystemLogs('Failed to load counter data', 'error');
      setConnectionState('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: SETUP SOCKET LISTENERS WITH AUTO-RELOAD
  const setupSocketListeners = () => {
    if (!socket) {
      addToSystemLogs('Running in offline mode', 'warning');
      setConnectionState('disconnected');
      return;
    }

    socket.emit('join-counter', counterId);

    socket.on('connect', () => {
      setConnectionState('connected');
      addToSystemLogs('Real-time connection established', 'success');
      loadCounterInformation(); // Auto-reload on connect
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      addToSystemLogs('Connection lost - offline mode', 'warning');
    });

    // ✅ AUTO-RELOAD WHEN COUNTER STATUS UPDATES
    socket.on('counter-status-updated', (data) => {
      if (data.counter._id === counterId) {
        setCounterData(data.counter);
        setActiveTicket(data.activeTicket || null);
        addToSystemLogs('Counter status updated automatically', 'info');
      }
    });

    // ✅ AUTO-RELOAD WHEN TICKET STATUS UPDATES
    socket.on('ticket-status-updated', (data) => {
      if (data.counter._id === counterId) {
        loadCounterInformation();
        addToSystemLogs('Ticket status updated - auto reloaded', 'info');
      }
    });

    // ✅ AUTO-RELOAD WHEN CALL REQUEST COMPLETED
    socket.on('call-request-completed', (data) => {
      setTimeout(() => {
        loadCounterInformation();
        addToSystemLogs(`Call completed for ${data.ticketNumber} - auto reloaded`, 'success');
      }, 100);
    });

    // ✅ AUTO-RELOAD ALL COUNTERS
    socket.on('reload-all-counters', () => {
      loadCounterInformation();
      addToSystemLogs('System update - auto reloaded', 'info');
    });

    // ✅ MANUAL RELOAD TRIGGER
    socket.on('reload-counter-data', () => {
      loadCounterInformation();
      addToSystemLogs('Manual reload triggered', 'info');
    });

    // ✅ FULL PAGE RELOAD TRIGGER
    socket.on('full-page-reload', () => {
      addToSystemLogs('Full page reload requested', 'info');
      reloadFullPage();
    });

    // ✅ CALL REQUEST RESPONSES
    socket.on('call-request-received', (data) => {
      addToSystemLogs(`Call request queued: ${data.ticketNumber}`, 'success');
    });

    socket.on('call-request-error', (data) => {
      addToSystemLogs(`Call request failed: ${data.error}`, 'error');
      setCallInProgress(false);
      setButtonCooldown(false);
    });

    socket.on('recall-request-received', (data) => {
      addToSystemLogs(`Recall request queued: ${data.ticketNumber}`, 'warning');
    });

    socket.on('recall-request-error', (data) => {
      addToSystemLogs(`Recall request failed: ${data.error}`, 'error');
      setCallInProgress(false);
      setButtonCooldown(false);
    });

    // ✅ TICKET COMPLETION
    socket.on('token-completed', (data) => {
      if (data.counter._id === counterId) {
        setTimeout(() => {
          loadCounterInformation();
          addToSystemLogs(`Ticket ${data.ticket.ticketNumber} completed`, 'success');
        }, 300);
      }
    });

    // ✅ SETTINGS UPDATES
    socket.on('settings-updated', (updatedSettings) => {
      addToSystemLogs('Settings updated', 'info');
    });
  };

  const removeSocketListeners = () => {
    if (!socket) return;
    
    socket.off('counter-status-updated');
    socket.off('ticket-status-updated');
    socket.off('call-request-completed');
    socket.off('reload-all-counters');
    socket.off('reload-counter-data');
    socket.off('full-page-reload');
    socket.off('call-request-received');
    socket.off('call-request-error');
    socket.off('recall-request-received');
    socket.off('recall-request-error');
    socket.off('token-completed');
    socket.off('settings-updated');
    socket.off('connect');
    socket.off('disconnect');
  };

  const addToSystemLogs = (message, type = 'info') => {
    const logEntry = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setSystemLogs(prev => [logEntry, ...prev.slice(0, 19)]);
  };

  // ✅ CHECK IF CALL NEXT BUTTON SHOULD BE ENABLED
  const isCallNextEnabled = () => {
    return ticketQueue.length > 0 && 
           counterData?.status === 'active' && 
           !isLoading && 
           !callInProgress &&
           !buttonCooldown;
  };

  // ✅ CHECK IF RECALL BUTTON SHOULD BE ENABLED
  const isRecallEnabled = () => {
    return activeTicket && 
           !isLoading && 
           !callInProgress &&
           !buttonCooldown;
  };

  if (isLoading && !counterData) {
    return (
      <div className="theme-container dark-blue-theme">
        <div className="background-logo-container">
          {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="background-logo-blur" />}
        </div>
        <div className="loading-container">
          <div className="spinner-3d-animation"></div>
          <div className="loading-text">Initializing Counter Interface</div>
          <div className="loading-subtext">Loading counter data and services...</div>
        </div>
      </div>
    );
  }

  if (!counterData) {
    return (
      <div className="theme-container dark-blue-theme">
        <div className="error-display">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Counter Not Available</h2>
          <div className="error-details">
            <p><strong>Counter ID:</strong> {counterId}</p>
            <p><strong>Error:</strong> Counter not found or unavailable</p>
          </div>
          <div className="error-actions">
            <button onClick={loadCounterInformation} className="action-btn primary-btn">
              <i className="fas fa-redo"></i> Retry Connection
            </button>
            <button onClick={() => navigate('/counter/select')} className="action-btn secondary-btn">
              <i className="fas fa-arrow-left"></i> Select Different Counter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-container dark-blue-theme counter-panel-theme">
      <div className="background-logo-container">
        {hospitalLogoImage && <img src={hospitalLogoImage} alt="Hospital Logo" className="background-logo-blur" />}
      </div>

      {showTransferDialog && (
        <div className="modal-overlay-container">
          <div className="modal-content-panel">
            <div className="modal-header-section">
              <h3>Transfer Ticket</h3>
              <button className="modal-close-btn" onClick={closeTransferDialog}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body-content">
              <div className="transfer-details">
                <p>Transferring ticket: <strong>{activeTicket?.ticketNumber}</strong></p>
                <p>Current Department: <strong>{activeTicket?.department?.name}</strong></p>
              </div>
              <div className="form-input-group">
                <label htmlFor="department-selection">Select New Department:</label>
                <select
                  id="department-selection"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="department-selection"
                >
                  <option value="">Select a department</option>
                  {departmentList
                    .filter(dept => dept._id !== activeTicket?.department?._id)
                    .map(dept => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div className="modal-footer-section">
              <button 
                className="action-btn secondary-btn"
                onClick={closeTransferDialog}
                disabled={isTransferring}
              >
                Cancel
              </button>
              <button 
                className="action-btn warning-btn"
                onClick={initiateTicketTransfer}
                disabled={!targetDepartment || isTransferring}
              >
                {isTransferring ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Transferring...
                  </>
                ) : (
                  <>
                    <i className="fas fa-exchange-alt"></i>
                    Transfer Ticket
                  </>
                )}
              </button>
            </div>

            {/* ✅ COMPACT QUEUE DISPLAY - Below Buttons */}
            <div className="compact-queue-display">
              <div className="compact-queue-header">
                <h3 className="compact-queue-title">
                  <i className="fas fa-list-ol"></i>
                  Remaining Queue ({ticketQueue.length})
                </h3>
              </div>
              <div className="compact-queue-list">
                {ticketQueue.slice(0, 5).map((ticket, index) => (
                  <div key={ticket._id} className="compact-queue-item">
                    <div className="compact-position">#{index + 1}</div>
                    <div className="compact-ticket-number">{ticket.ticketNumber}</div>
                    <div className="compact-ticket-time">
                      {new Date(ticket.generatedAt).toLocaleTimeString()}
                    </div>
                    <div 
                      className="compact-priority"
                      style={{ backgroundColor: getPriorityDetails(ticket.priority).color }}
                      title={getPriorityDetails(ticket.priority).label}
                    >
                      <i className={`fas ${getPriorityDetails(ticket.priority).icon}`}></i>
                    </div>
                  </div>
                ))}
                {ticketQueue.length === 0 && (
                  <div className="compact-empty-state">
                    <i className="fas fa-check-circle"></i>
                    Queue is empty
                  </div>
                )}
                {ticketQueue.length > 5 && (
                  <div className="compact-more-indicator">
                    <i className="fas fa-ellipsis-h"></i>
                    +{ticketQueue.length - 5} more patients waiting
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="main-content-wrapper counter-panel-wrapper">
        <div className="panel-header-theme counter-panel-header">
          <div className="hospital-branding-theme">
            {hospitalLogoImage ? (
              <img src={hospitalLogoImage} alt="Hospital Logo" className="hospital-logo-img" />
            ) : (
              <div className="hospital-logo-placeholder">
                <i className="fas fa-hospital-alt"></i>
              </div>
            )}
            <div className="hospital-details-theme">
              <h1 className="hospital-title-theme">
                {hospitalTitle}
              </h1>
              <p className="hospital-location-theme">{hospitalLocation}</p>
              {/* <p className="arabic-text-theme">الخدمت رازی ہسپتال اسلام آباد</p> */}
            </div>
          </div>
          
          <div className="header-status-theme">
            <div className="counter-identification">
              <div 
                className="counter-identifier-badge"
                style={{ backgroundColor: mainColor }}
              >
                <i className="fas fa-desktop"></i>
                Counter {counterData.counterNumber}
              </div>
              <div 
                className="status-indicator-theme"
                style={{ backgroundColor: getStatusColorCode(counterData.status) }}
              >
                <i className="fas fa-circle"></i>
                {counterData.status === 'busy' ? 'Serving Patient' : 
                 counterData.status === 'active' ? 'Available' : 
                 counterData.status === 'break' ? 'On Break' : 'Offline'}
              </div>
            </div>
            <div className="current-time-display">
              {lastUpdateTime.toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="system-status-panel">
          <div className="system-status-info">
            <div className="status-info-item">
              <i className="fas fa-broadcast-tower"></i>
              Voice System: <strong>Centralized Dispenser</strong>
            </div>
            <div className="status-info-item">
              <i className="fas fa-network-wired"></i>
              Processing: <strong>Sequential</strong>
            </div>
            <div className="status-info-item">
              <i className={`fas fa-${connectionState === 'connected' ? 'wifi' : 'wifi-slash'}`}></i>
              {connectionState === 'connected' ? 'Live Connected' : 'Offline Mode'}
            </div>
            {(callInProgress || buttonCooldown) && (
              <div className="status-info-item">
                <i className="fas fa-volume-up"></i>
                <strong>Action in Progress...</strong>
              </div>
            )}
          </div>

          <button 
            className="display-action-btn"
            onClick={openWaitingDisplay}
          >
            <i className="fas fa-external-link-alt"></i>
            Open Display
          </button>
        </div>

        <div className="counter-dashboard-panel">
          <div className="dashboard-section-panel current-patient-panel">
            <div className="section-header-panel">
              <h2 className="section-title-text">Current Patient</h2>
              <div className="queue-summary-info">
                <span className="queue-count-badge">{ticketQueue.length} in queue</span>
                <span className="last-update-time">Updated: {lastUpdateTime.toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="current-ticket-display-panel">
              {activeTicket ? (
                <div className="active-ticket-container">
                  <div className="ticket-visual-display">
                    <div className="ticket-number-large-display" style={{ color: highlightColor }}>
                      {activeTicket.ticketNumber}
                    </div>
                    <div className="ticket-status-text">Now Serving</div>
                    <div className="system-notice">
                      <i className="fas fa-info-circle"></i>
                      Voice announcement to centralized dispenser
                    </div>
                  </div>
                  <div className="ticket-details-container">
                    <div className="details-grid-layout">
                      <div className="detail-item-panel">
                        <i className="fas fa-building"></i>
                        <label>Department</label>
                        <span>{activeTicket.department?.name}</span>
                      </div>
                      {activeTicket.patientName && (
                        <div className="detail-item-panel">
                          <i className="fas fa-user"></i>
                          <label>Patient Name</label>
                          <span>{activeTicket.patientName}</span>
                        </div>
                      )}
                      <div className="detail-item-panel">
                        <i className="fas fa-flag"></i>
                        <label>Priority</label>
                        <span 
                          className="priority-indicator-badge"
                          style={{ backgroundColor: getPriorityDetails(activeTicket.priority).color }}
                        >
                          <i className={`fas ${getPriorityDetails(activeTicket.priority).icon}`}></i>
                          {getPriorityDetails(activeTicket.priority).label}
                        </span>
                      </div>
                      <div className="detail-item-panel">
                        <i className="fas fa-clock"></i>
                        <label>Called Time</label>
                        <span>
                          {activeTicket.calledAt ? 
                            new Date(activeTicket.calledAt).toLocaleTimeString() : 
                            'Recently'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-active-ticket">
                  <div className="no-ticket-visual">
                    <i className="fas fa-user-clock"></i>
                  </div>
                  <div className="no-ticket-content">
                    <h3>No Active Patient</h3>
                    <p>Ready to serve next patient from queue</p>
                    <div className="queue-status-info">
                      {ticketQueue.length > 0 
                        ? `${ticketQueue.length} patients waiting in queue` 
                        : 'Queue is currently empty'
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-section-panel control-actions-panel">
            <div className="section-header-panel">
              <h2 className="section-title-text">Quick Actions</h2>
              <div className="system-notice-small">
                <i className="fas fa-info-circle"></i>
                Sequential processing - One call at a time
              </div>
            </div>
            <div className="control-buttons-grid">
              {/* ✅ FIXED: CALL NEXT BUTTON WITH PROPER VALIDATION */}
              <button 
                className={`control-action-btn primary-action ${!isCallNextEnabled() ? 'disabled' : ''}`}
                onClick={callNextInQueue}
                disabled={!isCallNextEnabled()}
              >
                <div className="button-icon-container">
                  {isLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : callInProgress ? (
                    <i className="fas fa-volume-up"></i>
                  ) : (
                    <i className="fas fa-phone"></i>
                  )}
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">
                    {callInProgress ? 'Calling...' : 'Call Next Patient'}
                  </span>
                  <span className="button-subtitle-text">
                    {ticketQueue.length > 0 ? `${ticketQueue.length} waiting` : 'Queue empty'}
                    {(callInProgress || buttonCooldown) && ' - Please wait'}
                  </span>
                </div>
                {ticketQueue.length > 0 && !callInProgress && !buttonCooldown && (
                  <div className="queue-count-indicator">{ticketQueue.length}</div>
                )}
              </button>
              
              {/* ✅ FIXED: RECALL BUTTON WITH PROPER VALIDATION */}
              <button 
                className="control-action-btn accent-action"
                onClick={recallCurrentTicket}
                disabled={!isRecallEnabled()}
              >
                <div className="button-icon-container">
                  {callInProgress ? (
                    <i className="fas fa-volume-up"></i>
                  ) : (
                    <i className="fas fa-redo"></i>
                  )}
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">
                    {callInProgress ? 'Recalling...' : 'Recall Patient'}
                  </span>
                  <span className="button-subtitle-text">
                    {callInProgress ? 'Voice in progress' : 'Voice from centralized dispenser'}
                  </span>
                </div>
              </button>

              <button 
                className="control-action-btn warning-action"
                onClick={openTransferDialog}
                disabled={!activeTicket || isLoading}
              >
                <div className="button-icon-container">
                  <i className="fas fa-exchange-alt"></i>
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">Transfer Ticket</span>
                  <span className="button-subtitle-text">To another department</span>
                </div>
              </button>
              
              <button 
                className="control-action-btn success-action"
                onClick={completeCurrentService}
                disabled={!activeTicket || isLoading}
              >
                <div className="button-icon-container">
                  <i className="fas fa-check-double"></i>
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">Complete Service</span>
                  <span className="button-subtitle-text">Mark as done</span>
                </div>
              </button>

              <button 
                className="control-action-btn secondary-action"
                onClick={refreshCounterData}
                disabled={isLoading}
              >
                <div className="button-icon-container">
                  {isLoading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-sync-alt"></i>
                  )}
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">Refresh Data</span>
                  <span className="button-subtitle-text">Sync with server</span>
                </div>
              </button>

              {/* ✅ ADDED: FULL PAGE RELOAD BUTTON */}
              <button 
                className="control-action-btn info-action"
                onClick={reloadFullPage}
                disabled={isLoading}
              >
                <div className="button-icon-container">
                  <i className="fas fa-redo-alt"></i>
                </div>
                <div className="button-content-area">
                  <span className="button-title-text">Reload Page</span>
                  <span className="button-subtitle-text">Full page refresh</span>
                </div>
              </button>
            </div>

            {/* ✅ ADDED: COMPACT REMAINING QUEUE DISPLAY BELOW BUTTONS */}
            <div className="compact-queue-display">
              <div className="compact-queue-header">
                <h3 className="compact-queue-title">
                  <i className="fas fa-list-ol"></i>
                  Remaining Queue ({ticketQueue.length})
                </h3>
              </div>
              <div className="compact-queue-list">
                {ticketQueue.slice(0, 5).map((ticket, index) => (
                  <div key={ticket._id} className="compact-queue-item">
                    <span className="compact-position">#{index + 1}</span>
                    <span className="compact-ticket-number">{ticket.ticketNumber}</span>
                    <span className="compact-ticket-time">
                      {new Date(ticket.generatedAt).toLocaleTimeString()}
                    </span>
                    <span 
                      className="compact-priority"
                      style={{ backgroundColor: getPriorityDetails(ticket.priority).color }}
                    >
                      <i className={`fas ${getPriorityDetails(ticket.priority).icon}`}></i>
                    </span>
                  </div>
                ))}
                {ticketQueue.length === 0 && (
                  <div className="compact-empty-state">
                    <i className="fas fa-check-circle"></i>
                    <span>No patients waiting</span>
                  </div>
                )}
                {ticketQueue.length > 5 && (
                  <div className="compact-more-indicator">
                    <i className="fas fa-ellipsis-h"></i>
                    <span>+{ticketQueue.length - 5} more patients</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-section-panel data-display-panel">
            <div className="panel-navigation-tabs">
              <button 
                className={`panel-tab-item ${currentView === 'queue' ? 'active-tab' : ''}`}
                onClick={() => setCurrentView('queue')}
              >
                <i className="fas fa-list-ol"></i>
                Waiting Queue ({ticketQueue.length})
              </button>
              <button 
                className={`panel-tab-item ${currentView === 'logs' ? 'active-tab' : ''}`}
                onClick={() => setCurrentView('logs')}
              >
                <i className="fas fa-history"></i>
                Activity Log ({systemLogs.length})
              </button>
            </div>

            <div className="panel-content-area">
              {currentView === 'queue' && (
                <div className="queue-display-panel">
                  <div className="queue-items-list">
                    {ticketQueue.slice(0, 10).map((ticket, index) => (
                      <div key={ticket._id} className="queue-list-item">
                        <div className="queue-position-indicator">
                          #{index + 1}
                        </div>
                        <div className="queue-item-content">
                          <div className="ticket-info-panel">
                            <div className="ticket-number-display" style={{ color:  "#dbe3e8" }}>
                              {ticket.ticketNumber}
                            </div>
                            {ticket.patientName && (
                              <div className="patient-name-display">{ticket.patientName}</div>
                            )}
                            <div className="ticket-timestamp">
                              {new Date(ticket.generatedAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div 
                            className="priority-indicator-small"
                            style={{ backgroundColor: getPriorityDetails(ticket.priority).color }}
                            title={getPriorityDetails(ticket.priority).label}
                          >
                            <i className={`fas ${getPriorityDetails(ticket.priority).icon}`}></i>
                          </div>
                        </div>
                      </div>
                    ))}
                    {ticketQueue.length === 0 && (
                      <div className="empty-state-message">
                        <i className="fas fa-check-circle"></i>
                        <h4>Queue Complete</h4>
                        <p>All patients have been served</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentView === 'logs' && (
                <div className="activity-log-panel">
                  <div className="activity-log-list">
                    {systemLogs.map(log => (
                      <div key={log.id} className={`log-entry-item ${log.type}`}>
                        <div className="log-timestamp">{log.timestamp}</div>
                        <div className="log-content">
                          <div className="log-message">{log.message}</div>
                        </div>
                        <div className={`log-type-icon ${log.type}`}>
                          <i className={`fas ${
                            log.type === 'success' ? 'fa-check-circle' :
                            log.type === 'error' ? 'fa-exclamation-circle' :
                            log.type === 'warning' ? 'fa-exclamation-triangle' :
                            'fa-info-circle'
                          }`}></i>
                        </div>
                      </div>
                    ))}
                    {systemLogs.length === 0 && (
                      <div className="empty-state-message">
                        <i className="fas fa-history"></i>
                        <h4>No Activities</h4>
                        <p>Activities will appear here as you use the system</p>
                      </div>
                    )}
                  </div>
                  {systemLogs.length > 0 && (
                    <div className="panel-footer-section">
                      <button 
                        onClick={() => setSystemLogs([])}
                        className="clear-all-btn"
                      >
                        <i className="fas fa-trash"></i> Clear All
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel-footer-theme counter-panel-footer">
          <div className="footer-content-theme">
            <div className="system-info-theme">
              {hospitalTitle} • Counter {counterData.counterNumber} • Sequential Processing
            </div>
            <div className="system-status-info">
              <span className="status-info-item">
                <i className="fas fa-ticket-alt"></i>
                {counterData.ticketsServedToday || 0} served today
              </span>
              <span className="status-info-item">
                <i className="fas fa-microphone-alt"></i>
                Sequential Call Mode
              </span>
              <span className="status-info-item">
                <i className="fas fa-clock"></i>
                Last refresh: {lastUpdateTime.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterInterfaceRenamed;