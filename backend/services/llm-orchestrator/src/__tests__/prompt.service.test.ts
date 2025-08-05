/**
 * Prompt service unit tests
 */

import { PromptService, PromptTemplate } from '../templates/prompt.service';

describe('PromptService', () => {
  let promptService: PromptService;

  beforeEach(() => {
    promptService = new PromptService();
  });

  describe('constructor', () => {
    it('should load default templates', () => {
      const templates = promptService.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      
      // Check that default templates are loaded
      expect(templates.some(t => t.name === 'component_identification')).toBe(true);
      expect(templates.some(t => t.name === 'general_analysis')).toBe(true);
      expect(templates.some(t => t.name === 'circuit_analysis')).toBe(true);
    });
  });

  describe('registerTemplate', () => {
    const validTemplate: PromptTemplate = {
      name: 'test_template',
      template: 'Test template with {{variable}}',
      variables: ['variable'],
      domain: 'electrical',
      description: 'A test template',
      version: '1.0.0',
    };

    it('should register a valid template', () => {
      promptService.registerTemplate(validTemplate);
      const retrieved = promptService.getTemplate('test_template');
      
      expect(retrieved).toEqual(validTemplate);
    });

    it('should throw error for template with empty name', () => {
      const invalidTemplate = { ...validTemplate, name: '' };
      
      expect(() => promptService.registerTemplate(invalidTemplate))
        .toThrow('Template name is required');
    });

    it('should throw error for template with empty content', () => {
      const invalidTemplate = { ...validTemplate, template: '' };
      
      expect(() => promptService.registerTemplate(invalidTemplate))
        .toThrow('Template content is required');
    });

    it('should throw error for template with invalid domain', () => {
      const invalidTemplate = { ...validTemplate, domain: 'invalid' as any };
      
      expect(() => promptService.registerTemplate(invalidTemplate))
        .toThrow('Template domain must be "electrical" or "general"');
    });

    it('should throw error for template with undeclared variables', () => {
      const invalidTemplate = { 
        ...validTemplate, 
        template: 'Template with {{undeclared}} variable',
        variables: ['variable'] // missing 'undeclared'
      };
      
      expect(() => promptService.registerTemplate(invalidTemplate))
        .toThrow('contains undeclared variables: undeclared');
    });
  });

  describe('getTemplate', () => {
    it('should return existing template', () => {
      const template = promptService.getTemplate('component_identification');
      expect(template).toBeDefined();
      expect(template?.name).toBe('component_identification');
    });

    it('should return undefined for non-existent template', () => {
      const template = promptService.getTemplate('non_existent');
      expect(template).toBeUndefined();
    });
  });

  describe('listTemplates', () => {
    it('should return all templates', () => {
      const templates = promptService.listTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplatesByDomain', () => {
    it('should return only electrical templates', () => {
      const electricalTemplates = promptService.getTemplatesByDomain('electrical');
      
      expect(electricalTemplates.every(t => t.domain === 'electrical')).toBe(true);
      expect(electricalTemplates.length).toBeGreaterThan(0);
    });

    it('should return only general templates', () => {
      const generalTemplates = promptService.getTemplatesByDomain('general');
      
      expect(generalTemplates.every(t => t.domain === 'general')).toBe(true);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt without variables', () => {
      const prompt = promptService.generatePrompt('component_identification');
      
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).not.toContain('{{');
      expect(prompt).not.toContain('}}');
    });

    it('should generate prompt with variables', () => {
      const variables = { question: 'What is the purpose of this circuit?' };
      const prompt = promptService.generatePrompt('general_analysis', variables);
      
      expect(prompt).toContain('What is the purpose of this circuit?');
      expect(prompt).not.toContain('{{question}}');
    });

    it('should throw error for non-existent template', () => {
      expect(() => promptService.generatePrompt('non_existent'))
        .toThrow('Template \'non_existent\' not found');
    });

    it('should throw error for missing required variables', () => {
      expect(() => promptService.generatePrompt('general_analysis', {}))
        .toThrow('Template contains unreplaced variables: question');
    });

    it('should handle multiple variables', () => {
      // Register a template with multiple variables
      const multiVarTemplate: PromptTemplate = {
        name: 'multi_var_test',
        template: 'Hello {{name}}, you are {{age}} years old and work as {{job}}.',
        variables: ['name', 'age', 'job'],
        domain: 'general',
        description: 'Test template with multiple variables',
        version: '1.0.0',
      };
      
      promptService.registerTemplate(multiVarTemplate);
      
      const variables = {
        name: 'John',
        age: 30,
        job: 'engineer'
      };
      
      const prompt = promptService.generatePrompt('multi_var_test', variables);
      
      expect(prompt).toBe('Hello John, you are 30 years old and work as engineer.');
    });
  });

  describe('validateVariables', () => {
    it('should not throw for valid variables', () => {
      const variables = { question: 'Test question' };
      
      expect(() => promptService.validateVariables('general_analysis', variables))
        .not.toThrow();
    });

    it('should throw for missing required variables', () => {
      expect(() => promptService.validateVariables('general_analysis', {}))
        .toThrow('Missing required variables for template \'general_analysis\': question');
    });

    it('should throw for non-existent template', () => {
      expect(() => promptService.validateVariables('non_existent', {}))
        .toThrow('Template \'non_existent\' not found');
    });

    it('should handle templates with no variables', () => {
      expect(() => promptService.validateVariables('component_identification', {}))
        .not.toThrow();
    });
  });

  describe('variable extraction and interpolation', () => {
    it('should handle variables with spaces', () => {
      const template: PromptTemplate = {
        name: 'space_test',
        template: 'Value: {{spaced_var}}',
        variables: ['spaced_var'],
        domain: 'general',
        description: 'Test template with spaced variables',
        version: '1.0.0',
      };
      
      promptService.registerTemplate(template);
      
      const prompt = promptService.generatePrompt('space_test', { spaced_var: 'test value' });
      expect(prompt).toBe('Value: test value');
    });

    it('should handle boolean and number variables', () => {
      const template: PromptTemplate = {
        name: 'type_test',
        template: 'Enabled: {{enabled}}, Count: {{count}}',
        variables: ['enabled', 'count'],
        domain: 'general',
        description: 'Test template with different types',
        version: '1.0.0',
      };
      
      promptService.registerTemplate(template);
      
      const prompt = promptService.generatePrompt('type_test', { 
        enabled: true, 
        count: 42 
      });
      
      expect(prompt).toBe('Enabled: true, Count: 42');
    });

    it('should handle repeated variables', () => {
      const template: PromptTemplate = {
        name: 'repeat_test',
        template: 'Name: {{name}}, Hello {{name}}!',
        variables: ['name'],
        domain: 'general',
        description: 'Test template with repeated variables',
        version: '1.0.0',
      };
      
      promptService.registerTemplate(template);
      
      const prompt = promptService.generatePrompt('repeat_test', { name: 'Alice' });
      expect(prompt).toBe('Name: Alice, Hello Alice!');
    });
  });
});