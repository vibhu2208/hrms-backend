const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const SubscriptionLog = require('../models/SubscriptionLog');
const Client = require('../models/Client');
const Package = require('../models/Package');

// Get comprehensive revenue dashboard data
const getRevenueDashboard = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const currentDate = new Date();
    let startDate, endDate;
    
    // Calculate date range based on period
    switch (period) {
      case 'week':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
        endDate = currentDate;
        break;
      case 'month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarterStart = Math.floor(currentDate.getMonth() / 3) * 3;
        startDate = new Date(currentDate.getFullYear(), quarterStart, 1);
        endDate = new Date(currentDate.getFullYear(), quarterStart + 3, 0);
        break;
      case 'year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    // Get revenue overview
    const revenueOverview = await getRevenueOverview(startDate, endDate);
    
    // Get revenue trends
    const revenueTrends = await getRevenueTrends(period);
    
    // Get package performance
    const packagePerformance = await getPackagePerformance(startDate, endDate);
    
    // Get client revenue breakdown
    const clientRevenue = await getClientRevenueBreakdown(startDate, endDate);
    
    // Get payment method stats
    const paymentMethodStats = await getPaymentMethodBreakdown(startDate, endDate);
    
    // Get upcoming renewals
    const upcomingRenewals = await getUpcomingRenewals();
    
    // Get overdue invoices summary
    const overdueInvoices = await getOverdueInvoicesSummary();

    res.status(200).json({
      success: true,
      data: {
        overview: revenueOverview,
        trends: revenueTrends,
        packagePerformance,
        clientRevenue,
        paymentMethodStats,
        upcomingRenewals,
        overdueInvoices,
        period: {
          type: period,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching revenue dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue dashboard',
      error: error.message
    });
  }
};

// Get revenue overview for a specific period
const getRevenueOverview = async (startDate, endDate) => {
  try {
    // Current period revenue
    const currentRevenue = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$paidAmount' },
          totalInvoices: { $sum: 1 },
          averageInvoiceValue: { $avg: '$amount.total' }
        }
      }
    ]);

    // Previous period for comparison
    const periodDiff = endDate - startDate;
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const previousRevenue = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: prevStartDate, $lte: prevEndDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$paidAmount' },
          totalInvoices: { $sum: 1 }
        }
      }
    ]);

    const current = currentRevenue[0] || { totalRevenue: 0, totalInvoices: 0, averageInvoiceValue: 0 };
    const previous = previousRevenue[0] || { totalRevenue: 0, totalInvoices: 0 };

    // Calculate growth percentages
    const revenueGrowth = previous.totalRevenue > 0 
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 
      : 0;
    
    const invoiceGrowth = previous.totalInvoices > 0 
      ? ((current.totalInvoices - previous.totalInvoices) / previous.totalInvoices) * 100 
      : 0;

    // Get active subscriptions count
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    
    // Get pending payments
    const pendingPayments = await Invoice.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['pending', 'partial'] },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: { $subtract: ['$amount.total', '$paidAmount'] } },
          count: { $sum: 1 }
        }
      }
    ]);

    const pending = pendingPayments[0] || { totalPending: 0, count: 0 };

    return {
      totalRevenue: current.totalRevenue,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      totalInvoices: current.totalInvoices,
      invoiceGrowth: Math.round(invoiceGrowth * 100) / 100,
      averageInvoiceValue: Math.round(current.averageInvoiceValue * 100) / 100,
      activeSubscriptions,
      pendingRevenue: pending.totalPending,
      pendingInvoices: pending.count
    };
  } catch (error) {
    console.error('Error getting revenue overview:', error);
    throw error;
  }
};

// Get revenue trends over time
const getRevenueTrends = async (period) => {
  try {
    let groupBy, dateRange;
    const currentDate = new Date();

    switch (period) {
      case 'week':
        groupBy = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' },
          day: { $dayOfMonth: '$paidDate' }
        };
        dateRange = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        break;
      case 'month':
        groupBy = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' },
          day: { $dayOfMonth: '$paidDate' }
        };
        dateRange = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1); // Last 12 months by day
        break;
      case 'quarter':
      case 'year':
        groupBy = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' }
        };
        dateRange = new Date(currentDate.getFullYear() - 2, 0, 1); // Last 2 years by month
        break;
      default:
        groupBy = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' }
        };
        dateRange = new Date(currentDate.getFullYear(), 0, 1);
    }

    const trends = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$paidAmount' },
          invoices: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    return trends;
  } catch (error) {
    console.error('Error getting revenue trends:', error);
    throw error;
  }
};

// Get package performance analytics
const getPackagePerformance = async (startDate, endDate) => {
  try {
    const packageStats = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'packages',
          localField: 'packageId',
          foreignField: '_id',
          as: 'package'
        }
      },
      {
        $unwind: '$package'
      },
      {
        $group: {
          _id: '$packageId',
          packageName: { $first: '$package.name' },
          packageType: { $first: '$package.type' },
          totalRevenue: { $sum: '$paidAmount' },
          totalInvoices: { $sum: 1 },
          averageRevenue: { $avg: '$paidAmount' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    // Get active subscriptions by package
    const activeSubscriptions = await Subscription.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $lookup: {
          from: 'packages',
          localField: 'packageId',
          foreignField: '_id',
          as: 'package'
        }
      },
      {
        $unwind: '$package'
      },
      {
        $group: {
          _id: '$packageId',
          packageName: { $first: '$package.name' },
          activeCount: { $sum: 1 },
          totalMRR: { $sum: '$basePrice' } // Assuming monthly recurring revenue
        }
      }
    ]);

    // Combine the data
    const combined = packageStats.map(pkg => {
      const activeSub = activeSubscriptions.find(sub => sub._id.toString() === pkg._id.toString());
      return {
        ...pkg,
        activeSubscriptions: activeSub?.activeCount || 0,
        monthlyRecurringRevenue: activeSub?.totalMRR || 0
      };
    });

    return combined;
  } catch (error) {
    console.error('Error getting package performance:', error);
    throw error;
  }
};

// Get client revenue breakdown
const getClientRevenueBreakdown = async (startDate, endDate) => {
  try {
    const clientRevenue = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      {
        $unwind: '$client'
      },
      {
        $group: {
          _id: '$clientId',
          clientName: { $first: '$client.companyName' },
          totalRevenue: { $sum: '$paidAmount' },
          totalInvoices: { $sum: 1 },
          averageInvoiceValue: { $avg: '$amount.total' },
          lastPayment: { $max: '$paidDate' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 20 // Top 20 clients
      }
    ]);

    return clientRevenue;
  } catch (error) {
    console.error('Error getting client revenue breakdown:', error);
    throw error;
  }
};

// Get payment method breakdown
const getPaymentMethodBreakdown = async (startDate, endDate) => {
  try {
    const paymentMethods = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    return paymentMethods;
  } catch (error) {
    console.error('Error getting payment method breakdown:', error);
    throw error;
  }
};

// Get upcoming renewals
const getUpcomingRenewals = async () => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingRenewals = await Subscription.find({
      status: 'active',
      endDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
    })
    .populate('clientId', 'name companyName email')
    .populate('packageId', 'name type pricing')
    .sort({ endDate: 1 })
    .limit(10);

    const renewalStats = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          endDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$basePrice' },
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      renewals: upcomingRenewals,
      summary: renewalStats[0] || { totalValue: 0, count: 0 }
    };
  } catch (error) {
    console.error('Error getting upcoming renewals:', error);
    throw error;
  }
};

// Get overdue invoices summary
const getOverdueInvoicesSummary = async () => {
  try {
    const overdueInvoices = await Invoice.aggregate([
      {
        $match: {
          status: { $nin: ['paid', 'cancelled'] },
          dueDate: { $lt: new Date() }
        }
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: { $subtract: ['$amount.total', '$paidAmount'] } },
          count: { $sum: 1 },
          averageOverdueAmount: { $avg: { $subtract: ['$amount.total', '$paidAmount'] } }
        }
      }
    ]);

    // Get overdue by age ranges
    const overdueByAge = await Invoice.aggregate([
      {
        $match: {
          status: { $nin: ['paid', 'cancelled'] },
          dueDate: { $lt: new Date() }
        }
      },
      {
        $addFields: {
          daysOverdue: {
            $divide: [
              { $subtract: [new Date(), '$dueDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$daysOverdue',
          boundaries: [0, 30, 60, 90, 365],
          default: '365+',
          output: {
            count: { $sum: 1 },
            totalAmount: { $sum: { $subtract: ['$amount.total', '$paidAmount'] } }
          }
        }
      }
    ]);

    return {
      summary: overdueInvoices[0] || { totalOverdue: 0, count: 0, averageOverdueAmount: 0 },
      byAge: overdueByAge
    };
  } catch (error) {
    console.error('Error getting overdue invoices summary:', error);
    throw error;
  }
};

// Get detailed revenue report
const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month', includeDetails = false } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Revenue by time period
    let groupByStage;
    switch (groupBy) {
      case 'day':
        groupByStage = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' },
          day: { $dayOfMonth: '$paidDate' }
        };
        break;
      case 'week':
        groupByStage = {
          year: { $year: '$paidDate' },
          week: { $week: '$paidDate' }
        };
        break;
      case 'month':
        groupByStage = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' }
        };
        break;
      case 'quarter':
        groupByStage = {
          year: { $year: '$paidDate' },
          quarter: {
            $ceil: { $divide: [{ $month: '$paidDate' }, 3] }
          }
        };
        break;
      case 'year':
        groupByStage = {
          year: { $year: '$paidDate' }
        };
        break;
      default:
        groupByStage = {
          year: { $year: '$paidDate' },
          month: { $month: '$paidDate' }
        };
    }

    const revenueByPeriod = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: groupByStage,
          revenue: { $sum: '$paidAmount' },
          invoices: { $sum: 1 },
          averageInvoiceValue: { $avg: '$amount.total' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1, '_id.quarter': 1 }
      }
    ]);

    let detailedData = {};
    if (includeDetails === 'true') {
      // Get package breakdown
      const packageBreakdown = await getPackagePerformance(start, end);
      
      // Get client breakdown
      const clientBreakdown = await getClientRevenueBreakdown(start, end);
      
      // Get payment method breakdown
      const paymentMethodBreakdown = await getPaymentMethodBreakdown(start, end);

      detailedData = {
        packageBreakdown,
        clientBreakdown,
        paymentMethodBreakdown
      };
    }

    res.status(200).json({
      success: true,
      data: {
        revenueByPeriod,
        ...detailedData,
        period: {
          startDate: start,
          endDate: end,
          groupBy
        }
      }
    });
  } catch (error) {
    console.error('Error generating revenue report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating revenue report',
      error: error.message
    });
  }
};

// Get subscription analytics
const getSubscriptionAnalytics = async (req, res) => {
  try {
    // Subscription status breakdown
    const statusBreakdown = await Subscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalRevenue' }
        }
      }
    ]);

    // Billing cycle breakdown
    const billingCycleBreakdown = await Subscription.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: '$billingCycle',
          count: { $sum: 1 },
          totalMRR: { $sum: '$basePrice' }
        }
      }
    ]);

    // Churn analysis (subscriptions cancelled in last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const churnAnalysis = await SubscriptionLog.aggregate([
      {
        $match: {
          action: 'cancelled',
          timestamp: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' }
          },
          churnedSubscriptions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Renewal rate analysis
    const renewalAnalysis = await SubscriptionLog.aggregate([
      {
        $match: {
          action: { $in: ['renewed', 'cancelled'] },
          timestamp: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    const renewed = renewalAnalysis.find(r => r._id === 'renewed')?.count || 0;
    const cancelled = renewalAnalysis.find(r => r._id === 'cancelled')?.count || 0;
    const renewalRate = (renewed + cancelled) > 0 ? (renewed / (renewed + cancelled)) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        statusBreakdown,
        billingCycleBreakdown,
        churnAnalysis,
        renewalRate: Math.round(renewalRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error getting subscription analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting subscription analytics',
      error: error.message
    });
  }
};

module.exports = {
  getRevenueDashboard,
  getRevenueReport,
  getSubscriptionAnalytics
};
