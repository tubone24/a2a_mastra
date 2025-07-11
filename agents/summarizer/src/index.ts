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

const PORT = process.env.PORT || 3003;
const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Initialize Mastra
const mastra = new Mastra({
  agents: {},
});

// Create Summarizer Agent
const summarizerAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    You are a summarizer agent specialized in creating concise, meaningful summaries of processed data and analysis results.
    Your role is to:
    1. Receive processed data and analysis results from other agents via A2A protocol
    2. Extract key insights and findings
    3. Create executive summaries with actionable recommendations
    4. Generate different types of summaries based on audience needs
    5. Return well-structured summary reports to the requesting agent
    
    Always focus on clarity, brevity, and actionable insights.
  `,
  model: getBedrockModel(),
});

// Task schema for summarization
const summarizeTaskSchema = z.object({
  type: z.enum(['summarize', 'executive-summary', 'brief']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
});

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const task = summarizeTaskSchema.parse(req.body);
    
    let prompt = '';
    let summaryResult;
    
    const audienceType = task.audienceType || 'general';
    
    switch (task.type) {
      case 'summarize':
        prompt = `
          Create a comprehensive summary of the following data and analysis:
          ${JSON.stringify(task.data, null, 2)}
          
          Please provide:
          1. A clear overview of the main findings
          2. Key insights and patterns identified
          3. Important statistics or metrics
          4. Potential implications of the findings
          5. Recommended next steps or actions
          
          Target audience: ${audienceType}
          Context: ${task.context ? JSON.stringify(task.context) : 'None provided'}
          
          Format the summary in a clear, structured manner appropriate for ${audienceType} audience.
        `;
        break;
        
      case 'executive-summary':
        prompt = `
          Create an executive summary of the following data and analysis:
          ${JSON.stringify(task.data, null, 2)}
          
          Please provide:
          1. High-level overview (2-3 sentences)
          2. Key business implications
          3. Critical metrics or KPIs
          4. Strategic recommendations
          5. Risk factors or considerations
          
          Keep it concise and business-focused. Maximum 200 words.
          Context: ${task.context ? JSON.stringify(task.context) : 'None provided'}
        `;
        break;
        
      case 'brief':
        prompt = `
          Create a brief summary of the following data and analysis:
          ${JSON.stringify(task.data, null, 2)}
          
          Please provide:
          1. One-sentence overview
          2. Top 3 key findings
          3. Primary recommendation
          
          Keep it extremely concise. Maximum 100 words.
          Context: ${task.context ? JSON.stringify(task.context) : 'None provided'}
        `;
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    // Use AI model to create the summary
    const result = await generateText({
      model: getBedrockModel(),
      prompt,
    });
    
    summaryResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      summary: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        summaryType: task.type,
        audienceType,
        originalDataSize: JSON.stringify(task.data).length,
        summaryLength: result.text.length,
      },
    };
    
    console.log(`${AGENT_NAME} completed summarization task`);
    
    res.json(summaryResult);
    
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
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction']
  });
});

// Agent info endpoint (for A2A discovery)
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'summarizer',
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction'],
    endpoint: `http://summarizer:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['summarizeData', 'createExecutiveSummary', 'createBrief'],
    supportedAudienceTypes: ['technical', 'executive', 'general'],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
});