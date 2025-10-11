import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 [HEALTH] Health check endpoint hit');
    
    return NextResponse.json({
      status: 'healthy',
      service: 'rashomon-frontend',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔍 [HEALTH] Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      service: 'rashomon-frontend',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
