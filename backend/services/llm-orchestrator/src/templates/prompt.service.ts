/**
 * Prompt template management service for electrical drawing analysis
 */

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
  domain: 'electrical' | 'general';
  description: string;
  version: string;
}

export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

export class PromptService {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  /**
   * Register a new template
   */
  registerTemplate(template: PromptTemplate): void {
    this.validateTemplate(template);
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * List all available templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Generate a prompt from a template with variables
   */
  generatePrompt(templateName: string, variables: TemplateVariables = {}): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.interpolateVariables(template.template, variables);
  }

  /**
   * Validate that all required variables are provided
   */
  validateVariables(templateName: string, variables: TemplateVariables): void {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const missingVariables = template.variables.filter(
      variable => !(variable in variables)
    );

    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables for template '${templateName}': ${missingVariables.join(', ')}`
      );
    }
  }

  /**
   * Get templates by domain
   */
  getTemplatesByDomain(domain: 'electrical' | 'general'): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.domain === domain
    );
  }

  private loadDefaultTemplates(): void {
    // Default electrical analysis templates
    this.registerTemplate({
      name: 'component_identification',
      template: `You are an expert electrical engineer analyzing electrical schematic drawings. 

Please analyze the provided electrical schematic image(s) and identify all electrical components visible in the drawing. For each component you identify, provide:

1. Component Type (e.g., resistor, capacitor, inductor, transistor, IC, connector, etc.)
2. Component Value (if visible, e.g., resistance value, capacitance value)
3. Component Designation/Reference (if visible, e.g., R1, C2, U3)
4. Location Description (general position in the schematic)
5. Any notable characteristics or specifications visible

Please be thorough and systematic in your analysis. If you cannot clearly identify a component, please indicate what you can observe about it.

Format your response as a clear, organized list of components.`,
      variables: [],
      domain: 'electrical',
      description: 'Identifies electrical components in schematic drawings',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'general_analysis',
      template: `You are an expert electrical engineer analyzing electrical schematic drawings.

Please analyze the provided electrical schematic image(s) and answer the following question:

{{question}}

Provide a detailed, technical response based on your analysis of the schematic. Include specific references to components, connections, and circuit behavior where relevant.`,
      variables: ['question'],
      domain: 'electrical',
      description: 'General electrical analysis with custom question',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'circuit_analysis',
      template: `You are an expert electrical engineer analyzing electrical circuit diagrams.

Please analyze the provided electrical circuit image(s) and provide:

1. Circuit Type and Purpose: What type of circuit is this and what is its intended function?
2. Circuit Topology: Describe the overall structure and signal flow
3. Key Components: List the most important components and their roles
4. Operating Principles: Explain how the circuit works
5. Input/Output Analysis: Identify inputs, outputs, and their characteristics
6. Power Supply Requirements: Note any power supply connections or requirements
7. Potential Issues: Any obvious design concerns or areas that might need attention

Please provide a comprehensive technical analysis suitable for an electrical engineering context.`,
      variables: [],
      domain: 'electrical',
      description: 'Comprehensive circuit analysis and explanation',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'troubleshooting',
      template: `You are an expert electrical engineer helping with circuit troubleshooting.

Please analyze the provided electrical schematic image(s) in the context of the following problem:

Problem Description: {{problem_description}}

Provide a systematic troubleshooting approach including:

1. Potential Root Causes: List possible causes for the described problem
2. Test Points: Suggest specific points in the circuit to measure/test
3. Expected Values: What values should be expected at these test points
4. Diagnostic Steps: Step-by-step troubleshooting procedure
5. Common Failure Modes: Components or connections that commonly fail in this type of circuit
6. Safety Considerations: Any safety precautions to take during troubleshooting

Base your analysis on the actual circuit shown in the schematic.`,
      variables: ['problem_description'],
      domain: 'electrical',
      description: 'Circuit troubleshooting and diagnostic guidance',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'pcb_analysis',
      template: `You are an expert electrical engineer analyzing printed circuit board (PCB) layouts.

Please analyze the provided PCB image(s) and provide:

1. PCB Type: Single-layer, double-layer, or multi-layer
2. Component Placement: Major IC packages, connectors, and component types
3. Trace Routing: Analysis of trace widths, routing patterns, and signal integrity considerations
4. Power Distribution: Power planes, ground planes, and power supply circuits
5. Manufacturing Quality: Solder mask, silk screen, via quality, and any visible defects
6. Design Practices: Adherence to PCB design best practices and standards

Provide technical insights suitable for PCB design and manufacturing evaluation.`,
      variables: [],
      domain: 'electrical',
      description: 'PCB layout and manufacturing analysis',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'power_supply_analysis',
      template: `You are an expert electrical engineer analyzing power supply circuits.

Please analyze the provided power supply schematic image(s) and provide:

1. Power Supply Type: Linear, switching, battery management, etc.
2. Input/Output Specifications: Voltage levels, current ratings, efficiency
3. Topology Analysis: Buck, boost, flyback, forward converter, etc.
4. Control Method: PWM, PFM, linear regulation analysis
5. Protection Circuits: Overcurrent, overvoltage, thermal protection
6. Component Analysis: Key semiconductors, magnetics, and passive components
7. Ripple and Noise: Expected performance characteristics

Provide detailed technical analysis for power supply design evaluation.`,
      variables: [],
      domain: 'electrical',
      description: 'Power supply circuit analysis and design evaluation',
      version: '1.0.0'
    });

    this.registerTemplate({
      name: 'basic_image_analysis',
      template: `Please analyze the provided image(s) and describe what you see. Be specific and detailed in your observations.

{{additional_instructions}}`,
      variables: ['additional_instructions'],
      domain: 'general',
      description: 'Basic image analysis for any type of image',
      version: '1.0.0'
    });
  }

  private validateTemplate(template: PromptTemplate): void {
    if (!template.name || template.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (!template.template || template.template.trim().length === 0) {
      throw new Error('Template content is required');
    }

    if (!template.domain || !['electrical', 'general'].includes(template.domain)) {
      throw new Error('Template domain must be "electrical" or "general"');
    }

    // Validate that all variables in the template are declared in the variables array
    const templateVariables = this.extractVariablesFromTemplate(template.template);
    const undeclaredVariables = templateVariables.filter(
      variable => !template.variables.includes(variable)
    );

    if (undeclaredVariables.length > 0) {
      throw new Error(
        `Template '${template.name}' contains undeclared variables: ${undeclaredVariables.join(', ')}`
      );
    }
  }

  private interpolateVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace {{variable}} patterns with actual values
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(pattern, String(value));
    }

    // Check for any remaining unreplaced variables
    const remainingVariables = this.extractVariablesFromTemplate(result);
    if (remainingVariables.length > 0) {
      throw new Error(
        `Template contains unreplaced variables: ${remainingVariables.join(', ')}`
      );
    }

    return result;
  }

  private extractVariablesFromTemplate(template: string): string[] {
    const variablePattern = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }
}