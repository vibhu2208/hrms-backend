const axios = require('axios');

/**
 * AI Service for Candidate Analysis
 * Handles AI-powered candidate matching, ranking, and resume analysis using DeepSeek API
 */
class AIService {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-v3';
    this.embeddingModel = process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding';
    this.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 4096;
    this.temperature = parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7;
    this.useDeepSeek = !!this.deepseekApiKey;

    // Fallback configuration for when DeepSeek is not available
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.openaiEmbeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002';
    this.useOpenAI = !!this.openaiApiKey && !this.useDeepSeek;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get embeddings from DeepSeek
   */
  async getEmbedding(text) {
    if (this.useDeepSeek) {
      return this.getDeepSeekEmbedding(text);
    } else if (this.useOpenAI) {
      return this.getOpenAIEmbedding(text);
    } else {
      throw new Error('No AI API key configured');
    }
  }

  /**
   * Get embeddings from DeepSeek API
   */
  async getDeepSeekEmbedding(text) {
    if (!this.useDeepSeek) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/embeddings`,
        {
          input: text,
          model: this.embeddingModel
        },
        {
          headers: {
            'Authorization': `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error getting DeepSeek embedding:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get embeddings from OpenAI (fallback)
   */
  async getOpenAIEmbedding(text) {
    if (!this.useOpenAI) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: this.openaiEmbeddingModel
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error getting OpenAI embedding:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Calculate semantic similarity between job description and candidate profile
   */
  async calculateSemanticSimilarity(jobDescription, candidateProfile) {
    try {
      if (this.useDeepSeek || this.useOpenAI) {
        const [jobEmbedding, candidateEmbedding] = await Promise.all([
          this.getEmbedding(jobDescription),
          this.getEmbedding(candidateProfile)
        ]);

        const similarity = this.cosineSimilarity(jobEmbedding, candidateEmbedding);
        return Math.round(similarity * 100);
      } else {
        // Fallback to keyword-based matching
        return this.keywordBasedSimilarity(jobDescription, candidateProfile);
      }
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      // Fallback to keyword-based matching
      return this.keywordBasedSimilarity(jobDescription, candidateProfile);
    }
  }

  /**
   * Keyword-based similarity (fallback when AI APIs are not available)
   */
  keywordBasedSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Analyze skills match between job requirements and candidate skills
   */
  analyzeSkillsMatch(requiredSkills = [], candidateSkills = []) {
    const required = requiredSkills.map(s => s.toLowerCase().trim());
    const candidate = candidateSkills.map(s => s.toLowerCase().trim());
    
    const matched = required.filter(skill => 
      candidate.some(cs => cs.includes(skill) || skill.includes(cs))
    );
    
    const missing = required.filter(skill => 
      !candidate.some(cs => cs.includes(skill) || skill.includes(cs))
    );
    
    const additional = candidate.filter(skill => 
      !required.some(rs => rs.includes(skill) || skill.includes(rs))
    );
    
    const matchPercentage = required.length > 0 
      ? Math.round((matched.length / required.length) * 100) 
      : 100;
    
    return {
      matched: matched.map(s => requiredSkills.find(rs => rs.toLowerCase() === s)),
      missing: missing.map(s => requiredSkills.find(rs => rs.toLowerCase() === s)),
      additional: additional.slice(0, 10), // Limit to top 10 additional skills
      matchPercentage
    };
  }

  /**
   * Analyze experience match
   */
  analyzeExperienceMatch(requiredExp, candidateExp) {
    const candidateYears = (candidateExp?.years || 0) + (candidateExp?.months || 0) / 12;
    const minRequired = requiredExp?.min || 0;
    const maxRequired = requiredExp?.max || 999;
    
    let score = 0;
    let isMatch = false;
    
    if (candidateYears >= minRequired && candidateYears <= maxRequired) {
      score = 100;
      isMatch = true;
    } else if (candidateYears < minRequired) {
      const diff = minRequired - candidateYears;
      score = Math.max(0, 100 - (diff * 20)); // Penalize 20 points per year short
      isMatch = diff <= 1; // Within 1 year is acceptable
    } else {
      const diff = candidateYears - maxRequired;
      score = Math.max(50, 100 - (diff * 10)); // Penalize 10 points per year over
      isMatch = diff <= 2; // Up to 2 years over is acceptable
    }
    
    return {
      isMatch,
      candidateYears: Math.round(candidateYears * 10) / 10,
      requiredYears: `${minRequired}-${maxRequired}`,
      score: Math.round(score)
    };
  }

  /**
   * Generate AI-powered insights using DeepSeek
   */
  async generateAIInsights(jobPosting, candidate, skillsMatch, experienceMatch) {
    if (this.useDeepSeek) {
      return this.generateDeepSeekInsights(jobPosting, candidate, skillsMatch, experienceMatch);
    } else if (this.useOpenAI) {
      return this.generateOpenAIInsights(jobPosting, candidate, skillsMatch, experienceMatch);
    } else {
      return this.generateRuleBasedInsights(jobPosting, candidate, skillsMatch, experienceMatch);
    }
  }

  /**
   * Generate insights using DeepSeek API
   */
  async generateDeepSeekInsights(jobPosting, candidate, skillsMatch, experienceMatch) {
    try {
      const prompt = `Analyze this candidate for the job position and provide insights:

Job Title: ${jobPosting.title}
Job Description: ${jobPosting.description}
Required Skills: ${jobPosting.skills?.join(', ') || 'Not specified'}
Required Experience: ${jobPosting.experience?.min || 0}-${jobPosting.experience?.max || 'N/A'} years

Candidate:
Name: ${candidate.firstName} ${candidate.lastName}
Experience: ${candidate.experience?.years || 0} years ${candidate.experience?.months || 0} months
Skills: ${candidate.skills?.join(', ') || 'Not specified'}
Current Role: ${candidate.currentDesignation || 'Not specified'}
Education: ${candidate.education?.map(e => `${e.degree} in ${e.specialization}`).join(', ') || 'Not specified'}

Skills Analysis:
- Matched Skills: ${skillsMatch.matched.join(', ') || 'None'}
- Missing Skills: ${skillsMatch.missing.join(', ') || 'None'}
- Match Percentage: ${skillsMatch.matchPercentage}%

Experience Match: ${experienceMatch.isMatch ? 'Yes' : 'No'} (Score: ${experienceMatch.score})

Provide a JSON response with:
1. keyHighlights: Array of 3-5 key strengths (strings)
2. weaknesses: Array of 2-3 areas of concern (strings)
3. overallFit: One of ["excellent", "good", "average", "poor"]
4. recommendation: Brief recommendation (string)

Return ONLY valid JSON, no markdown or extra text.`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.deepseekModel,
          messages: [
            { role: 'system', content: 'You are an expert HR analyst. Provide concise, actionable insights in JSON format.' },
            { role: 'user', content: prompt }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const insights = JSON.parse(jsonContent);

      return {
        keyHighlights: insights.keyHighlights || [],
        weaknesses: insights.weaknesses || [],
        overallFit: insights.overallFit || 'average'
      };
    } catch (error) {
      console.error('Error generating DeepSeek insights:', error.response?.data || error.message);
      return this.generateRuleBasedInsights(jobPosting, candidate, skillsMatch, experienceMatch);
    }
  }

  /**
   * Generate insights using OpenAI API (fallback)
   */
  async generateOpenAIInsights(jobPosting, candidate, skillsMatch, experienceMatch) {
    try {
      const prompt = `Analyze this candidate for the job position and provide insights:

Job Title: ${jobPosting.title}
Job Description: ${jobPosting.description}
Required Skills: ${jobPosting.skills?.join(', ') || 'Not specified'}
Required Experience: ${jobPosting.experience?.min || 0}-${jobPosting.experience?.max || 'N/A'} years

Candidate:
Name: ${candidate.firstName} ${candidate.lastName}
Experience: ${candidate.experience?.years || 0} years ${candidate.experience?.months || 0} months
Skills: ${candidate.skills?.join(', ') || 'Not specified'}
Current Role: ${candidate.currentDesignation || 'Not specified'}
Education: ${candidate.education?.map(e => `${e.degree} in ${e.specialization}`).join(', ') || 'Not specified'}

Skills Analysis:
- Matched Skills: ${skillsMatch.matched.join(', ') || 'None'}
- Missing Skills: ${skillsMatch.missing.join(', ') || 'None'}
- Match Percentage: ${skillsMatch.matchPercentage}%

Experience Match: ${experienceMatch.isMatch ? 'Yes' : 'No'} (Score: ${experienceMatch.score})

Provide a JSON response with:
1. keyHighlights: Array of 3-5 key strengths (strings)
2. weaknesses: Array of 2-3 areas of concern (strings)
3. overallFit: One of ["excellent", "good", "average", "poor"]
4. recommendation: Brief recommendation (string)

Return ONLY valid JSON, no markdown or extra text.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openaiModel,
          messages: [
            { role: 'system', content: 'You are an expert HR analyst. Provide concise, actionable insights in JSON format.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const insights = JSON.parse(jsonContent);

      return {
        keyHighlights: insights.keyHighlights || [],
        weaknesses: insights.weaknesses || [],
        overallFit: insights.overallFit || 'average'
      };
    } catch (error) {
      console.error('Error generating OpenAI insights:', error.response?.data || error.message);
      return this.generateRuleBasedInsights(jobPosting, candidate, skillsMatch, experienceMatch);
    }
  }

  /**
   * Generate rule-based insights (fallback)
   */
  generateRuleBasedInsights(jobPosting, candidate, skillsMatch, experienceMatch) {
    const highlights = [];
    const weaknesses = [];
    
    // Analyze skills
    if (skillsMatch.matchPercentage >= 80) {
      highlights.push(`Strong skill match: ${skillsMatch.matchPercentage}% of required skills`);
    } else if (skillsMatch.matchPercentage >= 60) {
      highlights.push(`Good skill match: ${skillsMatch.matchPercentage}% of required skills`);
    } else {
      weaknesses.push(`Limited skill match: Only ${skillsMatch.matchPercentage}% of required skills`);
    }
    
    // Analyze experience
    if (experienceMatch.isMatch) {
      highlights.push(`Experience aligns well with requirements (${experienceMatch.candidateYears} years)`);
    } else {
      weaknesses.push(`Experience mismatch: Has ${experienceMatch.candidateYears} years, requires ${experienceMatch.requiredYears}`);
    }
    
    // Analyze matched skills
    if (skillsMatch.matched.length > 0) {
      highlights.push(`Proficient in: ${skillsMatch.matched.slice(0, 3).join(', ')}`);
    }
    
    // Analyze missing skills
    if (skillsMatch.missing.length > 0) {
      weaknesses.push(`Missing skills: ${skillsMatch.missing.slice(0, 3).join(', ')}`);
    }
    
    // Additional highlights
    if (candidate.currentCompany) {
      highlights.push(`Currently working at ${candidate.currentCompany}`);
    }
    
    if (candidate.education && candidate.education.length > 0) {
      const degrees = candidate.education.map(e => e.degree).join(', ');
      highlights.push(`Education: ${degrees}`);
    }
    
    // Determine overall fit
    let overallFit = 'average';
    if (skillsMatch.matchPercentage >= 80 && experienceMatch.score >= 80) {
      overallFit = 'excellent';
    } else if (skillsMatch.matchPercentage >= 60 && experienceMatch.score >= 60) {
      overallFit = 'good';
    } else if (skillsMatch.matchPercentage < 40 || experienceMatch.score < 40) {
      overallFit = 'poor';
    }
    
    return {
      keyHighlights: highlights.slice(0, 5),
      weaknesses: weaknesses.slice(0, 3),
      overallFit
    };
  }

  /**
   * Calculate overall match score
   */
  calculateMatchScore(skillsMatch, experienceMatch, semanticScore = 0) {
    const weights = {
      skills: 0.5,
      experience: 0.3,
      semantic: 0.2
    };
    
    const skillScore = skillsMatch.matchPercentage;
    const expScore = experienceMatch.score;
    
    const matchScore = 
      (skillScore * weights.skills) +
      (expScore * weights.experience) +
      (semanticScore * weights.semantic);
    
    return Math.round(matchScore);
  }

  /**
   * Main method to analyze a candidate for a job
   */
  async analyzeCandidate(candidate, jobPosting) {
    try {
      // Build candidate profile text for semantic analysis
      const candidateProfile = `
        ${candidate.firstName} ${candidate.lastName}
        Experience: ${candidate.experience?.years || 0} years ${candidate.experience?.months || 0} months
        Current Role: ${candidate.currentDesignation || ''}
        Skills: ${candidate.skills?.join(', ') || ''}
        Education: ${candidate.education?.map(e => `${e.degree} in ${e.specialization}`).join(', ') || ''}
      `.trim();
      
      const jobDescription = `
        ${jobPosting.title}
        ${jobPosting.description}
        Required Skills: ${jobPosting.skills?.join(', ') || ''}
        Requirements: ${jobPosting.requirements?.join(', ') || ''}
      `.trim();
      
      // Perform analyses
      const skillsMatch = this.analyzeSkillsMatch(jobPosting.skills, candidate.skills);
      const experienceMatch = this.analyzeExperienceMatch(jobPosting.experience, candidate.experience);
      
      // Calculate semantic similarity (if OpenAI is available)
      let semanticScore = 0;
      try {
        semanticScore = await this.calculateSemanticSimilarity(jobDescription, candidateProfile);
      } catch (error) {
        console.log('Semantic analysis not available, using keyword-based matching');
      }
      
      // Generate AI insights
      const insights = await this.generateAIInsights(jobPosting, candidate, skillsMatch, experienceMatch);
      
      // Calculate overall match score
      const matchScore = this.calculateMatchScore(skillsMatch, experienceMatch, semanticScore);
      
      // Extract resume insights
      const resumeInsights = {
        totalExperience: `${candidate.experience?.years || 0}y ${candidate.experience?.months || 0}m`,
        keySkills: candidate.skills?.slice(0, 10) || [],
        education: candidate.education?.map(e => `${e.degree} - ${e.specialization}`) || [],
        certifications: [], // Can be enhanced with resume parsing
        projects: [] // Can be enhanced with resume parsing
      };
      
      return {
        matchScore,
        analysisDate: new Date(),
        skillsMatch,
        experienceMatch,
        keyHighlights: insights.keyHighlights,
        weaknesses: insights.weaknesses,
        overallFit: insights.overallFit,
        resumeInsights,
        semanticScore,
        isAnalyzed: true
      };
    } catch (error) {
      console.error('Error analyzing candidate:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple candidates
   */
  async analyzeCandidatesBatch(candidates, jobPosting, options = {}) {
    const { concurrency = 3 } = options;
    const results = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(candidate => this.analyzeCandidate(candidate, jobPosting))
      );
      
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + concurrency < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

module.exports = new AIService();
