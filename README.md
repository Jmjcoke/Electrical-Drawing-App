<<<<<<< HEAD
# ELECTRICAL ORCHESTRATOR

> AI-powered brownfield electrical estimation platform for oil & gas professionals

## Overview

The ELECTRICAL ORCHESTRATOR is an intelligent platform designed to revolutionize electrical estimation and project management in brownfield oil & gas operations. By combining computer vision, machine learning, and industry expertise, it transforms static PDF electrical drawings into interactive, analyzable digital assets with accurate man-hour estimates.

## Key Features

### 🔍 **Intelligent Circuit Analysis**
- Automated cloud detection in electrical drawings
- Circuit tracing and component identification
- Interactive PDF viewer with annotation capabilities

### 📊 **AI-Powered Estimation**
- Historical data integration and pattern matching
- Machine learning-based man-hour predictions
- Confidence scoring and range estimation

### 👥 **Role-Based Workflow**
- 7 specialized user roles (Electrical Leads, FCO Leads, Project Managers, Foremen, Electricians, etc.)
- Enterprise SSO integration (SAML/LDAP)
- Granular permission controls

### 📱 **Real-Time Tracking**
- Mobile-friendly hour logging interface
- Progress tracking against estimates
- Variance analysis and reporting

## Project Status

🚀 **Current Phase:** Foundation Development (Epic 1)  
📋 **Active Story:** 1.2 - User Authentication and Profile Management  
🏗️ **Methodology:** BMAD V3 (Breakthrough Method of Agile Development)

### Epic Roadmap
1. **Foundation Infrastructure & Authentication** ✅ *Architecture Complete*
2. **PDF Processing & Cloud Detection Engine** 📋 *Planned*
3. **Interactive Circuit Analysis & Component Intelligence** 📋 *Planned*
4. **Historical Data Integration & Estimation Engine** 📋 *Planned*
5. **Real-Time Project Tracking & Progress Management** 📋 *Planned*

## Architecture

### Technology Stack
- **Frontend:** React 18.3.x + Next.js 14.x + TypeScript 5.3.x
- **Backend:** Python 3.11.x + FastAPI (Microservices Architecture)
- **Database:** PostgreSQL + Redis + AWS S3
- **AI/ML:** AWS Textract, Computer Vision, Custom ML Models
- **Infrastructure:** AWS Cloud + Docker + Kubernetes

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   React Frontend │────│  FastAPI Gateway │────│  Microservices      │
│   (Next.js)     │    │                  │    │  - PDF Processing   │
└─────────────────┘    └──────────────────┘    │  - AI Analysis      │
                                               │  - Estimation       │
                                               │  - Authentication   │
                                               └─────────────────────┘
                                                         │
                                               ┌─────────────────────┐
                                               │   Data Layer        │
                                               │  - PostgreSQL       │
                                               │  - Redis Cache      │
                                               │  - S3 Storage       │
                                               └─────────────────────┘
```

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- Python 3.11.x
- Docker and Docker Compose
- PostgreSQL 15.x
- Redis 7.x

### Development Setup
```bash
# Clone the repository
git clone https://github.com/Jmjcoke/Electrical-Orchestrator.git
cd Electrical-Orchestrator

# Install frontend dependencies
cd src/frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development services
docker-compose up -d
```

## Documentation

### BMAD Methodology Documents
- 📋 [Project Brief](docs/project-brief.md) - Initial project vision and requirements
- 📊 [Product Requirements Document](docs/electrical-orchestrator-prd.md) - Complete PRD with epics and user stories
- 🎨 [UI/UX Specification](docs/front-end-spec.md) - Design system and user experience guidelines
- 🏗️ [System Architecture](docs/electrical-orchestrator-architecture.md) - Complete technical architecture
- 💻 [Frontend Architecture](docs/frontend-architecture.md) - React/Next.js implementation details

### Development Stories
- 📖 [Story 1.2: User Authentication](docs/stories/1.2.story.md) - Enterprise SSO and role-based access control

### BMAD Agent Configuration
- 🤖 [BMAD Agent Setup](bmad-agent/) - Complete BMAD methodology configuration and templates

## Contributing

This project follows the **BMAD V3 methodology** for systematic development:

1. **Analyst Phase** - Requirements gathering and research
2. **Product Owner Phase** - Epic and story creation
3. **Design Architect Phase** - UI/UX specifications
4. **System Architect Phase** - Technical architecture
5. **Scrum Master Phase** - Story preparation and validation
6. **Developer Phase** - Implementation and testing

### Development Workflow
1. Stories are prepared by the Scrum Master persona
2. Implementation follows established architecture patterns
3. All code must pass comprehensive testing (unit, integration, E2E)
4. Pull requests require architecture compliance validation

## Security & Compliance

### Enterprise Security Features
- 🔐 Enterprise SSO integration (SAML/LDAP)
- 🛡️ Role-based access control (7 user roles)
- 🔑 JWT token management with automatic refresh
- 📝 Comprehensive audit logging
- 🚫 Rate limiting and CSRF protection

### Industry Compliance
- Oil & gas industry security standards
- Data privacy and protection measures
- Professional user interface design
- Enterprise deployment capabilities

## License

This project is proprietary software developed for oil & gas industry applications.

## Support

For technical support and questions:
- 📧 Email: [Contact Information]
- 📚 Documentation: [Documentation Site]
- 🐛 Issues: [GitHub Issues](https://github.com/Jmjcoke/Electrical-Orchestrator/issues)

---

**Built with the BMAD V3 methodology** - Ensuring systematic, high-quality development from conception to deployment.

*Last updated: January 25, 2025*
