/**
 * Chat input validation utilities
 * Provides validation for user queries and chat input sanitization
 */

export interface ChatValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: string;
}

export interface ChatValidationOptions {
  minLength?: number;
  maxLength?: number;
  allowEmptyLines?: boolean;
  stripHtml?: boolean;
  checkForSpam?: boolean;
  requireDocuments?: boolean;
}

// Patterns for potentially problematic content
const SPAM_PATTERNS = [
  /(.)\1{10,}/g, // Repeated characters (10+ times)
  /[A-Z]{50,}/g, // Excessive caps
  /(.{1,50})\1{3,}/g, // Repeated phrases
];

const HTML_PATTERN = /<[^>]*>/g;
const SCRIPT_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
];

/**
 * Sanitize user input to prevent XSS and clean up content
 */
export const sanitizeInput = (input: string, options: ChatValidationOptions = {}): string => {
  const { stripHtml = true, allowEmptyLines = false } = options;
  
  let sanitized = input;

  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove script tags completely
  sanitized = sanitized.replace(SCRIPT_PATTERN, '');

  // Strip HTML tags if requested
  if (stripHtml) {
    sanitized = sanitized.replace(HTML_PATTERN, '');
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\r\n/g, '\n'); // Normalize line endings
  sanitized = sanitized.replace(/\t/g, ' '); // Replace tabs with spaces
  
  if (!allowEmptyLines) {
    sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Limit consecutive empty lines
  }

  // Trim excessive whitespace but preserve intentional formatting
  sanitized = sanitized.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Check if input appears to be spam or low-quality
 */
const checkForSpam = (input: string): string[] => {
  const warnings: string[] = [];
  
  SPAM_PATTERNS.forEach(pattern => {
    if (pattern.test(input)) {
      warnings.push('Message contains repetitive content');
    }
  });

  // Check for excessive punctuation
  const punctuationRatio = (input.match(/[!?.,;:]/g) || []).length / input.length;
  if (punctuationRatio > 0.3) {
    warnings.push('Message contains excessive punctuation');
  }

  // Check for very short repeated queries
  if (input.length < 10 && /^(.)\1+$/.test(input)) {
    warnings.push('Message appears to be spam');
  }

  return warnings;
};

/**
 * Validate content appropriateness for electrical drawing analysis
 */
const validateContentRelevance = (input: string): string[] => {
  const warnings: string[] = [];
  const lowerInput = input.toLowerCase();

  // Check for potentially inappropriate content
  const inappropriatePatterns = [
    /^(hi|hello|hey)\s*$/i,
    /^(test|testing)\s*$/i,
    /^(a|an|the)\s*$/i,
  ];

  if (inappropriatePatterns.some(pattern => pattern.test(input.trim()))) {
    warnings.push('Consider asking a specific question about your electrical drawings');
  }

  // Suggest more specific questions for vague queries
  const vaguePatterns = [
    /^(what|how|why|when|where)\s*\?*$/i,
    /^(explain|tell me|show me)\s*$/i,
  ];

  if (vaguePatterns.some(pattern => pattern.test(input.trim()))) {
    warnings.push('Try to be more specific about what you want to know');
  }

  return warnings;
};

/**
 * Generate helpful suggestions based on validation results
 */
export const generateSuggestions = (input: string, hasDocuments: boolean): string[] => {
  const suggestions: string[] = [];
  const lowerInput = input.toLowerCase();

  if (!hasDocuments) {
    suggestions.push('Upload an electrical drawing or schematic first');
    return suggestions;
  }

  // Suggest query types based on input content
  if (lowerInput.includes('component') || lowerInput.includes('part')) {
    suggestions.push('Try: "Identify all resistors in this circuit"');
    suggestions.push('Try: "What components are shown in this schematic?"');
  }

  if (lowerInput.includes('voltage') || lowerInput.includes('current') || lowerInput.includes('power')) {
    suggestions.push('Try: "What is the voltage rating of this circuit?"');
    suggestions.push('Try: "Calculate the power consumption of this design"');
  }

  if (lowerInput.includes('safety') || lowerInput.includes('error') || lowerInput.includes('problem')) {
    suggestions.push('Try: "Are there any safety concerns with this wiring?"');
    suggestions.push('Try: "Check for design violations in this schematic"');
  }

  if (lowerInput.includes('how') || lowerInput.includes('explain')) {
    suggestions.push('Try: "Explain how this circuit works"');
    suggestions.push('Try: "What is the purpose of this electrical system?"');
  }

  // If no specific suggestions, provide general ones
  if (suggestions.length === 0) {
    suggestions.push('Ask about specific components, connections, or functionality');
    suggestions.push('Request analysis of safety, performance, or design compliance');
  }

  return suggestions;
};

/**
 * Validate chat input with comprehensive checks
 */
export const validateChatInput = (
  input: string,
  options: ChatValidationOptions = {}
): ChatValidationResult => {
  const {
    minLength = 1,
    maxLength = 2000,
    checkForSpam = true,
    requireDocuments = false,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!input || typeof input !== 'string') {
    errors.push('Please enter a message');
    return { isValid: false, errors, warnings };
  }

  const trimmedInput = input.trim();
  
  if (trimmedInput.length === 0) {
    errors.push('Message cannot be empty');
    return { isValid: false, errors, warnings };
  }

  if (trimmedInput.length < minLength) {
    errors.push(`Message must be at least ${minLength} character${minLength > 1 ? 's' : ''} long`);
  }

  if (trimmedInput.length > maxLength) {
    errors.push(`Message must be no more than ${maxLength} characters long`);
  }

  // Sanitize input
  const sanitizedContent = sanitizeInput(trimmedInput, options);

  if (sanitizedContent.length === 0) {
    errors.push('Message contains only invalid characters');
    return { isValid: false, errors, warnings, sanitizedContent };
  }

  // Check for spam if enabled
  if (checkForSpam) {
    warnings.push(...checkForSpam(sanitizedContent));
  }

  // Check content relevance
  warnings.push(...validateContentRelevance(sanitizedContent));

  // Check for dangerous content
  if (DANGEROUS_PATTERNS.some(pattern => pattern.test(input))) {
    errors.push('Message contains potentially dangerous content');
  }

  // Document requirement check
  if (requireDocuments) {
    warnings.push('Upload electrical drawings to get more accurate analysis');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedContent
  };
};

/**
 * Format validation errors for user display
 */
export const formatChatValidationErrors = (validation: ChatValidationResult): string => {
  if (validation.isValid && validation.warnings.length === 0) {
    return '';
  }

  const parts: string[] = [];

  if (validation.errors.length > 0) {
    parts.push('Errors:');
    validation.errors.forEach((error, index) => {
      parts.push(`${index + 1}. ${error}`);
    });
  }

  if (validation.warnings.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('Suggestions:');
    validation.warnings.forEach((warning, index) => {
      parts.push(`${index + 1}. ${warning}`);
    });
  }

  return parts.join('\n');
};