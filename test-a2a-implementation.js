#!/usr/bin/env node

/**
 * Test script for the new Mastra A2A implementation
 * This script tests the refactored implementation against the original functionality
 */

import { MastraClient } from '@mastra/client-js';

const AGENT_URLS = {
  gateway: 'http://localhost:4111',
  'data-processor': 'http://localhost:4112', 
  summarizer: 'http://localhost:4113',
  'web-search': 'http://localhost:4114'
};

const AGENT_IDS = {
  gateway: 'gateway-agent-01',
  'data-processor': 'data-processor-agent-01',
  summarizer: 'summarizer-agent-01',
  'web-search': 'web-search-agent-01'
};

async function testAgentCard(agentType) {
  console.log(`\n🔍 Testing ${agentType} agent card...`);
  try {
    const client = new MastraClient({ baseUrl: AGENT_URLS[agentType] });
    const a2a = client.getA2A(AGENT_IDS[agentType]);
    const card = await a2a.getCard();
    
    console.log(`✅ ${agentType} agent card retrieved successfully:`);
    console.log(`   - ID: ${card.id}`);
    console.log(`   - Name: ${card.name}`);
    console.log(`   - Status: ${card.status}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Failed to get ${agentType} agent card:`, error.message);
    return false;
  }
}

async function testA2AMessage(fromAgent, toAgent, message) {
  console.log(`\n💬 Testing A2A message from ${fromAgent} to ${toAgent}...`);
  try {
    const client = new MastraClient({ baseUrl: AGENT_URLS[fromAgent] });
    const a2a = client.getA2A(AGENT_IDS[toAgent]);
    
    const response = await a2a.sendMessage({
      to: AGENT_IDS[toAgent],
      from: AGENT_IDS[fromAgent],
      message: {
        role: "user",
        parts: [{
          type: "text",
          text: message
        }]
      },
      timestamp: new Date().toISOString(),
    });
    
    console.log(`✅ Message sent successfully from ${fromAgent} to ${toAgent}`);
    console.log(`   Response: ${JSON.stringify(response).substring(0, 100)}...`);
    
    return true;
  } catch (error) {
    console.log(`❌ Failed to send message from ${fromAgent} to ${toAgent}:`, error.message);
    return false;
  }
}

async function testSummarizerTask() {
  console.log(`\n📝 Testing summarizer task creation...`);
  try {
    const client = new MastraClient({ baseUrl: AGENT_URLS.summarizer });
    const a2a = client.getA2A(AGENT_IDS.summarizer);
    
    const task = await a2a.createTask({
      agentId: AGENT_IDS.summarizer,
      taskType: 'summarize',
      payload: {
        type: 'summarize',
        data: {
          content: 'This is a test document that needs to be summarized. It contains important information about the new A2A implementation.',
          topic: 'A2A Implementation Test'
        },
        audienceType: 'technical'
      }
    });
    
    console.log(`✅ Summarizer task created successfully:`);
    console.log(`   - Task ID: ${task.id}`);
    console.log(`   - Status: ${task.status}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Failed to create summarizer task:`, error.message);
    return false;
  }
}

async function testAgentDiscovery() {
  console.log(`\n🔍 Testing agent discovery...`);
  
  const results = {};
  for (const [agentType, url] of Object.entries(AGENT_URLS)) {
    try {
      // Test if the agent is accessible via HTTP
      const response = await fetch(`${url}/`);
      results[agentType] = {
        accessible: response.ok,
        status: response.status
      };
      
      console.log(`   ${agentType}: ${response.ok ? '✅ Accessible' : '❌ Not accessible'} (Status: ${response.status})`);
    } catch (error) {
      results[agentType] = {
        accessible: false,
        error: error.message
      };
      console.log(`   ${agentType}: ❌ Connection failed - ${error.message}`);
    }
  }
  
  return results;
}

async function runTests() {
  console.log('🚀 Starting A2A Implementation Tests');
  console.log('=====================================');
  
  const testResults = {
    agentDiscovery: false,
    agentCards: {},
    messages: {},
    tasks: {}
  };
  
  // Test 1: Agent Discovery
  console.log('\n📡 Phase 1: Agent Discovery');
  testResults.agentDiscovery = await testAgentDiscovery();
  
  // Test 2: Agent Cards
  console.log('\n🃏 Phase 2: Agent Card Retrieval');
  for (const agentType of Object.keys(AGENT_URLS)) {
    testResults.agentCards[agentType] = await testAgentCard(agentType);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }
  
  // Test 3: A2A Messages
  console.log('\n💬 Phase 3: A2A Message Communication');
  testResults.messages.gatewayToSummarizer = await testA2AMessage(
    'gateway', 
    'summarizer',
    JSON.stringify({
      type: 'summarize',
      data: { content: 'Test summary request from gateway to summarizer' }
    })
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  testResults.messages.gatewayToDataProcessor = await testA2AMessage(
    'gateway',
    'data-processor', 
    JSON.stringify({
      type: 'process',
      data: { content: 'Test processing request from gateway to data processor' }
    })
  );
  
  // Test 4: Task Creation
  console.log('\n📋 Phase 4: Task Creation');
  testResults.tasks.summarizerTask = await testSummarizerTask();
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const agentCardsPassed = Object.values(testResults.agentCards).filter(Boolean).length;
  const messagesPassed = Object.values(testResults.messages).filter(Boolean).length;
  const tasksPassed = Object.values(testResults.tasks).filter(Boolean).length;
  
  console.log(`Agent Discovery: ${testResults.agentDiscovery ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Agent Cards: ${agentCardsPassed}/${Object.keys(testResults.agentCards).length} passed`);
  console.log(`A2A Messages: ${messagesPassed}/${Object.keys(testResults.messages).length} passed`);
  console.log(`Task Creation: ${tasksPassed}/${Object.keys(testResults.tasks).length} passed`);
  
  const totalTests = 1 + Object.keys(testResults.agentCards).length + Object.keys(testResults.messages).length + Object.keys(testResults.tasks).length;
  const passedTests = (testResults.agentDiscovery ? 1 : 0) + agentCardsPassed + messagesPassed + tasksPassed;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The new A2A implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the agent configurations and ensure all services are running.');
  }
  
  return testResults;
}

// Run the tests
runTests().catch(console.error);