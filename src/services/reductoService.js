const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Local Resume Parser - Fallback when external APIs are unavailable
 */
class LocalResumeParser {
  constructor() {
    this.pdfParse = null;
    this.mammoth = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.pdfParse = require('pdf-parse');
    } catch (error) {
      console.warn('pdf-parse not available for local parsing');
    }

    try {
      this.mammoth = require('mammoth');
    } catch (error) {
      console.warn('mammoth not available for local parsing');
    }

    this.initialized = true;
  }

  async parseFile(filePath) {
    await this.initialize();
    const extension = path.extname(filePath).toLowerCase();

    let text = '';

    if (extension === '.pdf' && this.pdfParse) {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await this.pdfParse(dataBuffer);
        text = data.text;
      } catch (error) {
        console.error('Local PDF parsing failed:', error.message);
        text = 'PDF parsing failed';
      }
    } else if ((extension === '.docx' || extension === '.doc') && this.mammoth) {
      try {
        const result = await this.mammoth.extractRawText({ path: filePath });
        text = result.value;
      } catch (error) {
        console.error('Local DOCX parsing failed:', error.message);
        text = 'DOCX parsing failed';
      }
    } else {
      text = `File type ${extension} not supported for local parsing`;
    }

    return text;
  }

  /**
   * Split resume into logical sections for targeted extraction
   */
  splitSections(text) {
    const sections = {};
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let currentSection = 'header';
    sections[currentSection] = [];

    for (const line of lines) {
      const clean = line.toLowerCase();

      // Section detection patterns (expanded)
      if (/^(summary|profile|about|objective|professional summary|career summary)/.test(clean)) {
        currentSection = 'summary';
      } else if (/^(skills|technical skills|technologies|competencies|expertise|technical expertise|core competencies|key skills|programming skills)/.test(clean)) {
        currentSection = 'skills';
      } else if (/^(experience|work experience|employment|professional experience|career history|work history|employment history)/.test(clean)) {
        currentSection = 'experience';
      } else if (/^(education|qualification|academic|degrees|certifications|educational background)/.test(clean)) {
        currentSection = 'education';
      } else if (/^(projects|key projects|portfolio|project experience)/.test(clean)) {
        currentSection = 'projects';
      } else if (/^(contact|personal information|address|personal details)/.test(clean)) {
        currentSection = 'contact';
      }

      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }

    // Convert arrays back to text
    Object.keys(sections).forEach(key => {
      sections[key] = sections[key].join('\n');
    });

    return sections;
  }

  /**
   * Extract name from header section with better accuracy
   */
  extractName(sections, emails, phones) {
    const headerLines = sections.header.split('\n').slice(0, 6);

    for (const line of headerLines) {
      // Skip lines that look like emails, phones, or addresses
      if (emails.some(email => line.includes(email)) ||
          phones.some(phone => line.includes(phone.replace(/[^\d]/g, ''))) ||
          /\d{6}/.test(line) || // Pincode
          /(road|street|city|state|country)/i.test(line) ||
          line.length > 60) {
        continue;
      }

      // Look for 2-3 word names with proper capitalization
      const words = line.split(/\s+/).filter(word =>
        word.length >= 2 &&
        word.length <= 20 &&
        /^[A-Za-z]{2,}(?:-[A-Za-z]+)*$/.test(word) // Allow hyphens
      );

      if (words.length >= 2 && words.length <= 4) {
        return {
          firstName: words[0],
          lastName: words.slice(1).join(' ')
        };
      }
    }

    return { firstName: null, lastName: null };
  }

  /**
   * Extract applied for position/job title
   */
  extractAppliedFor(text) {
    const patterns = [
      /applied for[\s:]+([^\n\r,.]{3,50})/i,
      /position[\s:]+([^\n\r,.]{3,50})/i,
      /role[\s:]+([^\n\r,.]{3,50})/i,
      /applying for[\s:]+([^\n\r,.]{3,50})/i,
      /job title[\s:]+([^\n\r,.]{3,50})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 2) {
        return match[1].trim();
      }
    }

    // Fallback: Look for common job titles in the first few lines
    const commonTitles = [
      'software engineer', 'developer', 'backend engineer', 'frontend developer',
      'full stack developer', 'devops engineer', 'data scientist', 'product manager',
      'senior software engineer', 'software developer', 'web developer',
      'mobile app developer', 'ui/ux designer', 'data analyst'
    ];

    const firstLines = text.split('\n').slice(0, 10).join(' ').toLowerCase();
    for (const title of commonTitles) {
      if (firstLines.includes(title)) {
        return title.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
    }

    return null;
  }

  /**
   * Extract experience using date calculations (much more accurate)
   */
  extractExperienceFromDates(text) {
    // Month abbreviations for parsing
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };

    // Enhanced date pattern to handle various formats
    const datePattern = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[a-z]*\.?\s+(\d{1,2})?,?\s+(\d{4}))\s*[-–to]+\s*(present|current|now|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[a-z]*\.?\s+(\d{1,2})?,?\s+(\d{4}))/gi;

    let totalMonths = 0;
    let match;

    while ((match = datePattern.exec(text)) !== null) {
      try {
        const startMonthStr = match[1].toLowerCase().split(/\s+/)[0].replace('.', '');
        const startYear = parseInt(match[3]);

        let endDate;
        if (match[4].toLowerCase() === 'present' || match[4].toLowerCase() === 'current' || match[4].toLowerCase() === 'now') {
          endDate = new Date();
        } else {
          const endMonthStr = match[5].toLowerCase().split(/\s+/)[0].replace('.', '');
          const endYear = parseInt(match[7]);
          const endMonth = monthMap[endMonthStr];
          endDate = new Date(endYear, endMonth || 0);
        }

        const startMonth = monthMap[startMonthStr];
        const startDate = new Date(startYear, startMonth || 0);

        // Calculate months between dates
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());

        if (months > 0 && months < 600) { // Reasonable limit (50 years)
          totalMonths += months;
        }
      } catch (error) {
        console.warn('Error parsing date range:', match[0], error.message);
      }
    }

    if (totalMonths > 0) {
      return {
        experienceYears: Math.floor(totalMonths / 12),
        experienceMonths: totalMonths % 12
      };
    }

    return { experienceYears: null, experienceMonths: null };
  }

  /**
   * Extract current company and designation from experience section
   */
  extractCurrentRole(sections) {
    const experienceText = sections.experience || '';
    const fullText = (sections.summary || '') + '\n' + experienceText;
    const lines = experienceText.split('\n').filter(line => line.trim().length > 0);

    // Method 1: Look for explicit current/present indicators with better context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      if (/(present|current|till date|ongoing|now|today|till now)/.test(line) ||
          /\b(2023|2024)\s*-\s*(present|current|now|till date)/i.test(line)) {

        let designation = null;
        let company = null;

        // Look backwards for designation and company
        const contextLines = [];
        for (let j = Math.max(0, i - 6); j < Math.min(lines.length, i + 3); j++) {
          if (j !== i) contextLines.push(lines[j].trim());
        }

        // Extract from context
        const result = this.extractRoleFromContext(contextLines);
        if (result.company || result.designation) {
          return result;
        }
      }
    }

    // Method 2: Analyze first meaningful experience block (most recent role)
    if (lines.length > 0) {
      const experienceBlocks = this.splitIntoExperienceBlocks(experienceText);

      for (const block of experienceBlocks.slice(0, 2)) { // Check first 2 blocks (most recent)
        const result = this.extractRoleFromBlock(block);
        if (result.company) {
          return result;
        }
      }
    }

    // Method 3: Look for company mentions with specific keywords
    const companyKeywords = ['at', '@', 'with', 'company', 'organization', 'firm'];
    for (const keyword of companyKeywords) {
      const pattern = new RegExp(`${keyword}\\s*[:\\-\\s]*([^\\n\\r,.]{3,60})`, 'gi');
      const matches = experienceText.match(pattern);

      if (matches && matches.length > 0) {
        const company = this.validateAndCleanCompany(matches[0].replace(new RegExp(`${keyword}\\s*[:\\-\\s]*`, 'i'), '').trim());
        if (company) {
          return { currentCompany: company, currentDesignation: null };
        }
      }
    }

    // Method 4: Look in summary/profile section for current company
    if (sections.summary) {
      const summaryLines = sections.summary.split('\n').filter(line => line.trim().length > 0);

      for (const line of summaryLines.slice(0, 5)) { // Check first 5 lines of summary
        if (/(work|working|currently|present|at|@)/i.test(line)) {
          const company = this.extractCompanyFromLine(line);
          if (company) {
            return { currentCompany: company, currentDesignation: null };
          }
        }
      }
    }

    // Method 5: Last resort - look for any company-like pattern in first few lines
    if (lines.length > 0) {
      for (const line of lines.slice(0, 8)) {
        if (!this.isDateLine(line) && !/(experience|professional|skills|education|qualification)/i.test(line)) {
          const company = this.extractCompanyFromLine(line);
          if (company) {
            return { currentCompany: company, currentDesignation: null };
          }
        }
      }
    }

    return { currentCompany: null, currentDesignation: null };
  }

  // Split experience section into logical blocks (usually separated by dates or blank lines)
  splitIntoExperienceBlocks(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const blocks = [];
    let currentBlock = [];

    for (const line of lines) {
      if (this.isDateLine(line) && currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [line];
      } else if (line.trim() === '' && currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  // Extract role information from a block of text
  extractRoleFromBlock(blockLines) {
    let designation = null;
    let company = null;

    for (const line of blockLines) {
      const trimmed = line.trim();

      // Skip date lines and irrelevant content
      if (this.isDateLine(trimmed) ||
          /(experience|professional|skills|education|project)/i.test(trimmed)) {
        continue;
      }

      // Try to extract company first
      const companyCandidate = this.extractCompanyFromLine(trimmed);
      if (companyCandidate && !company) {
        company = companyCandidate;
        continue;
      }

      // If we don't have designation yet, check if this could be a designation
      if (!designation && trimmed.length > 3 && trimmed.length < 60) {
        if (!this.looksLikeCompany(trimmed) &&
            !/(at|@|with|company|organization|firm)/i.test(trimmed)) {
          designation = trimmed;
        }
      }
    }

    return { currentCompany: company, currentDesignation: designation };
  }

  // Extract from context lines around current/present indicators
  extractRoleFromContext(contextLines) {
    let designation = null;
    let company = null;

    for (const line of contextLines) {
      const companyCandidate = this.extractCompanyFromLine(line);
      if (companyCandidate && !company) {
        company = companyCandidate;
      } else if (!designation && line.length > 3 && line.length < 60 &&
                 !this.isDateLine(line) && !this.looksLikeCompany(line)) {
        designation = line;
      }
    }

    return { currentCompany: company, currentDesignation: designation };
  }

  // Helper method to check if a line looks like a date
  isDateLine(line) {
    return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\b.*\d{4}|\d{4}.*\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(line);
  }

  // Helper method to extract company from a line
  extractCompanyFromLine(line) {
    // Skip lines that are clearly not companies
    if (this.isDateLine(line) ||
        /(present|current|till date|ongoing|now|experience|professional|skills|education|qualification|project)/i.test(line)) {
      return null;
    }

    const trimmed = line.trim();

    // Method 1: Look for company after keywords
    const keywordPatterns = [
      /(?:at|@|with|company|organization|firm|employer)[\s:]*([^,\n\r]{3,60})/i,
      /(?:working|worked|employed)[\s]*(?:at|with|for|in)[\s:]*([^,\n\r]{3,60})/i
    ];

    for (const pattern of keywordPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const company = this.validateAndCleanCompany(match[1].trim());
        if (company) return company;
      }
    }

    // Method 2: Look for known company suffixes and patterns
    const suffixPatterns = [
      /\b([A-Z][a-zA-Z\s&]+(?:Ltd\.?|Inc\.?|Corp\.?|Corporation|LLC|GmbH|Pvt\.?\s*Ltd|Pvt|Pvt\.|Private\s*Limited|Limited|Company|Technologies|Systems|Solutions|Services|Group|Industries|Labs|Software|Consulting|IT\s*Services|IT\s*Solutions))\b/i,
      /\b([A-Z][a-zA-Z\s&]+(?:Technologies|Systems|Solutions|Services|Software|Consulting|Labs|Group|Industries))\b/i
    ];

    for (const pattern of suffixPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1] && this.isValidCompanyName(match[1].trim())) {
        return this.validateAndCleanCompany(match[1].trim());
      }
    }

    // Method 3: Well-known tech and major companies
    const knownCompanies = [
      'Google', 'Microsoft', 'Amazon', 'Facebook', 'Meta', 'Apple', 'Netflix', 'Uber', 'Airbnb',
      'TCS', 'Infosys', 'Wipro', 'Accenture', 'Deloitte', 'IBM', 'Oracle', 'SAP', 'Adobe',
      'Salesforce', 'Cisco', 'Intel', 'AMD', 'NVIDIA', 'Qualcomm', 'HCL', 'Tech Mahindra',
      'Cognizant', 'Capgemini', 'Mindtree', 'Hexaware', 'Persistent', 'Mphasis', 'L&T Infotech'
    ];

    for (const company of knownCompanies) {
      if (new RegExp(`\\b${company}\\b`, 'i').test(trimmed)) {
        return company;
      }
    }

    // Method 4: Conservative pattern for proper company names (must have business-like terms)
    if (trimmed.length > 3 && trimmed.length < 50) {
      // Look for patterns that suggest business entities
      const businessPatterns = [
        /\b([A-Z][a-zA-Z\s&]{2,}(?:[A-Z][a-zA-Z\s&]*)*)\b/
      ];

      for (const pattern of businessPatterns) {
        const match = trimmed.match(pattern);
        if (match && match[1] && this.isValidCompanyName(match[1].trim())) {
          return this.validateAndCleanCompany(match[1].trim());
        }
      }
    }

    return null;
  }

  // Validate if a string looks like a valid company name
  isValidCompanyName(name) {
    if (!name || name.length < 2 || name.length > 50) return false;

    // Reject if it looks like a designation/title
    const designationWords = ['engineer', 'developer', 'manager', 'analyst', 'consultant', 'architect',
                             'specialist', 'lead', 'senior', 'junior', 'associate', 'director', 'vp',
                             'head', 'chief', 'officer', 'coordinator', 'administrator'];

    const lowerName = name.toLowerCase();
    if (designationWords.some(word => lowerName.includes(word))) {
      return false;
    }

    // Reject if it looks like a location
    const locationWords = ['university', 'college', 'school', 'institute', 'academy', 'pune', 'mumbai',
                          'delhi', 'bangalore', 'chennai', 'hyderabad', 'noida', 'gurgaon'];

    if (locationWords.some(word => lowerName.includes(word))) {
      return false;
    }

    // Accept if it has company-like characteristics
    return /[A-Z]/.test(name) && // Has capital letters
           !/^\d/.test(name) && // Doesn't start with number
           !/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(name); // Not a month
  }

  // Check if text looks like it could be a company (used to avoid false positives)
  looksLikeCompany(text) {
    const lowerText = text.toLowerCase();

    // Check for company indicators
    const companyIndicators = ['ltd', 'inc', 'corp', 'pvt', 'private', 'limited', 'company',
                              'technologies', 'systems', 'solutions', 'services', 'software',
                              'consulting', 'group', 'industries', 'labs'];

    return companyIndicators.some(indicator => lowerText.includes(indicator)) ||
           this.extractCompanyFromLine(text) !== null;
  }

  // Clean and validate company name
  validateAndCleanCompany(company) {
    if (!company || typeof company !== 'string') return null;

    let cleaned = company
      .trim()
      .replace(/^\s*[-•*]\s*/, '') // Remove bullets
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/,$/, '') // Remove trailing comma
      .replace(/\.$/, ''); // Remove trailing period

    // Validate length and content
    if (cleaned.length < 2 || cleaned.length > 50) return null;
    if (!/[a-zA-Z]/.test(cleaned)) return null; // Must contain letters
    if (/^\d/.test(cleaned)) return null; // Can't start with number

    // Reject obvious non-companies
    const rejectPatterns = [
      /^\d+$/, // Just numbers
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // Months
      /\b(university|college|school|institute|academy)\b/i, // Educational institutions
      /\b(city|state|country|district)\b/i // Geographic terms
    ];

    if (rejectPatterns.some(pattern => pattern.test(cleaned))) {
      return null;
    }

    return cleaned;
  }

  /**
   * Extract CTC (Cost to Company) values
   */
  extractCTC(text) {
    // Look for LPA (Lakhs Per Annum) patterns
    const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lakh)/i);
    if (lpaMatch) {
      const amount = parseFloat(lpaMatch[1]);
      return Math.round(amount * 100000); // Convert to rupees
    }

    // Look for specific amount patterns
    const amountMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:rs|inr|rupees?|\$)/i);
    if (amountMatch) {
      return parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Look for CTC in thousands
    const thousandMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:k|thousand)/i);
    if (thousandMatch) {
      return parseFloat(thousandMatch[1].replace(/,/g, '')) * 1000;
    }

    return null;
  }

  /**
   * Extract notice period with more patterns
   */
  extractNotice(text) {
    if (/immediate|immediately/i.test(text)) {
      return 'Immediate';
    }

    const patterns = [
      /notice period[\s:]+(\d+)\s*(days?|months?)/i,
      /serving notice[\s:]+(\d+)\s*(days?|months?)/i,
      /(\d+)\s*(days?|months?)\s*(?:notice|np)/i,
      /notice[\s:]+(\d+)\s*(days?|months?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const number = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        return `${number} ${unit}${number > 1 ? 's' : ''}`;
      }
    }

    return null;
  }

  extractBasicInfo(text) {
    // Split into sections first (critical for accuracy)
    const sections = this.splitSections(text);

    // Extract basic contact info
    const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];

    const phonePatterns = [
      /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\d{10}/g,
      /\+91\s*\d{10}/g
    ];

    let phones = [];
    for (const pattern of phonePatterns) {
      const matches = text.match(pattern);
      if (matches) phones.push(...matches);
    }
    phones = [...new Set(phones)];

    // Extract name using section-aware approach
    const name = this.extractName(sections, emails, phones);

    // Extract applied for position
    const appliedFor = this.extractAppliedFor(text);

    // Extract experience using date calculations (most accurate)
    const dateExperience = this.extractExperienceFromDates(text);
    let experienceYears = dateExperience.experienceYears;
    let experienceMonths = dateExperience.experienceMonths;

    // Fallback to regex-based experience if date parsing didn't work
    if (!experienceYears) {
      const expMatch = text.match(/(\d+)\s*years?\s*(?:and\s*)?(\d+)\s*months?\s+(?:of\s+)?experience/i);
      if (expMatch) {
        experienceYears = parseInt(expMatch[1]);
        experienceMonths = parseInt(expMatch[2]);
      } else {
        const yearsMatch = text.match(/(\d+(?:\.\d+)?)\s*years?\s+(?:of\s+)?experience/i);
        if (yearsMatch) {
          experienceYears = Math.floor(parseFloat(yearsMatch[1]));
          experienceMonths = Math.round((parseFloat(yearsMatch[1]) % 1) * 12);
        }
      }
    }

    // Extract current role from experience section
    const currentRole = this.extractCurrentRole(sections);

    // Extract CTC
    const currentCTC = this.extractCTC(text);

    // Extract notice period
    const noticePeriod = this.extractNotice(text);

    // Extract location (simplified version)
    let currentLocation = null;
    const locationPatterns = [
      /(?:location|address|city|based in)[\s:]+([^\n\r,.]{3,30})/i,
      /(?:current location|present address)[\s:]+([^\n\r,.]{3,30})/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 2) {
        currentLocation = match[1].trim();
        break;
      }
    }

    // Advanced skills extraction with comprehensive lists and smart matching
    const extractSkills = (text) => {
      const foundSkills = new Set();
      const lowerText = text.toLowerCase();

      // Comprehensive skill database with variations
      const skillDatabase = {
        // Programming Languages
        'javascript': ['javascript', 'js', 'es6', 'es2015', 'ecmascript'],
        'python': ['python', 'python3', 'django', 'flask', 'fastapi'],
        'java': ['java', 'java8', 'java11', 'java17', 'spring', 'spring boot', 'hibernate'],
        'c++': ['c++', 'cpp', 'c plus plus'],
        'c#': ['c#', 'csharp', 'dotnet', '.net', 'asp.net'],
        'php': ['php', 'laravel', 'codeigniter', 'symfony'],
        'ruby': ['ruby', 'rails', 'ruby on rails'],
        'go': ['go', 'golang', 'google go'],
        'rust': ['rust', 'rustlang'],
        'swift': ['swift', 'ios development'],
        'kotlin': ['kotlin', 'android kotlin'],
        'typescript': ['typescript', 'ts'],
        'scala': ['scala', 'akka'],
        'r': ['r', 'rlang', 'rstudio'],
        'matlab': ['matlab'],
        'perl': ['perl'],
        'bash': ['bash', 'shell scripting', 'shell script'],
        'powershell': ['powershell', 'posh'],

        // Web Technologies
        'html': ['html', 'html5'],
        'css': ['css', 'css3', 'sass', 'scss', 'less'],
        'react': ['react', 'react.js', 'reactjs', 'react native', 'next.js', 'nextjs'],
        'angular': ['angular', 'angularjs', 'angular.js'],
        'vue': ['vue', 'vue.js', 'vuejs', 'nuxt'],
        'jquery': ['jquery', 'jquery.js'],
        'bootstrap': ['bootstrap', 'bootstrap4', 'bootstrap5'],
        'node.js': ['node.js', 'nodejs', 'express', 'express.js', 'npm'],
        'django': ['django', 'python django'],
        'flask': ['flask', 'python flask'],
        'spring': ['spring', 'spring boot', 'spring framework'],
        'laravel': ['laravel', 'php laravel'],

        // Databases
        'mysql': ['mysql', 'mariadb'],
        'postgresql': ['postgresql', 'postgres', 'psql'],
        'mongodb': ['mongodb', 'mongo', 'mongoose'],
        'redis': ['redis', 'redis cache'],
        'oracle': ['oracle', 'oracle db', 'oracle database'],
        'sql server': ['sql server', 'mssql', 'microsoft sql'],
        'sqlite': ['sqlite', 'sqlite3'],
        'dynamodb': ['dynamodb', 'aws dynamodb'],
        'cassandra': ['cassandra', 'apache cassandra'],
        'elasticsearch': ['elasticsearch', 'elastic search'],

        // Cloud & DevOps
        'aws': ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds'],
        'azure': ['azure', 'microsoft azure', 'azure devops'],
        'gcp': ['gcp', 'google cloud', 'google cloud platform'],
        'docker': ['docker', 'docker compose', 'containerization'],
        'kubernetes': ['kubernetes', 'k8s', 'k3s'],
        'terraform': ['terraform', 'infrastructure as code'],
        'ansible': ['ansible', 'configuration management'],
        'jenkins': ['jenkins', 'ci/cd', 'continuous integration'],
        'gitlab ci': ['gitlab ci', 'gitlab', 'ci/cd'],
        'github actions': ['github actions', 'github', 'ci/cd'],
        'heroku': ['heroku', 'heroku deployment'],

        // Mobile Development
        'android': ['android', 'android development', 'android studio'],
        'ios': ['ios', 'iphone', 'ipad', 'objective-c'],
        'react native': ['react native', 'reactnative'],
        'flutter': ['flutter', 'dart', 'flutter development'],
        'xamarin': ['xamarin', 'xamarin.forms'],
        'ionic': ['ionic', 'ionic framework'],

        // Tools & IDEs
        'git': ['git', 'github', 'bitbucket', 'version control'],
        'jira': ['jira', 'atlassian', 'issue tracking'],
        'confluence': ['confluence', 'atlassian'],
        'slack': ['slack', 'team communication'],
        'postman': ['postman', 'api testing'],
        'swagger': ['swagger', 'api documentation'],
        'figma': ['figma', 'ui design', 'ux design'],
        'photoshop': ['photoshop', 'adobe photoshop'],
        'illustrator': ['illustrator', 'adobe illustrator'],
        'vscode': ['vscode', 'visual studio code'],
        'intellij': ['intellij', 'idea', 'intellij idea'],
        'eclipse': ['eclipse', 'eclipse ide'],

        // Methodologies & Practices
        'agile': ['agile', 'agile methodology'],
        'scrum': ['scrum', 'scrum master'],
        'kanban': ['kanban', 'kanban board'],
        'tdd': ['tdd', 'test driven development'],
        'bdd': ['bdd', 'behavior driven development'],
        'ci/cd': ['ci/cd', 'continuous integration', 'continuous deployment'],
        'devops': ['devops', 'site reliability engineering', 'sre'],
        'microservices': ['microservices', 'microservice architecture'],
        'rest api': ['rest api', 'restful api', 'rest'],
        'graphql': ['graphql', 'graph ql'],
        'oauth': ['oauth', 'authentication', 'authorization'],

        // Data Science & ML
        'machine learning': ['machine learning', 'ml', 'artificial intelligence', 'ai'],
        'deep learning': ['deep learning', 'neural networks', 'cnn', 'rnn'],
        'tensorflow': ['tensorflow', 'tf', 'google tensorflow'],
        'pytorch': ['pytorch', 'torch', 'facebook pytorch'],
        'scikit-learn': ['scikit-learn', 'sklearn', 'scikit learn'],
        'pandas': ['pandas', 'python pandas'],
        'numpy': ['numpy', 'python numpy'],
        'matplotlib': ['matplotlib', 'data visualization'],
        'seaborn': ['seaborn', 'data visualization'],
        'jupyter': ['jupyter', 'jupyter notebook'],
        'tableau': ['tableau', 'data visualization'],
        'power bi': ['power bi', 'microsoft power bi', 'business intelligence'],

        // Testing
        'selenium': ['selenium', 'automation testing', 'webdriver'],
        'cypress': ['cypress', 'e2e testing', 'end to end testing'],
        'jest': ['jest', 'javascript testing', 'unit testing'],
        'mocha': ['mocha', 'testing framework'],
        'junit': ['junit', 'java testing'],
        'pytest': ['pytest', 'python testing'],
        'postman testing': ['postman', 'api testing'],
        'manual testing': ['manual testing', 'qa', 'quality assurance'],

        // Other Technologies
        'linux': ['linux', 'ubuntu', 'centos', 'redhat'],
        'windows': ['windows', 'windows server'],
        'macos': ['macos', 'mac', 'osx'],
        'apache': ['apache', 'apache server', 'httpd'],
        'nginx': ['nginx', 'nginx server'],
        'rabbitmq': ['rabbitmq', 'message queue', 'amqp'],
        'kafka': ['kafka', 'apache kafka', 'message streaming']
      };

      // Extract skills with multiple strategies
      for (const [canonicalSkill, variations] of Object.entries(skillDatabase)) {
        for (const variation of variations) {
          if (lowerText.includes(variation.toLowerCase())) {
            foundSkills.add(canonicalSkill);
            break; // Found one variation, move to next skill
          }
        }
      }

      // Additional pattern-based extraction for skills not in database
      const patterns = [
        // Framework patterns
        /\b(react|angular|vue|ember|svelte|backbone)\b/gi,
        // Language patterns with versions
        /\b(java\s*\d+|python\s*\d+|node\.?js|typescript)\b/gi,
        // Database patterns
        /\b(mongo\s*db|postgre\s*sql|my\s*sql|sql\s*server)\b/gi,
        // Cloud patterns
        /\b(amazon\s*web\s*services|google\s*cloud|microsoft\s*azure)\b/gi
      ];

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const cleanMatch = match.toLowerCase().replace(/\s+/g, ' ').trim();
            if (cleanMatch.length > 2) {
              foundSkills.add(cleanMatch);
            }
          });
        }
      }

      return Array.from(foundSkills);
    };

    // Extract skills using advanced algorithm
    const uniqueSkills = extractSkills(text);

    // Build comprehensive notes
    const notesParts = [];
    if (uniqueSkills.length > 0) {
      notesParts.push(`Skills: ${uniqueSkills.slice(0, 5).join(', ')}`);
    }
    if (experienceYears) {
      notesParts.push(`${experienceYears}y ${experienceMonths || 0}m experience`);
    }
    if (currentLocation) {
      notesParts.push(`Located in ${currentLocation}`);
    }
    if (appliedFor) {
      notesParts.push(`Applied for: ${appliedFor}`);
    }

    const notes = notesParts.length > 0
      ? `AI-extracted profile: ${notesParts.join(' • ')}`
      : 'Profile parsed successfully using local AI extraction.';

    return {
      firstName: name.firstName,
      lastName: name.lastName,
      email: emails[0] || null,
      phone: phones[0] ? phones[0].replace(/[^\d]/g, '') : null,
      appliedFor,
      currentLocation,
      preferredLocation: [],
      source: 'other',
      experienceYears,
      experienceMonths,
      currentCompany: currentRole.currentCompany,
      currentDesignation: currentRole.currentDesignation,
      currentCTC,
      expectedCTC: null,
      noticePeriod,
      skills: uniqueSkills,
      stage: null,
      notes
    };
  }

  async parseResume(filePath) {
    try {
      const text = await this.parseFile(filePath);
      const data = this.extractBasicInfo(text);

      return {
        success: true,
        data,
        rawText: text,
        confidence: {}, // No confidence scores for local parsing
        metadata: {
          parsedAt: new Date(),
          version: 'local-1.0',
          source: 'local-parser',
          message: 'Using local fallback parser - limited functionality'
        }
      };
    } catch (error) {
      console.error('Local parsing failed:', error);

      return {
        success: false,
        error: error.message,
        data: null,
        rawText: '',
        confidence: {},
        metadata: {
          parsedAt: new Date(),
          version: 'local-1.0',
          source: 'local-parser',
          error: error.message
        }
      };
    }
  }
}

/**
 * Reducto Resume Parsing Service
 * Integrates with Reducto API to extract structured candidate data from resumes
 */
class ReductoService {
  constructor() {
    this.apiKey = process.env.REDUCTO_API_KEY;
    // Reducto API endpoint - using platform.reducto.ai/extract
    this.baseUrl = process.env.REDUCTO_API_URL || 'https://platform.reducto.ai/extract';
  }

  /**
   * System prompt for Reducto API - strictly follow the provided prompt
   */
  getSystemPrompt() {
    return `You are an AI resume parser for an HRMS candidate tracking system.

Your task is to extract structured candidate data from resumes.

STRICT RULES:
- Extract ONLY fields defined in the schema.
- DO NOT guess, infer, or hallucinate values.
- If a field is missing or unclear, return null.
- Return valid JSON only.
- Do not add explanations, comments, or extra fields.

DATA NORMALIZATION RULES:
- firstName and lastName must be in proper case.
- phone numbers must contain digits only (no spaces, no +91).
- Skills must be short, standardized skill names.
- Experience must be split into years and months.
- Salary values must be numeric (annual CTC).
- If multiple values exist, choose the most recent and relevant.
- Location should be city/state/country if available.

FIELD-SPECIFIC RULES:
- stage must always be null.
- notes should contain a brief professional summary if present.
- source should only be extracted if explicitly mentioned (LinkedIn, Naukri, Referral).`;
  }

  /**
   * Schema for Reducto API response
   */
  getSchema() {
    return {
      "firstName": "string | null",
      "lastName": "string | null",
      "email": "string | null",
      "phone": "string | null",
      "alternatePhone": "string | null",
      "appliedFor": "string | null",
      "currentLocation": "string | null",
      "preferredLocation": "string | null",
      "source": "string | null",
      "experienceYears": "number | null",
      "experienceMonths": "number | null",
      "currentCompany": "string | null",
      "currentDesignation": "string | null",
      "currentCTC": "number | null",
      "expectedCTC": "number | null",
      "noticePeriod": "string | null",
      "skills": ["string"],
      "stage": "string | null",
      "notes": "string | null"
    };
  }

  /**
   * Parse resume using Reducto API extract endpoint
   * @param {string} filePath - Path to the resume file
   * @returns {Promise<Object>} - Parsed candidate data
   */
  async parseResume(filePath) {
    try {
      if (!this.apiKey) {
        throw new Error('Reducto API key not configured. Please set REDUCTO_API_KEY environment variable.');
      }

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Resume file not found');
      }

      console.log(`Calling Reducto API at: ${this.baseUrl}`);

      // Method 1: Try simple file upload (just the file)
      try {
        const extractFormData = new FormData();
        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        
        // Determine content type based on file extension
        let contentType = 'application/pdf';
        if (fileExt === '.docx' || fileExt === '.doc') {
          contentType = fileExt === '.docx' 
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/msword';
        }
        
        extractFormData.append('file', fileStream, {
          filename: fileName,
          contentType: contentType
        });

        const extractResponse = await axios.post(this.baseUrl, extractFormData, {
          headers: {
            ...extractFormData.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        console.log('✅ Reducto API extraction completed (simple file upload)');
        console.log('📦 Full Reducto Response:', JSON.stringify(extractResponse.data, null, 2));

        if (!extractResponse.data) {
          throw new Error('Invalid response from Reducto API');
        }

        // Transform Reducto response to our expected format
        const transformedData = this.transformReductoResponse(extractResponse.data);

        console.log('📊 Transformed Data:', JSON.stringify(transformedData, null, 2));

        // Normalize the data before returning
        const normalizedData = this.normalizeData(transformedData);

        return {
          success: true,
          data: normalizedData,
          rawText: transformedData.rawText || '',
          confidence: extractResponse.data.confidence || {},
          metadata: {
            parsedAt: new Date(),
            version: '1.0',
            source: 'reducto',
            endpoint: this.baseUrl,
            jobId: extractResponse.data.job_id || extractResponse.data.id,
            usage: extractResponse.data.usage,
            rawResponse: extractResponse.data // Store for debugging
          }
        };
      } catch (simpleError) {
        console.log('Simple file upload failed, trying with schema:', simpleError.message);
        
        // Method 2: Try with schema and system prompt as form fields
        try {
          const extractFormData2 = new FormData();
          const fileStream2 = fs.createReadStream(filePath);
          const fileName2 = path.basename(filePath);
          const fileExt2 = path.extname(filePath).toLowerCase();
          
          let contentType2 = 'application/pdf';
          if (fileExt2 === '.docx' || fileExt2 === '.doc') {
            contentType2 = fileExt2 === '.docx' 
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/msword';
          }
          
          extractFormData2.append('file', fileStream2, {
            filename: fileName2,
            contentType: contentType2
          });
          extractFormData2.append('system_prompt', this.getSystemPrompt());
          extractFormData2.append('schema', JSON.stringify(this.getSchema()));

          const extractResponse2 = await axios.post(this.baseUrl, extractFormData2, {
            headers: {
              ...extractFormData2.getHeaders(),
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });

          console.log('✅ Reducto API extraction completed (with schema)');
          console.log('📦 Full Reducto Response (with schema):', JSON.stringify(extractResponse2.data, null, 2));

          if (!extractResponse2.data) {
            throw new Error('Invalid response from Reducto API');
          }

          // Transform Reducto response to our expected format
          const transformedData2 = this.transformReductoResponse(extractResponse2.data);

          console.log('📊 Transformed Data (with schema):', JSON.stringify(transformedData2, null, 2));

          // Normalize the data before returning
          const normalizedData2 = this.normalizeData(transformedData2);

          return {
            success: true,
            data: normalizedData2,
            rawText: transformedData2.rawText || '',
            confidence: extractResponse2.data.confidence || {},
            metadata: {
              parsedAt: new Date(),
              version: '1.0',
              source: 'reducto',
              endpoint: this.baseUrl,
              jobId: extractResponse2.data.job_id || extractResponse2.data.id,
              usage: extractResponse2.data.usage,
              rawResponse: extractResponse2.data
            }
          };
        } catch (schemaError) {
          console.log('Schema method failed, trying JSON with file reference:', schemaError.message);
          
          // Method 3: Upload file first, then extract with JSON payload
          const uploadUrl = this.baseUrl.replace('/extract', '/upload');
          const uploadFormData = new FormData();
          uploadFormData.append('file', fs.createReadStream(filePath));

          const uploadResponse = await axios.post(uploadUrl, uploadFormData, {
            headers: {
              ...uploadFormData.getHeaders(),
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 60000, // 60 seconds for file upload
          });

          const fileReference = uploadResponse.data.file_id || uploadResponse.data.id || uploadResponse.data;

          // Extract using file reference
          const extractPayload = {
            input: fileReference,
            system_prompt: this.getSystemPrompt(),
            schema: this.getSchema()
          };

          const extractResponse3 = await axios.post(this.baseUrl, extractPayload, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
          });

          console.log('✅ Reducto API extraction completed (two-step method)');
          console.log('📦 Full Reducto Response (two-step):', JSON.stringify(extractResponse3.data, null, 2));

          if (!extractResponse3.data) {
            throw new Error('Invalid response from Reducto API');
          }

          // Transform Reducto response to our expected format
          const transformedData3 = this.transformReductoResponse(extractResponse3.data);

          console.log('📊 Transformed Data (two-step):', JSON.stringify(transformedData3, null, 2));

          // Normalize the data before returning
          const normalizedData3 = this.normalizeData(transformedData3);

          return {
            success: true,
            data: normalizedData3,
            rawText: transformedData3.rawText || '',
            confidence: extractResponse3.data.confidence || {},
            metadata: {
              parsedAt: new Date(),
              version: '1.0',
              source: 'reducto',
              endpoint: this.baseUrl,
              jobId: extractResponse3.data.job_id || extractResponse3.data.id,
              usage: extractResponse3.data.usage,
              rawResponse: extractResponse3.data
            }
          };
        }
      }

    } catch (error) {
      console.error('❌ Reducto API error:', error.message);
      console.error('❌ Full error:', error);

      if (error.response) {
        console.error('❌ API Response Status:', error.response.status);
        console.error('❌ API Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('❌ API Response Headers:', error.response.headers);
      } else if (error.code === 'ENOTFOUND') {
        console.error('❌ DNS/Network Error: Cannot reach Reducto API. Check your internet connection.');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('❌ Connection Refused: Reducto API server is not responding.');
      }

      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.message || 
                          'Unknown error from Reducto API';

      return {
        success: false,
        error: errorMessage,
        data: null,
        rawText: '',
        confidence: {},
        metadata: {
          parsedAt: new Date(),
          version: '1.0',
          source: 'reducto',
          error: errorMessage,
          errorCode: error.code,
          statusCode: error.response?.status,
          responseData: error.response?.data
        }
      };
    }
  }

  /**
   * Transform Reducto API response to our expected format
   * @param {Object} reductoResponse - Raw response from Reducto API
   * @returns {Object} - Transformed candidate data
   */
  transformReductoResponse(reductoResponse) {
    try {
      // Extract the first result from the array (Reducto returns result as array)
      let reductoData = null;
      if (Array.isArray(reductoResponse.result) && reductoResponse.result.length > 0) {
        reductoData = reductoResponse.result[0];
      } else if (reductoResponse.result && !Array.isArray(reductoResponse.result)) {
        reductoData = reductoResponse.result;
      } else if (reductoResponse.data) {
        reductoData = reductoResponse.data;
      } else {
        reductoData = reductoResponse;
      }

      if (!reductoData) {
        return {};
      }

      // Split name into firstName and lastName
      let firstName = null;
      let lastName = null;
      if (reductoData.name) {
        const nameParts = reductoData.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
        }
      }

      // Extract contact info - handle both old and new formats
      const contactInfo = reductoData.contact_info || reductoData.contact_information || {};
      const email = contactInfo.email || null;
      let phone = contactInfo.phone || contactInfo.phone_number || null;
      if (phone) {
        // Clean phone number - remove +91, spaces, dashes
        phone = phone.replace(/\+91[- ]?/g, '').replace(/[^\d]/g, '');
      }

      // Flatten skills from nested structure - handle both old and new formats
      const skills = [];
      if (reductoData.skills) {
        Object.values(reductoData.skills).forEach(skillCategory => {
          if (Array.isArray(skillCategory)) {
            skillCategory.forEach(item => {
              // Handle both formats: skill_name (new) or skill (old)
              if (item.skill_name) {
                skills.push(item.skill_name);
              } else if (item.skill) {
                skills.push(item.skill);
              } else if (typeof item === 'string') {
                skills.push(item);
              }
            });
          }
        });
      }

      // Extract current company and designation from work experience - handle both formats
      let currentCompany = null;
      let currentDesignation = null;
      let experienceYears = null;
      let experienceMonths = null;

      if (reductoData.work_experience && Array.isArray(reductoData.work_experience) && reductoData.work_experience.length > 0) {
        const latestJob = reductoData.work_experience[0];
        // Handle both formats: company_name/job_title (new) or company/title (old)
        currentCompany = latestJob.company_name || latestJob.company || null;
        currentDesignation = latestJob.job_title || latestJob.title || null;

        // Calculate total experience from all work experiences
        let totalMonths = 0;
        reductoData.work_experience.forEach(job => {
          if (job.start_date && job.end_date) {
            const startDate = this.parseDate(job.start_date);
            const endDate = job.end_date.toLowerCase() === 'present' || 
                          job.end_date.toLowerCase() === 'current' ||
                          job.end_date.toLowerCase() === 'till date'
              ? new Date() 
              : this.parseDate(job.end_date);
            
            if (startDate && endDate) {
              const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                           (endDate.getMonth() - startDate.getMonth());
              if (months > 0 && months < 600) { // Reasonable limit
                totalMonths += months;
              }
            }
          }
        });

        if (totalMonths > 0) {
          experienceYears = Math.floor(totalMonths / 12);
          experienceMonths = totalMonths % 12;
        }
      }

      // Extract location (if available in contact_info or elsewhere)
      let currentLocation = null;
      if (contactInfo.location) {
        currentLocation = contactInfo.location;
      } else if (reductoData.location) {
        currentLocation = reductoData.location;
      }

      // Extract education info for notes - handle both formats
      let educationNotes = [];
      if (reductoData.education && Array.isArray(reductoData.education)) {
        educationNotes = reductoData.education.map(edu => {
          // Handle both formats: degree_or_standard + major (new) or degree (old)
          const degree = edu.degree_or_standard 
            ? `${edu.degree_or_standard}${edu.major ? ` - ${edu.major}` : ''}`
            : edu.degree || 'Degree';
          const score = edu.score || edu.grade_score || '';
          return `${degree} from ${edu.institution || 'Unknown'}${score ? ` (${score})` : ''}`;
        });
      }

      // Build notes from available information
      const notesParts = [];
      if (skills.length > 0) {
        notesParts.push(`Skills: ${skills.slice(0, 10).join(', ')}`);
      }
      if (experienceYears !== null && experienceYears > 0) {
        notesParts.push(`${experienceYears}y ${experienceMonths || 0}m experience`);
      } else if (experienceMonths > 0) {
        notesParts.push(`${experienceMonths}m experience`);
      }
      if (educationNotes.length > 0) {
        notesParts.push(`Education: ${educationNotes.join('; ')}`);
      }
      if (reductoData.achievements && Array.isArray(reductoData.achievements) && reductoData.achievements.length > 0) {
        // Handle both formats: achievement_description (new) or achievement (old)
        const achievements = reductoData.achievements
          .map(a => a.achievement_description || a.achievement)
          .filter(a => a && a.trim() !== '')
          .join('; ');
        if (achievements) {
          notesParts.push(`Achievements: ${achievements}`);
        }
      }

      const notes = notesParts.length > 0 ? notesParts.join(' • ') : 'Resume parsed successfully using Reducto AI.';

      return {
        firstName,
        lastName,
        email,
        phone,
        alternatePhone: null,
        appliedFor: null,
        currentLocation,
        preferredLocation: [],
        source: 'other',
        experienceYears,
        experienceMonths,
        currentCompany,
        currentDesignation,
        currentCTC: null,
        expectedCTC: null,
        noticePeriod: null,
        skills: [...new Set(skills)], // Remove duplicates
        stage: null,
        notes,
        rawText: '' // Reducto doesn't return raw text in this format
      };
    } catch (error) {
      console.error('Error transforming Reducto response:', error);
      return {};
    }
  }

  /**
   * Parse date string in various formats (MM/YYYY, YYYY-MM, YYYY-MM-DD, etc.)
   * @param {string} dateStr - Date string to parse
   * @returns {Date|null} - Parsed date or null
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle YYYY-MM-DD format (e.g., "2025-06-01")
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Handle MM/YYYY format (e.g., "06/2025")
      if (dateStr.includes('/') && !dateStr.includes('-')) {
        const parts = dateStr.split('/');
        if (parts.length === 2) {
          const month = parseInt(parts[0]) - 1; // Month is 0-indexed
          const year = parseInt(parts[1]);
          if (!isNaN(month) && !isNaN(year)) {
            return new Date(year, month, 1);
          }
        }
      }
      
      // Handle YYYY-MM format (e.g., "2025-06")
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        if (parts.length === 2) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          if (!isNaN(year) && !isNaN(month)) {
            return new Date(year, month, 1);
          }
        }
      }
      
      // Try standard date parsing
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      console.warn('Failed to parse date:', dateStr, error);
    }
    
    return null;
  }

  /**
   * Normalize Reducto response data
   * @param {Object} reductoData - Raw data from Reducto API
   * @returns {Object} - Normalized candidate data
   */
  normalizeData(reductoData) {
    const normalized = { ...reductoData };

    try {
      // Convert empty strings to null for optional fields
      const optionalFields = ['appliedFor', 'currentLocation', 'preferredLocation', 'currentCompany', 'currentDesignation', 'noticePeriod', 'notes'];
      optionalFields.forEach(field => {
        if (normalized[field] === '' || normalized[field] === null || normalized[field] === undefined) {
          normalized[field] = null;
        }
      });

      // Handle phone numbers - convert empty strings to null
      if (!normalized.phone || normalized.phone === '') {
        normalized.phone = null;
      } else {
        normalized.phone = normalized.phone.replace(/[^\d]/g, '');
        if (normalized.phone === '') normalized.phone = null;
      }

      if (!normalized.alternatePhone || normalized.alternatePhone === '') {
        normalized.alternatePhone = null;
      } else {
        normalized.alternatePhone = normalized.alternatePhone.replace(/[^\d]/g, '');
        if (normalized.alternatePhone === '') normalized.alternatePhone = null;
      }

      // Normalize skills (remove duplicates, standardize)
      if (normalized.skills && Array.isArray(normalized.skills)) {
        normalized.skills = [...new Set(
          normalized.skills
            .filter(skill => skill && typeof skill === 'string' && skill.trim() !== '')
            .map(skill => skill.trim().toLowerCase())
        )];
        if (normalized.skills.length === 0) normalized.skills = [];
      } else {
        normalized.skills = [];
      }

      // Ensure experience is properly formatted or null
      if (normalized.experienceYears === '' || normalized.experienceYears === null || normalized.experienceYears === undefined) {
        normalized.experienceYears = null;
      } else if (typeof normalized.experienceYears !== 'number') {
        const parsed = parseInt(normalized.experienceYears);
        normalized.experienceYears = isNaN(parsed) ? null : parsed;
      }

      if (normalized.experienceMonths === '' || normalized.experienceMonths === null || normalized.experienceMonths === undefined) {
        normalized.experienceMonths = null;
      } else if (typeof normalized.experienceMonths !== 'number') {
        const parsed = parseInt(normalized.experienceMonths);
        normalized.experienceMonths = isNaN(parsed) ? null : parsed;
      }

      // Ensure CTC values are numbers or null
      const normalizeCTC = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        if (typeof value === 'number') return value;

        const ctcStr = String(value).toLowerCase().trim();
        if (ctcStr === '') return null;

        if (ctcStr.includes('lpa')) {
          const lpa = parseFloat(ctcStr.replace('lpa', '').trim());
          return isNaN(lpa) ? null : lpa * 100000; // Convert LPA to rupees
        } else {
          const parsed = parseFloat(ctcStr.replace(/[^\d.]/g, ''));
          return isNaN(parsed) ? null : parsed;
        }
      };

      normalized.currentCTC = normalizeCTC(normalized.currentCTC);
      normalized.expectedCTC = normalizeCTC(normalized.expectedCTC);

      // Normalize email to lowercase or null
      if (!normalized.email || normalized.email === '') {
        normalized.email = null;
      } else {
        normalized.email = normalized.email.toLowerCase().trim();
        if (normalized.email === '') normalized.email = null;
      }

      // Normalize source - must be valid enum value or null
      const validSources = ['internal', 'linkedin', 'naukri', 'referral', 'job-portal', 'walk-in', 'other'];
      if (!normalized.source || normalized.source === '') {
        normalized.source = 'other'; // Default to 'other' instead of null
      } else {
        const sourceLower = normalized.source.toLowerCase().trim();
        normalized.source = validSources.includes(sourceLower) ? sourceLower : 'other';
      }

      // Trim string fields and convert empty to null
      ['firstName', 'lastName'].forEach(field => {
        if (!normalized[field] || normalized[field] === '') {
          normalized[field] = null;
        } else if (typeof normalized[field] === 'string') {
          normalized[field] = normalized[field].trim();
          if (normalized[field] === '') normalized[field] = null;
        }
      });

      // For other string fields, trim and convert empty to null
      ['currentLocation', 'preferredLocation', 'currentCompany', 'currentDesignation', 'noticePeriod', 'notes'].forEach(field => {
        if (normalized[field] && typeof normalized[field] === 'string') {
          normalized[field] = normalized[field].trim();
          if (normalized[field] === '') normalized[field] = null;
        }
      });

      // Ensure stage is always null (as per schema rules)
      normalized.stage = null;

      return normalized;

    } catch (error) {
      console.error('Error normalizing Reducto data:', error);
      return reductoData; // Return original data if normalization fails
    }
  }

  /**
   * Extract candidate data from resume file
   * @param {string} filePath - Path to resume file
   * @returns {Promise<Object>} - Complete extraction result
   */
  async extractCandidateData(filePath) {
    // Use only Reducto API - no local fallback
    const result = await this.parseResume(filePath);

    if (result.success && result.data) {
      // Data is already normalized in parseResume, but ensure it's still valid
      if (!result.data || Object.keys(result.data).length === 0) {
        console.warn('⚠️ Reducto returned empty data object');
        console.log('Raw result:', JSON.stringify(result, null, 2));
      }
      // Don't normalize again - already normalized in parseResume
      return result;
    }

    // If Reducto API fails, return error (no local fallback)
    console.log('❌ Reducto API failed - no fallback available');

    return {
      success: false,
      error: result.error || 'Reducto API extraction failed',
      data: {
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        appliedFor: null,
        currentLocation: null,
        preferredLocation: [],
        source: 'other',
        experienceYears: null,
        experienceMonths: null,
        currentCompany: null,
        currentDesignation: null,
        currentCTC: null,
        expectedCTC: null,
        noticePeriod: null,
        skills: [],
        stage: null,
        notes: `Resume uploaded but Reducto API parsing failed: ${result.error}. Please fill in the candidate details manually.`
      },
      rawText: 'Resume file received but could not be parsed by Reducto API.',
      confidence: {},
      metadata: {
        parsedAt: new Date(),
        version: '1.0',
        source: 'reducto',
        error: result.error,
        message: 'Reducto API failed - manual entry required'
      }
    };
  }
}

module.exports = new ReductoService();