import { NextRequest, NextResponse } from 'next/server';
import { getServerRuntimeEnv } from '@/lib/runtime-env';

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 [HEALTH DEBUG] ===== HEALTH ENDPOINT HIT =====');
    console.log('🔍 [HEALTH DEBUG] Request headers:', Object.fromEntries(_request.headers.entries()));
    console.log('🔍 [HEALTH DEBUG] Request URL:', _request.url);
    console.log('🔍 [HEALTH DEBUG] Request method:', _request.method);
    
    // Log all environment variables that might be relevant
    console.log('🔍 [HEALTH DEBUG] All env vars with API/SUPABASE:', 
      Object.keys(process.env).filter(k => k.includes('API') || k.includes('SUPABASE')));
    
    const apiUrl = getServerRuntimeEnv().apiUrl;
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
