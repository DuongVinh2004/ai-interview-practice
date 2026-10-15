import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GeneratedQuestionAiSchema,
  EvaluatedAnswerAiSchema,
  GeneratedLearningPathAiSchema,
} from '@ai-interview/contracts';

/**
 * Clean up a JSON schema recursively for strict compliance across LLM providers.
 * OpenAI structured outputs require:
 * - `additionalProperties: false` on all object schemas
 * - all keys listed in `required`
 */
export function sanitizeSchemaForStructuredOutputs(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(item => sanitizeSchemaForStructuredOutputs(item));
  }

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema)) {
    // Remove JSON schema meta keys that might confuse structured output engines
    if (key === '$schema' || key === 'default') {
      continue;
    }
    cleaned[key] = sanitizeSchemaForStructuredOutputs(value);
  }

  if (cleaned.type === 'object') {
    cleaned.additionalProperties = false;
    if (cleaned.properties && typeof cleaned.properties === 'object') {
      cleaned.required = Object.keys(cleaned.properties);
    }
  }

  return cleaned;
}

/**
 * Converts a Zod schema to standard JSON Schema.
 */
export function convertZodToJsonSchema(zodSchema: z.ZodTypeAny, schemaName: string): any {
  const converted: any = zodToJsonSchema(zodSchema as any, {
    name: schemaName,
    $refStrategy: 'none',
  });

  const rawSchema = converted.definitions?.[schemaName] || converted;
  return sanitizeSchemaForStructuredOutputs(rawSchema);
}

/**
 * OpenAI Structured Outputs response format object.
 */
export function toOpenAiResponseFormat(zodSchema: z.ZodTypeAny, schemaName: string) {
  const schema = convertZodToJsonSchema(zodSchema, schemaName);
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: schemaName,
      strict: true,
      schema,
    },
  };
}

/**
 * Anthropic Tool Use definition for structured output.
 */
export function toAnthropicTool(
  zodSchema: z.ZodTypeAny,
  toolName: string,
  toolDescription: string,
) {
  const schema = convertZodToJsonSchema(zodSchema, toolName);
  return {
    name: toolName,
    description: toolDescription,
    input_schema: schema,
  };
}

/**
 * Clean up a JSON schema recursively for strict compliance with Google Gemini REST API.
 * Google Gemini API schema requirements:
 * - NO `additionalProperties` field (Gemini rejects this with 400 Unknown name "additionalProperties")
 * - NO `$schema`, `default`
 * - All enum values MUST be strings (Gemini rejects numeric enums with TYPE_STRING error)
 */
export function sanitizeSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(item => sanitizeSchemaForGemini(item));
  }

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === '$schema' || key === 'default' || key === 'additionalProperties') {
      continue;
    }
    cleaned[key] = sanitizeSchemaForGemini(value);
  }

  if (Array.isArray(cleaned.enum)) {
    cleaned.enum = cleaned.enum.map(v => String(v));
    cleaned.type = 'string';
  }

  return cleaned;
}

/**
 * Gemini response schema definition.
 */
export function toGeminiResponseSchema(zodSchema: z.ZodTypeAny, schemaName: string) {
  const converted: any = zodToJsonSchema(zodSchema as any, {
    name: schemaName,
    $refStrategy: 'none',
  });

  const rawSchema = converted.definitions?.[schemaName] || converted;
  return sanitizeSchemaForGemini(rawSchema);
}


export const AI_SCHEMAS = {
  question: {
    name: 'generate_interview_question',
    description: 'Structured output schema for generating interview questions',
    zod: GeneratedQuestionAiSchema,
    jsonSchema: convertZodToJsonSchema(GeneratedQuestionAiSchema, 'GeneratedQuestion'),
  },
  evaluation: {
    name: 'evaluate_interview_answer',
    description: 'Structured output schema for evaluating candidate answers',
    zod: EvaluatedAnswerAiSchema,
    jsonSchema: convertZodToJsonSchema(EvaluatedAnswerAiSchema, 'EvaluatedAnswer'),
  },
  learningPath: {
    name: 'generate_learning_path',
    description: 'Structured output schema for generating learning paths',
    zod: GeneratedLearningPathAiSchema,
    jsonSchema: convertZodToJsonSchema(GeneratedLearningPathAiSchema, 'GeneratedLearningPath'),
  },
};
