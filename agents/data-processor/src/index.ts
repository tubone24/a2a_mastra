import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { generateText } from 'ai';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Initialize Mastra
const mastra = new Mastra({
  agents: {},
});

// Create Data Processor Agent
const dataProcessorAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    You are a data processor agent specialized in analyzing and processing structured and unstructured data.
    Your role is to:
    1. Receive data from other agents via A2A protocol
    2. Analyze the data structure and content
    3. Clean and normalize the data
    4. Extract meaningful insights or patterns
    5. Return processed results to the requesting agent
    
    Always provide detailed analysis and clear explanations of your processing steps.
  `,
  model: getBedrockModel(),
});

// Task schema for data processing
const processTaskSchema = z.object({
  type: z.enum(['process', 'analyze']),
  data: z.any(),
  context: z.record(z.any()).optional(),
});

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const task = processTaskSchema.parse(req.body);
    
    let prompt = '';
    let processedResult;
    
    switch (task.type) {
      case 'process':
        prompt = `
          Process and analyze the following data:
          ${JSON.stringify(task.data, null, 2)}
          
          Please:
          1. Identify the data structure and format
          2. Clean and normalize any inconsistencies
          3. Extract key patterns or insights
          4. Provide a summary of findings
          5. Return the processed data in a structured format
          
          Context: ${task.context ? JSON.stringify(task.context) : 'None provided'}
        `;
        break;
        
      case 'analyze':
        prompt = `
          Perform deep analysis on the following data:
          ${JSON.stringify(task.data, null, 2)}
          
          Please:
          1. Identify trends, patterns, and anomalies
          2. Calculate relevant statistics if applicable
          3. Provide insights and recommendations
          4. Highlight potential data quality issues
          5. Suggest next steps for further processing
          
          Context: ${task.context ? JSON.stringify(task.context) : 'None provided'}
        `;
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    // Use AI model to process the data
    const result = await generateText({
      model: getBedrockModel(),
      prompt,
    });
    
    processedResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      result: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        processingType: task.type,
        originalDataSize: JSON.stringify(task.data).length,
      },
    };
    
    console.log(`${AGENT_NAME} completed processing task`);
    
    res.json(processedResult);
    
  } catch (error) {
    console.error(`${AGENT_NAME} task processing error:`, error);
    res.status(500).json({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      processedBy: AGENT_ID,
    });
  }
});

// A2A Message endpoint for receiving messages from other agents
app.post('/api/a2a/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { from, content, timestamp } = req.body;
    
    // Process the message and potentially respond
    const response = {
      from: AGENT_ID,
      to: from,
      content: `Message received and acknowledged by ${AGENT_NAME}`,
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
    
  } catch (error) {
    console.error(`${AGENT_NAME} message processing error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID,
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition']
  });
});

// Agent info endpoint (for A2A discovery)
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'processor',
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition'],
    endpoint: `http://data-processor:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['processData', 'analyzeData'],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
});