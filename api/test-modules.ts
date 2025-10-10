#!/usr/bin/env bun

// Test script to validate module resolution
console.log('🧪 Testing module resolution...');

// Test 1: Direct import of @sinclair/typebox
try {
  console.log('1. Testing direct @sinclair/typebox import...');
  const typebox = await import('@sinclair/typebox');
  console.log('✅ @sinclair/typebox imported successfully');
  console.log('   Available exports:', Object.keys(typebox));
} catch (error) {
  console.error('❌ @sinclair/typebox import failed:', error.message);
}

// Test 2: Elysia import
try {
  console.log('2. Testing Elysia import...');
  const { Elysia } = await import('elysia');
  console.log('✅ Elysia imported successfully');
} catch (error) {
  console.error('❌ Elysia import failed:', error.message);
}

// Test 3: Create Elysia instance
try {
  console.log('3. Testing Elysia instance creation...');
  const { Elysia } = await import('elysia');
  const app = new Elysia();
  console.log('✅ Elysia instance created successfully');
} catch (error) {
  console.error('❌ Elysia instance creation failed:', error.message);
}

// Test 4: Check environment
console.log('4. Environment info:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   cwd:', process.cwd());
console.log('   platform:', process.platform);

// Test 5: Check node_modules
try {
  const fs = await import('fs');
  const path = await import('path');
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  console.log('5. node_modules check:');
  console.log('   node_modules exists:', fs.existsSync(nodeModulesPath));
  
  if (fs.existsSync(nodeModulesPath)) {
    const typeboxPath = path.join(nodeModulesPath, '@sinclair', 'typebox');
    console.log('   @sinclair/typebox path exists:', fs.existsSync(typeboxPath));
    
    if (fs.existsSync(typeboxPath)) {
      const packageJsonPath = path.join(typeboxPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log('   @sinclair/typebox version:', packageJson.version);
      }
    }
  }
} catch (error) {
  console.error('❌ node_modules check failed:', error.message);
}

console.log('🧪 Module resolution test completed');
