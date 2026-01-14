const Holiday = require('../models/Holiday');

/**
 * Holiday Controller
 * Handles holiday calendar management with location-specific filtering
 * @module controllers/holidayController
 */

/**
 * Get all holidays
 */
exports.getHolidays = async (req, res) => {
  try {
    const { year, location, department, type, isActive } = req.query;

    const query = {};
    
    if (year) {
      query.year = parseInt(year);
    } else {
      query.year = new Date().getFullYear();
    }

    if (location) {
      query.$or = [
        { applicableTo: 'all' },
        { locations: { $in: [location] } }
      ];
    }

    if (department) {
      query.$or = [
        { applicableTo: 'all' },
        { applicableTo: 'specific-departments', departments: department }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const holidays = await Holiday.find(query)
      .populate('departments', 'name')
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single holiday
 */
exports.getHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id)
      .populate('departments', 'name');

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    res.status(200).json({
      success: true,
      data: holiday
    });
  } catch (error) {
    console.error('Error fetching holiday:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create holiday
 */
exports.createHoliday = async (req, res) => {
  try {
    const {
      name,
      date,
      type,
      description,
      applicableTo,
      departments,
      locations,
      isRecurring,
      year
    } = req.body;

    if (!name || !date) {
      return res.status(400).json({
        success: false,
        message: 'Holiday name and date are required'
      });
    }

    const holidayDate = new Date(date);
    const holidayYear = year || holidayDate.getFullYear();

    const holiday = new Holiday({
      name,
      date: holidayDate,
      type: type || 'public',
      description,
      applicableTo: applicableTo || 'all',
      departments: departments || [],
      locations: locations || [],
      isRecurring: isRecurring || false,
      year: holidayYear
    });

    await holiday.save();

    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: holiday
    });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update holiday
 */
exports.updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('departments', 'name');

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete holiday
 */
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get holidays by location
 */
exports.getHolidaysByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { year } = req.query;

    const query = {
      $or: [
        { applicableTo: 'all' },
        { locations: { $in: [location] } }
      ],
      isActive: true
    };

    if (year) {
      query.year = parseInt(year);
    } else {
      query.year = new Date().getFullYear();
    }

    const holidays = await Holiday.find(query)
      .populate('departments', 'name')
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    console.error('Error fetching holidays by location:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Bulk create holidays
 */
exports.bulkCreateHolidays = async (req, res) => {
  try {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Holidays array is required'
      });
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < holidays.length; i++) {
      const holidayData = holidays[i];
      try {
        if (!holidayData.name || !holidayData.date) {
          results.errors.push({
            index: i,
            error: 'Name and date are required'
          });
          continue;
        }

        const holidayDate = new Date(holidayData.date);
        const holidayYear = holidayData.year || holidayDate.getFullYear();

        const holiday = new Holiday({
          name: holidayData.name,
          date: holidayDate,
          type: holidayData.type || 'public',
          description: holidayData.description,
          applicableTo: holidayData.applicableTo || 'all',
          departments: holidayData.departments || [],
          locations: holidayData.locations || [],
          isRecurring: holidayData.isRecurring || false,
          year: holidayYear
        });

        await holiday.save();
        results.success.push({
          index: i,
          holiday: holiday.name,
          date: holiday.date
        });
      } catch (error) {
        results.errors.push({
          index: i,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${holidays.length} holidays. ${results.success.length} successful, ${results.errors.length} errors`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk create holidays:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


