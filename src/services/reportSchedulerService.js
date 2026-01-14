/**
 * Report Scheduler Service
 * Handles automated report generation and distribution
 * @module services/reportSchedulerService
 */

const ScheduledReport = require('../models/ScheduledReport');
const ReportTemplate = require('../models/ReportTemplate');
const reportsService = require('./reportsService');
const emailService = require('./emailService');
const { exportToExcel, exportToPDF, exportToCSV } = require('../utils/reportExport');

class ReportSchedulerService {
  /**
   * Calculate next run time based on schedule frequency
   */
  calculateNextRun(scheduledReport) {
    const now = new Date();
    const nextRun = new Date(now);

    switch (scheduledReport.scheduleFrequency) {
      case 'daily':
        const [hours, minutes] = (scheduledReport.scheduleConfig.time || '09:00').split(':');
        nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        const dayOfWeek = scheduledReport.scheduleConfig.dayOfWeek || 1; // Monday
        const [wHours, wMinutes] = (scheduledReport.scheduleConfig.time || '09:00').split(':');
        const currentDay = now.getDay();
        const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7;
        nextRun.setDate(now.getDate() + daysUntilNext);
        nextRun.setHours(parseInt(wHours), parseInt(wMinutes), 0, 0);
        break;

      case 'monthly':
        const dayOfMonth = scheduledReport.scheduleConfig.dayOfMonth || 1;
        const [mHours, mMinutes] = (scheduledReport.scheduleConfig.time || '09:00').split(':');
        nextRun.setDate(dayOfMonth);
        nextRun.setHours(parseInt(mHours), parseInt(mMinutes), 0, 0);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;

      case 'quarterly':
        const quarterMonth = [0, 3, 6, 9][Math.floor(now.getMonth() / 3)];
        const [qHours, qMinutes] = (scheduledReport.scheduleConfig.time || '09:00').split(':');
        nextRun.setMonth(quarterMonth);
        nextRun.setDate(1);
        nextRun.setHours(parseInt(qHours), parseInt(qMinutes), 0, 0);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 3);
        }
        break;

      case 'yearly':
        const [yHours, yMinutes] = (scheduledReport.scheduleConfig.time || '09:00').split(':');
        nextRun.setMonth(0);
        nextRun.setDate(1);
        nextRun.setHours(parseInt(yHours), parseInt(yMinutes), 0, 0);
        if (nextRun <= now) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;

      default:
        return null;
    }

    return nextRun;
  }

  /**
   * Generate and distribute scheduled report
   */
  async generateAndDistributeReport(scheduledReportId) {
    try {
      const scheduledReport = await ScheduledReport.findById(scheduledReportId)
        .populate('reportTemplateId');

      if (!scheduledReport || !scheduledReport.isActive) {
        throw new Error('Scheduled report not found or inactive');
      }

      if (!scheduledReport.reportTemplateId) {
        throw new Error('Report template not found');
      }

      const template = scheduledReport.reportTemplateId;
      const companyId = scheduledReport.companyId || null; // Adjust based on your schema

      // Generate report based on type
      let reportData = null;
      switch (template.reportType) {
        case 'leave':
          if (template.reportName.includes('entitlement')) {
            reportData = await reportsService.generateLeaveEntitlementReport(companyId, scheduledReport.filters);
          } else if (template.reportName.includes('balance')) {
            reportData = await reportsService.generateLeaveBalanceReport(companyId, scheduledReport.filters);
          } else {
            reportData = await reportsService.generateLeaveUtilizationReport(companyId, scheduledReport.filters);
          }
          break;

        case 'attendance':
          if (template.reportName.includes('exception')) {
            reportData = await reportsService.generateAttendanceExceptionReport(companyId, scheduledReport.filters);
          } else {
            reportData = await reportsService.generateAttendanceSummaryReport(companyId, scheduledReport.filters);
          }
          break;

        case 'compliance':
          reportData = await reportsService.generateComplianceStatusReport(companyId, scheduledReport.filters);
          break;

        default:
          throw new Error(`Unsupported report type: ${template.reportType}`);
      }

      // Export report
      let fileUrl = null;
      let fileName = `${template.reportName}-${new Date().toISOString().split('T')[0]}`;

      switch (scheduledReport.exportFormat) {
        case 'excel':
          const excelBuffer = await exportToExcel(reportData.data, template.fields);
          // Save file and get URL (implementation depends on your file storage)
          fileName += '.xlsx';
          // fileUrl = await saveFile(excelBuffer, fileName);
          break;

        case 'pdf':
          const pdfBuffer = await exportToPDF(reportData.data, template);
          fileName += '.pdf';
          // fileUrl = await saveFile(pdfBuffer, fileName);
          break;

        case 'csv':
          const csvContent = await exportToCSV(reportData.data, template.fields);
          fileName += '.csv';
          // fileUrl = await saveFile(csvContent, fileName);
          break;
      }

      // Send emails to recipients
      for (const recipient of scheduledReport.recipients) {
        try {
          await emailService.sendReportEmail({
            to: recipient.email,
            subject: `Scheduled Report: ${template.reportName}`,
            reportName: template.reportName,
            reportData: reportData,
            fileUrl: fileUrl,
            fileName: fileName
          });
        } catch (emailError) {
          console.error(`Failed to send report to ${recipient.email}:`, emailError);
        }
      }

      // Update scheduled report
      scheduledReport.lastRunAt = new Date();
      scheduledReport.lastRunStatus = 'success';
      scheduledReport.lastRunFileUrl = fileUrl;
      scheduledReport.runCount++;
      scheduledReport.successCount++;
      scheduledReport.nextRunAt = this.calculateNextRun(scheduledReport);
      await scheduledReport.save();

      return {
        success: true,
        message: 'Report generated and distributed successfully',
        fileUrl: fileUrl,
        recipients: scheduledReport.recipients.length
      };
    } catch (error) {
      // Update scheduled report with error
      const scheduledReport = await ScheduledReport.findById(scheduledReportId);
      if (scheduledReport) {
        scheduledReport.lastRunAt = new Date();
        scheduledReport.lastRunStatus = 'failed';
        scheduledReport.lastRunError = error.message;
        scheduledReport.runCount++;
        scheduledReport.failureCount++;
        scheduledReport.nextRunAt = this.calculateNextRun(scheduledReport);
        await scheduledReport.save();
      }

      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Process all due scheduled reports
   */
  async processDueReports() {
    try {
      const now = new Date();
      const dueReports = await ScheduledReport.find({
        isActive: true,
        nextRunAt: { $lte: now }
      }).populate('reportTemplateId');

      const results = {
        total: dueReports.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const report of dueReports) {
        try {
          await this.generateAndDistributeReport(report._id);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            reportId: report._id,
            reportName: report.reportName,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to process due reports: ${error.message}`);
    }
  }
}

module.exports = new ReportSchedulerService();


