# Sample Files for Testing

This directory contains sample files for testing the symbol extraction workflow.

## electrical-symbols-legend.pdf

This file should contain:
- Common electrical symbols (circuit breakers, motors, transformers, etc.)
- Clear symbol descriptions
- Standard reference (NEC, IEC, etc.)
- High-resolution images (300 DPI minimum)

## How to Create Test PDFs

1. Use manufacturer catalogs (Schneider Electric, ABB, Siemens)
2. Standard reference sheets (NEC, IEC 60617)
3. Training materials from electrical courses

## Sample Symbol Categories

- Protection Devices (Circuit breakers, fuses, relays)
- Motors & Generators
- Transformers
- Switches & Disconnects
- Power Distribution
- Control Devices
- Lighting & Receptacles
- Grounding & Bonding

## Testing Workflow

1. Upload the sample PDF in the test page
2. Start extraction in mock mode (no API calls)
3. Review extracted symbols
4. Switch to live mode with configured API keys
5. Compare results between mock and live extraction