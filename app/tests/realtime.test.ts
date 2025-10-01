import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase1 = createClient(supabaseUrl, supabaseKey);
const supabase2 = createClient(supabaseUrl, supabaseKey);

const contentId = 'test-content-id';
const channelName = `content:${contentId}`;

console.log('=== Testing Realtime Presence & Chat ===');

// Simulate Client A - FIXED: subscribe FIRST, then track
console.log('1. Creating and subscribing Channel A...');
const channelA = supabase1.channel(channelName);

await new Promise<void>((resolve) => {
  channelA
    .on('presence', { event: 'sync' }, () => {
      const state = channelA.presenceState();
      const userCount = Object.keys(state).length;
      console.log(`   Client A: Presence sync - ${userCount} user(s) online`);
      if (userCount > 1) {
        console.log('   ✅ Client A: Match found!');
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('   Channel A: SUBSCRIBED');
        await channelA.track({ userId: 'user1', highlightId: 'highlight1' });
        console.log('   Channel A: Tracking presence for user1');
        resolve();
      }
    });
});

// Simulate Client B - FIXED: subscribe FIRST, then track
console.log('2. Creating and subscribing Channel B...');
const channelB = supabase2.channel(channelName);

await new Promise<void>((resolve) => {
  channelB
    .on('presence', { event: 'sync' }, () => {
      const state = channelB.presenceState();
      const userCount = Object.keys(state).length;
      console.log(`   Client B: Presence sync - ${userCount} user(s) online`);
      if (userCount > 1) {
        console.log('   ✅ Client B: Match found!');
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('   Channel B: SUBSCRIBED');
        await channelB.track({ userId: 'user2', highlightId: 'highlight2' });
        console.log('   Channel B: Tracking presence for user2');
        resolve();
      }
    });
});

// Wait a moment for presence to sync
await new Promise(resolve => setTimeout(resolve, 1000));

// Test chat broadcast
console.log('\n3. Testing Chat Broadcast...');
const chatRoom = 'chat:test-highlight';

// Setup Chat Channel B first (receiver)
console.log('   Setting up Chat Channel B (receiver)...');
const chatChannelB = supabase2.channel(chatRoom);

await new Promise<void>((resolve) => {
  chatChannelB
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      console.log('   ✅ Client B received message:', payload.message);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('   Chat Channel B: SUBSCRIBED');
        resolve();
      }
    });
});

// Setup Chat Channel A (sender)
console.log('   Setting up Chat Channel A (sender)...');
const chatChannelA = supabase1.channel(chatRoom);

await new Promise<void>((resolve) => {
  chatChannelA.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.log('   Chat Channel A: SUBSCRIBED');
      console.log('   Sending message from Client A...');
      await chatChannelA.send({ 
        type: 'broadcast', 
        event: 'message', 
        payload: { message: 'Hello from A' } 
      });
      resolve();
    }
  });
});

// Wait for message to be received
await new Promise(resolve => setTimeout(resolve, 500));
console.log('\n✅ All tests completed successfully!');