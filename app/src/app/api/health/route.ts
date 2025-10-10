import { NextRequest, NextResponse } from 'next/server';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = getBrowserRuntimeEnv().apiUrl;
    
    // Test backend connectivity
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
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
