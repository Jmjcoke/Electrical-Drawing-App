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
export declare class PromptService {
    private templates;
    constructor();
    /**
     * Register a new template
     */
    registerTemplate(template: PromptTemplate): void;
    /**
     * Get a template by name
     */
    getTemplate(name: string): PromptTemplate | undefined;
    /**
     * List all available templates
     */
    listTemplates(): PromptTemplate[];
    /**
     * Generate a prompt from a template with variables
     */
    generatePrompt(templateName: string, variables?: TemplateVariables): string;
    /**
     * Validate that all required variables are provided
     */
    validateVariables(templateName: string, variables: TemplateVariables): void;
    /**
     * Get templates by domain
     */
    getTemplatesByDomain(domain: 'electrical' | 'general'): PromptTemplate[];
    private loadDefaultTemplates;
    private validateTemplate;
    private interpolateVariables;
    private extractVariablesFromTemplate;
}
//# sourceMappingURL=prompt.service.d.ts.map