import { NextRequest, NextResponse } from 'next/server';

// Mock training datasets for the interface
const mockDatasets = [
  {
    id: 'legend-symbols-v1',
    name: 'Electrical Legend Symbols v1.0',
    description: 'Symbol extraction from electrical legend sheets with OCR pairing',
    type: 'symbol_recognition',
    status: 'ready',
    itemCount: 1247,
    createdAt: '2024-01-15T10:30:00Z',
    lastModified: '2024-01-20T14:45:00Z',
    categories: ['circuit_breaker', 'motor', 'transformer', 'switch', 'receptacle'],
    quality: {
      labelAccuracy: 0.94,
      imageQuality: 0.89,
      completeness: 0.96
    }
  },
  {
    id: 'component-detection-v2',
    name: 'Component Detection Dataset v2.0',
    description: 'Annotated electrical components from schematic drawings',
    type: 'component_detection',
    status: 'ready',
    itemCount: 3892,
    createdAt: '2024-01-10T09:15:00Z',
    lastModified: '2024-01-25T16:20:00Z',
    categories: ['breaker', 'fuse', 'relay', 'contactor', 'motor_starter'],
    quality: {
      labelAccuracy: 0.97,
      imageQuality: 0.91,
      completeness: 0.99
    }
  },
  {
    id: 'circuit-analysis-beta',
    name: 'Circuit Analysis Dataset (Beta)',
    description: 'Circuit tracing and connection analysis training data',
    type: 'circuit_analysis',
    status: 'processing',
    itemCount: 856,
    createdAt: '2024-01-28T11:00:00Z',
    lastModified: '2024-01-30T08:30:00Z',
    categories: ['wire_trace', 'connection_point', 'junction', 'terminal'],
    quality: {
      labelAccuracy: 0.88,
      imageQuality: 0.85,
      completeness: 0.73
    }
  },
  {
    id: 'industrial-controls-v1',
    name: 'Industrial Control Panels v1.0',
    description: 'High-resolution industrial control panel component recognition',
    type: 'component_detection',
    status: 'ready',
    itemCount: 2156,
    createdAt: '2024-01-05T14:20:00Z',
    lastModified: '2024-01-22T12:10:00Z',
    categories: ['plc', 'hmi', 'vfd', 'servo_drive', 'safety_relay'],
    quality: {
      labelAccuracy: 0.92,
      imageQuality: 0.93,
      completeness: 0.95
    }
  },
  {
    id: 'mixed-drawings-large',
    name: 'Mixed Electrical Drawings (Large)',
    description: 'Diverse collection of electrical drawings for comprehensive training',
    type: 'mixed',
    status: 'ready',
    itemCount: 5643,
    createdAt: '2024-01-01T00:00:00Z',
    lastModified: '2024-01-29T18:45:00Z',
    categories: ['residential', 'commercial', 'industrial', 'automotive', 'marine'],
    quality: {
      labelAccuracy: 0.89,
      imageQuality: 0.87,
      completeness: 0.92
    }
  },
  {
    id: 'symbol-extraction-new',
    name: 'Latest Symbol Extractions',
    description: 'Recently processed symbol extraction results from user uploads',
    type: 'symbol_recognition',
    status: 'validating',
    itemCount: 234,
    createdAt: '2024-01-30T16:30:00Z',
    lastModified: '2024-01-30T18:15:00Z',
    categories: ['new_symbols', 'custom_components', 'specialty_equipment'],
    quality: {
      labelAccuracy: 0.76,
      imageQuality: 0.82,
      completeness: 0.68
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const minQuality = searchParams.get('minQuality');

    let filteredDatasets = [...mockDatasets];

    // Apply filters
    if (type) {
      filteredDatasets = filteredDatasets.filter(dataset => 
        dataset.type === type || dataset.type === 'mixed'
      );
    }

    if (status) {
      filteredDatasets = filteredDatasets.filter(dataset => 
        dataset.status === status
      );
    }

    if (minQuality) {
      const minQualityNum = parseFloat(minQuality);
      filteredDatasets = filteredDatasets.filter(dataset => 
        dataset.quality.labelAccuracy >= minQualityNum
      );
    }

    // Sort by most recent first
    filteredDatasets.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    return NextResponse.json({
      success: true,
      data: filteredDatasets,
      total: filteredDatasets.length,
      filters: {
        type: type || 'all',
        status: status || 'all',
        minQuality: minQuality ? parseFloat(minQuality) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch training datasets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, sourceFiles } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Name and type are required' 
        },
        { status: 400 }
      );
    }

    // Create new dataset (mock implementation)
    const newDataset = {
      id: `dataset-${Date.now()}`,
      name,
      description: description || '',
      type,
      status: 'processing',
      itemCount: 0,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      categories: [],
      quality: {
        labelAccuracy: 0,
        imageQuality: 0,
        completeness: 0
      },
      sourceFiles: sourceFiles || []
    };

    // In a real implementation, this would:
    // 1. Process the source files
    // 2. Extract and validate training data
    // 3. Store in database
    // 4. Initialize background processing job

    return NextResponse.json({
      success: true,
      data: newDataset,
      message: 'Dataset creation initiated. Processing will begin shortly.'
    });

  } catch (error) {
    console.error('Error creating dataset:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create dataset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}