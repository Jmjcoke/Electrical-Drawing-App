"use strict";
/**
 * Domain-specific electrical engineering prompt templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ELECTRICAL_TEMPLATES = void 0;
exports.ELECTRICAL_TEMPLATES = [
    {
        name: 'pcb_analysis',
        template: `You are an expert PCB design engineer analyzing a printed circuit board layout.

Please analyze the provided PCB image(s) and provide:

1. Board Overview: Describe the overall PCB layout and complexity
2. Layer Analysis: Identify visible layers (top, bottom, internal if visible)
3. Component Placement: Describe the arrangement and density of components
4. Routing Quality: Comment on trace routing, spacing, and design quality
5. Manufacturing Considerations: Note any potential manufacturing challenges
6. Design Rule Compliance: Identify any obvious design rule violations
7. Special Features: Note any special PCB features (flex sections, embedded components, etc.)

Provide a professional PCB design review suitable for engineering documentation.`,
        variables: [],
        domain: 'electrical',
        description: 'PCB layout and design analysis',
        version: '1.0.0'
    },
    {
        name: 'power_supply_analysis',
        template: `You are an expert power electronics engineer analyzing a power supply circuit.

Please analyze the provided power supply schematic image(s) and provide:

1. Power Supply Type: Identify the topology (linear, switching, etc.)
2. Input Specifications: Input voltage range and requirements
3. Output Specifications: Output voltage(s), current capability, regulation
4. Key Components: Critical components and their functions
5. Control Method: How regulation/control is achieved
6. Efficiency Considerations: Design choices affecting efficiency
7. Protection Features: Overcurrent, overvoltage, thermal protection
8. Performance Characteristics: Expected ripple, transient response, etc.

Focus on power conversion principles and performance characteristics.`,
        variables: [],
        domain: 'electrical',
        description: 'Power supply circuit analysis and design review',
        version: '1.0.0'
    },
    {
        name: 'signal_integrity_analysis',
        template: `You are an expert signal integrity engineer analyzing high-speed digital circuits.

Please analyze the provided circuit image(s) with focus on signal integrity:

1. Signal Types: Identify high-speed signals and their characteristics
2. Routing Analysis: Evaluate trace routing for signal integrity
3. Termination: Check for proper termination techniques
4. Crosstalk Concerns: Identify potential crosstalk issues
5. Power Delivery: Evaluate power distribution for clean signals
6. Ground Strategy: Analyze grounding and return path integrity
7. EMI/EMC Considerations: Note potential electromagnetic compatibility issues
8. Recommendations: Suggest improvements for signal integrity

Provide analysis from a high-speed digital design perspective.`,
        variables: [],
        domain: 'electrical',
        description: 'Signal integrity and high-speed digital circuit analysis',
        version: '1.0.0'
    },
    {
        name: 'motor_control_analysis',
        template: `You are an expert motor control engineer analyzing motor drive circuits.

Please analyze the provided motor control circuit image(s) and provide:

1. Motor Type: Identify the type of motor being controlled
2. Control Method: Describe the control strategy (PWM, vector control, etc.)
3. Power Stage: Analyze the power switching components
4. Feedback Systems: Identify position, speed, or current feedback
5. Protection Circuits: Note motor and drive protection features
6. Control Interface: Describe command and communication interfaces
7. Performance Characteristics: Expected motor performance capabilities
8. Safety Features: Emergency stop, fault detection, and safety systems

Focus on motor control principles and drive performance.`,
        variables: [],
        domain: 'electrical',
        description: 'Motor control and drive circuit analysis',
        version: '1.0.0'
    },
    {
        name: 'analog_circuit_analysis',
        template: `You are an expert analog circuit designer analyzing analog electronic circuits.

Please analyze the provided analog circuit image(s) and provide:

1. Circuit Function: Primary purpose and application of the circuit
2. Signal Path: Trace the signal flow through the circuit
3. Gain and Frequency Response: Analyze amplification and bandwidth
4. Bias and Operating Point: Evaluate DC operating conditions
5. Stability Analysis: Consider stability margins and compensation
6. Noise Performance: Identify noise sources and mitigation
7. Linearity and Distortion: Evaluate signal integrity through the chain
8. Component Tolerances: Consider component variation effects

Provide detailed analog circuit analysis suitable for design verification.`,
        variables: [],
        domain: 'electrical',
        description: 'Analog circuit design analysis and verification',
        version: '1.0.0'
    },
    {
        name: 'safety_compliance_check',
        template: `You are an electrical safety engineer reviewing circuit designs for compliance.

Please analyze the provided electrical circuit image(s) for safety compliance:

Safety Standards Context: {{safety_standards}}

Provide analysis covering:

1. Electrical Safety: Isolation, creepage, and clearance distances
2. Grounding: Protective earth connections and safety grounding
3. Overcurrent Protection: Fuses, circuit breakers, and current limiting
4. Voltage Protection: Surge protection and overvoltage safeguards
5. Insulation Requirements: Basic and supplementary insulation
6. User Safety: Protection against electrical shock and hazards
7. Component Ratings: Verify components meet safety requirements
8. Compliance Gaps: Identify potential safety standard violations

Focus on electrical safety and regulatory compliance requirements.`,
        variables: ['safety_standards'],
        domain: 'electrical',
        description: 'Electrical safety and compliance analysis',
        version: '1.0.0'
    },
    {
        name: 'electromagnetic_compatibility',
        template: `You are an EMC (Electromagnetic Compatibility) engineer analyzing circuit designs.

Please analyze the provided circuit image(s) for EMC considerations:

Application Environment: {{application_environment}}

Provide EMC analysis covering:

1. Emission Sources: Identify potential sources of electromagnetic emissions
2. Susceptibility Points: Find circuits sensitive to electromagnetic interference
3. Filtering: Evaluate EMI filters and suppression components
4. Shielding: Assess shielding effectiveness and requirements
5. Grounding Strategy: Analyze grounding for EMC performance
6. Cable Management: Consider cable routing and connector EMC features
7. Compliance Testing: Suggest EMC test points and measurement considerations
8. Design Improvements: Recommend EMC design enhancements

Focus on electromagnetic compatibility and interference mitigation.`,
        variables: ['application_environment'],
        domain: 'electrical',
        description: 'Electromagnetic compatibility and EMI analysis',
        version: '1.0.0'
    }
];
exports.default = exports.ELECTRICAL_TEMPLATES;
//# sourceMappingURL=electrical.templates.js.map