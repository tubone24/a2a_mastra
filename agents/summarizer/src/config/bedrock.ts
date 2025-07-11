import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import dotenv from 'dotenv';

dotenv.config();

// Create Bedrock provider instance
export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Get the model instance
export const getBedrockModel = () => {
  const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  return bedrock(modelId);
};