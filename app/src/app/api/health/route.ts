import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 [HEALTH DEBUG] Frontend health endpoint called');
    console.log('🔍 [HEALTH DEBUG] Available env vars:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('SUPABASE')));
    
    // Simple frontend health check - no backend dependency
    return NextResponse.json({
      status: 'healthy',
      frontend: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔍 [HEALTH ERROR] Frontend health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      frontend: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
