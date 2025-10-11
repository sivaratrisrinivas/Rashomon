import { NextRequest, NextResponse } from 'next/server';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = getBrowserRuntimeEnv().apiUrl;
    console.log('🔍 [BACKEND HEALTH DEBUG] Checking backend connectivity');
    console.log('🔍 [BACKEND HEALTH DEBUG] API URL from runtime env:', apiUrl);
    
    // Test backend connectivity
    console.log('🔍 [BACKEND HEALTH DEBUG] Attempting to fetch from:', `${apiUrl}/health`);
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('🔍 [BACKEND HEALTH DEBUG] Backend response status:', response.status);
    
    const backendHealth = await response.json();
    
    return NextResponse.json({
      status: 'healthy',
      frontend: 'connected',
      backend: backendHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔍 [BACKEND HEALTH ERROR] Backend health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      frontend: 'connected',
      backend: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
