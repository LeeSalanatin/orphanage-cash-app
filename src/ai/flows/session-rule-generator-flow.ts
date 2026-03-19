'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating structured session rules from natural language descriptions.
 * It exports the `generateSessionRules` function, its input type `GenerateSessionRulesInput`, and output type `GenerateSessionRulesOutput`.
 * This tool helps administrators quickly set up new sessions by translating a description into a configurable JSON object.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input schema for the session rule generator.
const GenerateSessionRulesInputSchema = z.object({
  description: z.string().describe('A natural language description of the desired session type and rules (e.g., "a group session with fines for going over 10 minutes, and voting for the top 3 speakers").'),
});

export type GenerateSessionRulesInput = z.infer<typeof GenerateSessionRulesInputSchema>;

// Define the output schema for the structured session rules.
const GenerateSessionRulesOutputSchema = z.object({
  sessionType: z.enum(['individual', 'group', 'sunday preaching']).describe('The primary type of session: "individual" for single participants, "group" for multiple participants organized into teams, or "sunday preaching" for a general Sunday service preaching.').default('individual'),
  maxPreachingTimeMinutes: z.number().int().min(0).nullable().describe('Optional maximum allowed preaching time in minutes for individual or group sessions. If exceeded, fines may apply.').default(null),
  maxPreachingTimeSeconds: z.number().int().min(0).max(59).nullable().describe('Optional maximum allowed preaching time in seconds (added to minutes).').default(0),
  fineRules: z.array(
    z.object({
      appliesTo: z.enum(['individual', 'group', 'sunday preaching']).describe('Specifies who this fine rule applies to: "individual" participants, "group" entities, or the "sunday preaching" session as a whole.').default('individual'),
      type: z.enum(['fixed', 'per-minute-overage']).describe('The calculation method for the fine: "fixed" for a set amount, or "per-minute-overage" for an amount charged per minute beyond the max time.').default('per-minute-overage'),
      amount: z.number().positive().describe('The monetary amount for the fine. This is the total fixed fine or the amount per minute overage.').default(30),
      gracePeriodMinutes: z.number().int().min(0).optional().describe('An optional grace period in minutes before "per-minute-overage" fines begin to accrue.').default(0)
    })
  ).min(1).describe('An array of fine rules applicable to this session.'),
  votingConfig: z.object({
    enabled: z.boolean().describe('Indicates whether a voting system is enabled for participants to rate performances in this session.').default(false),
    topIndividualsToVoteFor: z.number().int().min(0).optional().describe('If voting is enabled, the number of top individuals participants can vote for.').default(3),
    topGroupsToVoteFor: z.number().int().min(0).optional().describe('If voting is enabled, the number of top groups participants can vote for.').default(1),
  }).describe('Configuration for the session\'s interactive voting system.'),
  pointDistribution: z.object({
    enabled: z.boolean().describe('Indicates whether points or incentives are distributed based on the voting results.').default(false),
    rewardTop1: z.number().int().min(0).optional().describe('Points for individual Top 1.').default(100),
    rewardTop2: z.number().int().min(0).optional().describe('Points for individual Top 2.').default(50),
    rewardTop3: z.number().int().min(0).optional().describe('Points for individual Top 3.').default(25),
    rewardGroupTop1: z.number().int().min(0).optional().describe('Points for the winning group (shared among members).').default(100)
  }).describe('Configuration for distributing points or incentives based on voting outcomes.')
});

export type GenerateSessionRulesOutput = z.infer<typeof GenerateSessionRulesOutputSchema>;

// Define the prompt for the LLM to generate structured session rules.
const generateSessionRulesPrompt = ai.definePrompt({
  name: 'generateSessionRulesPrompt',
  input: { schema: GenerateSessionRulesInputSchema },
  output: { schema: GenerateSessionRulesOutputSchema },
  prompt: `You are an AI assistant tasked with generating structured session rules based on a natural language description.
Your goal is to parse the user's request and output a JSON object conforming strictly to the provided JSON schema.

CRITICAL RULES:
- Sunday preaching sessions MUST ALWAYS use 'fixed' fine types.
- Individual rewards are tiered: Top 1 (usually 100), Top 2 (usually 50), Top 3 (usually 25).
- Group rewards are shared among participating members.

Example description: "15 minute limit, ₱30 fine per minute overage. Voting for top 3, winner gets 100, 2nd gets 50, 3rd gets 25. Group winner gets 100 shared."

Now, generate the JSON for the following description:
{{{description}}} `
});

// Define the Genkit flow to process the natural language description.
const generateSessionRulesFlow = ai.defineFlow(
  {
    name: 'generateSessionRulesFlow',
    inputSchema: GenerateSessionRulesInputSchema,
    outputSchema: GenerateSessionRulesOutputSchema,
  },
  async (input) => {
    const { output } = await generateSessionRulesPrompt(input);
    if (!output) {
      throw new Error('Failed to generate session rules from prompt.');
    }
    return output;
  }
);

export async function generateSessionRules(
  input: GenerateSessionRulesInput
): Promise<GenerateSessionRulesOutput> {
  return generateSessionRulesFlow(input);
}