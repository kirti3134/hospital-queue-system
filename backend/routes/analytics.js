const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const moment = require('moment');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalWaiting,
      servedToday,
      totalTicketsToday,
      activeCounters
    ] = await Promise.all([
      Ticket.countDocuments({ status: 'waiting' }),
      Ticket.countDocuments({ 
        status: 'completed',
        servedAt: { $gte: todayStart, $lte: todayEnd }
      }),
      Ticket.countDocuments({
        generatedAt: { $gte: todayStart, $lte: todayEnd }
      }),
      Counter.countDocuments({ status: 'active' })
    ]);

    // Calculate average wait time (simplified)
    const completedTickets = await Ticket.find({
      status: 'completed',
      servedAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    const totalWaitTime = completedTickets.reduce((total, ticket) => {
      const waitTime = (new Date(ticket.servedAt) - new Date(ticket.generatedAt)) / (1000 * 60);
      return total + waitTime;
    }, 0);
    
    const avgWaitTime = completedTickets.length > 0 
      ? Math.round(totalWaitTime / completedTickets.length)
      : 0;

    res.json({
      totalWaiting,
      servedToday,
      totalTicketsToday,
      activeCounters,
      avgWaitTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get department analytics
router.get('/departments', async (req, res) => {
  try {
    const departments = await Department.find();
    
    const departmentAnalytics = await Promise.all(
      departments.map(async (dept) => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const waitingCount = await Ticket.countDocuments({
          department: dept._id,
          status: 'waiting'
        });
        
        const servedToday = await Ticket.countDocuments({
          department: dept._id,
          status: 'completed',
          servedAt: { $gte: todayStart }
        });

        const avgWaitTime = dept.estimatedWaitTime; // Simplified

        return {
          ...dept.toObject(),
          waitingCount,
          servedToday,
          avgWaitTime
        };
      })
    );

    res.json(departmentAnalytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced report generation (FIXED: Removed duplicate route)
router.post('/reports', async (req, res) => {
  try {
    const { startDate, endDate, department, reportType } = req.body;
    
    // Calculate date range based on report type
    let start, end;
    const today = new Date();
    
    switch (reportType) {
      case 'daily':
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      case 'weekly':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = new Date(today);
        break;
      case 'monthly':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        end = new Date(today);
        break;
      default:
        start = new Date(startDate);
        end = new Date(endDate);
    }
    
    end.setHours(23, 59, 59, 999);

    // Build match query
    const matchQuery = {
      generatedAt: { $gte: start, $lte: end }
    };

    if (department && department !== 'all') {
      matchQuery.department = department;
    }

    // Get ticket statistics
    const tickets = await Ticket.find(matchQuery)
      .populate('department')
      .populate('assignedCounter');

    // Calculate summary statistics
    const totalPatients = tickets.length;
    const servedPatients = tickets.filter(t => t.status === 'completed').length;
    
    const completedTickets = tickets.filter(t => t.status === 'completed');
    const totalWaitTime = completedTickets.reduce((total, ticket) => {
      if (ticket.calledAt && ticket.generatedAt) {
        const waitTime = (new Date(ticket.calledAt) - new Date(ticket.generatedAt)) / (1000 * 60);
        return total + waitTime;
      }
      return total;
    }, 0);
    
    const averageWaitTime = completedTickets.length > 0 
      ? Math.round(totalWaitTime / completedTickets.length)
      : 0;

    const efficiency = totalPatients > 0 
      ? Math.round((servedPatients / totalPatients) * 100)
      : 0;

    // Department statistics
    const departmentStats = await Department.find();
    const deptStatsWithData = await Promise.all(
      departmentStats.map(async (dept) => {
        const deptTickets = tickets.filter(t => t.department?._id.toString() === dept._id.toString());
        const served = deptTickets.filter(t => t.status === 'completed').length;
        const avgWait = dept.estimatedWaitTime; // Simplified
        
        return {
          name: dept.name,
          served: served,
          avgWait: avgWait,
          efficiency: deptTickets.length > 0 ? Math.round((served / deptTickets.length) * 100) : 0
        };
      })
    );

    // Hourly distribution
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const hourTickets = tickets.filter(ticket => {
        const ticketHour = new Date(ticket.generatedAt).getHours();
        return ticketHour === hour;
      });
      return {
        hour: hour,
        count: hourTickets.length
      };
    });

    // Priority breakdown
    const priorityCounts = {};
    tickets.forEach(ticket => {
      priorityCounts[ticket.priority] = (priorityCounts[ticket.priority] || 0) + 1;
    });

    const priorityBreakdown = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      count: count,
      percentage: Math.round((count / totalPatients) * 100)
    }));

    const reportData = {
      summary: {
        totalPatients,
        servedPatients,
        averageWaitTime,
        averageServiceTime: Math.round(averageWaitTime * 0.7), // Simplified
        efficiency
      },
      departmentStats: deptStatsWithData,
      hourlyDistribution,
      priorityBreakdown,
      generatedAt: new Date(),
      dateRange: { start, end }
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;