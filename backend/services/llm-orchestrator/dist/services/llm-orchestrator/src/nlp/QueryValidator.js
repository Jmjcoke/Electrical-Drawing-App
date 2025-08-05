"use strict";
/**
 * QueryValidator - Input validation and sanitization service
 * Prevents XSS, injection attacks, and inappropriate content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryValidator = void 0;
class QueryValidator {
    constructor(config) {
        // Security patterns for various attack types
        this.securityPatterns = {
            xss: [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<iframe\b[^>]*>/gi,
                /<object\b[^>]*>/gi,
                /<embed\b[^>]*>/gi,
                /<link\b[^>]*>/gi,
                /<meta\b[^>]*>/gi
            ],
            injection: [
                /('|(\\')|(;))/g, // SQL injection patterns
                /(union\s+select)/gi,
                /(drop\s+table)/gi,
                /(insert\s+into)/gi,
                /(delete\s+from)/gi,
                /(update\s+set)/gi,
                /(\|\||&&|\||\$\()/g, // Command injection
                /(exec\s*\()/gi,
                /(eval\s*\()/gi
            ],
            profanity: [
                // Basic profanity patterns - in production would use a more comprehensive list
                /\b(damn|hell|crap|stupid|idiot)\b/gi
            ],
            inappropriate: [
                /\b(hack|crack|exploit|bypass|inject)\b/gi,
                /\b(password|login|admin|root|sudo)\b/gi
            ],
            malicious: [
                /(\.\.\/){2,}/g, // Path traversal
                /\b(rm\s+-rf|del\s+\/|format\s+c:)/gi, // Destructive commands
                /\b(wget|curl|nc|netcat)\b/gi // Network tools
            ]
        };
        // Electrical profanity exceptions (technical terms that might be flagged)
        this.technicalExceptions = [
            'short', 'ground', 'fault', 'dead', 'kill', 'dump', 'load', 'spike',
            'surge', 'breakdown', 'collapse', 'crash', 'failure', 'attack'
        ];
        this.config = config;
        this.stats = {
            totalValidations: 0,
            validQueries: 0,
            blockedQueries: 0,
            sanitizedQueries: 0,
            averageSecurityScore: 0,
            flaggedContentTypes: {}
        };
    }
    /**
     * Validate and sanitize query input
     * @param queryText - Raw query text from user
     * @returns Validation result with sanitized text and security assessment
     */
    async validate(queryText) {
        this.stats.totalValidations++;
        try {
            // Step 1: Basic validation
            if (!queryText || typeof queryText !== 'string') {
                return this.createBlockedResult('Invalid input type', 'malicious');
            }
            // Step 2: Length validation
            if (queryText.length > this.config.maxQueryLength) {
                return this.createBlockedResult(`Query exceeds maximum length of ${this.config.maxQueryLength} characters`, 'malicious');
            }
            if (queryText.trim().length === 0) {
                return this.createBlockedResult('Empty query not allowed', 'malicious');
            }
            // Step 3: Pattern-based security scanning
            const flaggedContent = [];
            let sanitizedText = queryText;
            for (const [contentType, patterns] of Object.entries(this.securityPatterns)) {
                for (const pattern of patterns) {
                    const matches = Array.from(queryText.matchAll(pattern));
                    for (const match of matches) {
                        if (match.index !== undefined && match[0]) {
                            // Check if this is a technical exception
                            if (contentType === 'profanity' && this.isTechnicalException(match[0])) {
                                continue;
                            }
                            const severity = this.getSeverityLevel(contentType, match[0]);
                            const action = this.getRequiredAction(severity);
                            const flagged = {
                                type: contentType,
                                content: match[0],
                                position: {
                                    start: match.index,
                                    end: match.index + match[0].length
                                },
                                severity,
                                action
                            };
                            flaggedContent.push(flagged);
                            // Apply sanitization if enabled
                            if (this.config.enableSanitization && action !== 'block') {
                                sanitizedText = this.applySanitization(sanitizedText, flagged);
                            }
                        }
                    }
                }
            }
            // Step 4: Check for blocked patterns from config
            for (const blockedPattern of this.config.blockedPatterns) {
                const regex = new RegExp(blockedPattern, 'gi');
                if (regex.test(queryText)) {
                    return this.createBlockedResult(`Query contains blocked pattern: ${blockedPattern}`, 'malicious');
                }
            }
            // Step 5: Calculate security score
            const securityScore = this.calculateSecurityScore(flaggedContent, queryText);
            // Step 6: Determine if query should be blocked
            const criticalFlags = flaggedContent.filter(f => f.severity === 'critical');
            const highFlags = flaggedContent.filter(f => f.severity === 'high');
            const shouldBlock = criticalFlags.length > 0 || highFlags.length > 2;
            if (shouldBlock) {
                this.stats.blockedQueries++;
                return {
                    isValid: false,
                    sanitizedText: '',
                    flaggedContent,
                    securityScore
                };
            }
            // Step 7: Final sanitization pass
            if (this.config.enableSanitization) {
                sanitizedText = this.performFinalSanitization(sanitizedText);
                if (sanitizedText !== queryText) {
                    this.stats.sanitizedQueries++;
                }
            }
            // Update statistics
            this.stats.validQueries++;
            this.updateSecurityStats(securityScore, flaggedContent);
            return {
                isValid: true,
                sanitizedText,
                flaggedContent,
                securityScore
            };
        }
        catch (error) {
            console.error('[QueryValidator] Validation error:', error);
            // Fail safely by blocking the query
            this.stats.blockedQueries++;
            return this.createBlockedResult('Validation error occurred', 'malicious');
        }
    }
    /**
     * Create a blocked validation result
     */
    createBlockedResult(reason, type) {
        return {
            isValid: false,
            sanitizedText: '',
            flaggedContent: [{
                    type,
                    content: reason,
                    position: { start: 0, end: 0 },
                    severity: 'critical',
                    action: 'block'
                }],
            securityScore: 0
        };
    }
    /**
     * Check if flagged content is a technical exception
     */
    isTechnicalException(content) {
        const lowerContent = content.toLowerCase();
        return this.technicalExceptions.some(exception => lowerContent.includes(exception));
    }
    /**
     * Determine severity level for flagged content
     */
    getSeverityLevel(contentType, content) {
        switch (contentType) {
            case 'xss':
                return content.includes('script') || content.includes('javascript:') ? 'critical' : 'high';
            case 'injection':
                if (/drop\s+table|delete\s+from|rm\s+-rf/gi.test(content)) {
                    return 'critical';
                }
                return content.includes('union') || content.includes('exec') ? 'high' : 'medium';
            case 'malicious':
                return content.includes('../') || /rm\s+-rf/gi.test(content) ? 'critical' : 'high';
            case 'inappropriate':
                return content.includes('password') || content.includes('admin') ? 'medium' : 'low';
            case 'profanity':
                return 'low';
            default:
                return 'medium';
        }
    }
    /**
     * Determine required action for flagged content
     */
    getRequiredAction(severity) {
        switch (severity) {
            case 'critical':
                return 'block';
            case 'high':
                return 'remove';
            case 'medium':
                return 'sanitize';
            case 'low':
                return 'sanitize';
            default:
                return 'sanitize';
        }
    }
    /**
     * Apply sanitization to flagged content
     */
    applySanitization(text, flagged) {
        switch (flagged.action) {
            case 'remove':
                return text.substring(0, flagged.position.start) +
                    text.substring(flagged.position.end);
            case 'sanitize':
                const replacement = '*'.repeat(flagged.content.length);
                return text.substring(0, flagged.position.start) +
                    replacement +
                    text.substring(flagged.position.end);
            default:
                return text;
        }
    }
    /**
     * Perform final sanitization pass
     */
    performFinalSanitization(text) {
        let sanitized = text;
        // Remove HTML tags (except safe ones for electrical notation)
        sanitized = sanitized.replace(/<(?!\/?[bi]>)[^>]*>/gi, '');
        // Normalize whitespace
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
        // Limit repeated characters (potential DoS)
        sanitized = sanitized.replace(/(.)\1{4,}/g, '$1$1$1');
        return sanitized;
    }
    /**
     * Calculate overall security score (0-1, higher is more secure)
     */
    calculateSecurityScore(flaggedContent, originalText) {
        let score = 1.0; // Start with perfect score
        // Deduct points for flagged content
        for (const flag of flaggedContent) {
            switch (flag.severity) {
                case 'critical':
                    score -= 0.5;
                    break;
                case 'high':
                    score -= 0.3;
                    break;
                case 'medium':
                    score -= 0.15;
                    break;
                case 'low':
                    score -= 0.05;
                    break;
            }
        }
        // Deduct points for suspicious patterns
        const suspiciousPatterns = [
            /[<>{}[\]]/g, // Special characters
            /\s{10,}/, // Excessive whitespace
            /(.)\1{3,}/ // Repeated characters
        ];
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(originalText)) {
                score -= 0.1;
            }
        }
        // Boost score for typical electrical engineering queries
        const technicalPatterns = [
            /\b(voltage|current|resistance|capacitor|resistor|circuit)\b/gi,
            /\b(analyze|calculate|measure|design|troubleshoot)\b/gi
        ];
        let technicalTerms = 0;
        for (const pattern of technicalPatterns) {
            const matches = originalText.match(pattern);
            if (matches) {
                technicalTerms += matches.length;
            }
        }
        if (technicalTerms > 0) {
            score += Math.min(technicalTerms * 0.05, 0.2);
        }
        return Math.max(0, Math.min(score, 1.0));
    }
    /**
     * Update security statistics
     */
    updateSecurityStats(securityScore, flaggedContent) {
        // Update average security score
        const oldAvg = this.stats.averageSecurityScore;
        this.stats.averageSecurityScore = (oldAvg * (this.stats.totalValidations - 1) + securityScore) / this.stats.totalValidations;
        // Update flagged content type distribution
        for (const flag of flaggedContent) {
            this.stats.flaggedContentTypes[flag.type] = (this.stats.flaggedContentTypes[flag.type] || 0) + 1;
        }
    }
    /**
     * Get validation statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Health check for validator
     */
    async healthCheck() {
        try {
            const testResult = await this.validate("What is the voltage across R1?");
            return testResult.isValid && testResult.securityScore > 0.5;
        }
        catch {
            return false;
        }
    }
    /**
     * Add custom blocked pattern
     */
    addBlockedPattern(pattern) {
        if (!this.config.blockedPatterns.includes(pattern)) {
            this.config.blockedPatterns.push(pattern);
        }
    }
    /**
     * Remove blocked pattern
     */
    removeBlockedPattern(pattern) {
        const index = this.config.blockedPatterns.indexOf(pattern);
        if (index > -1) {
            this.config.blockedPatterns.splice(index, 1);
        }
    }
    /**
     * Get current validation configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.QueryValidator = QueryValidator;
//# sourceMappingURL=QueryValidator.js.map