import { NextRequest, NextResponse } from 'next/server';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = getBrowserRuntimeEnv().apiUrl;
    console.log('🔍 [HEALTH DEBUG] Frontend health endpoint called');
    console.log('🔍 [HEALTH DEBUG] API URL from runtime env:', apiUrl);
    
    // Test backend connectivity - use root endpoint since backend returns {"status":"ok"} at /
    console.log('🔍 [HEALTH DEBUG] Attempting to fetch from:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('🔍 [HEALTH DEBUG] Backend response status:', response.status);
    
    const backendHealth = await response.json();
    
    return NextResponse.json({
      status: 'healthy',
      frontend: 'connected',
      backend: backendHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      frontend: 'connected',
      backend: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
