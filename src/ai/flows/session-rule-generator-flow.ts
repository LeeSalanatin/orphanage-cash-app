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
      amount: z.number().positive().describe('The monetary amount for the fine. This is the total fixed fine or the amount per minute overage.').default(5),
      gracePeriodMinutes: z.number().int().min(0).optional().describe('An optional grace period in minutes before "per-minute-overage" fines begin to accrue.').default(0)
    })
  ).min(1).describe('An array of fine rules applicable to this session. Provide rules for relevant entities (individuals, groups, or sunday preaching).'),
  votingConfig: z.object({
    enabled: z.boolean().describe('Indicates whether a voting system is enabled for participants to rate performances in this session.').default(false),
    topIndividualsToVoteFor: z.number().int().min(0).optional().describe('If voting is enabled, the number of top individuals participants can vote for. Set to 0 or omit if not applicable or if only groups are voted on.').default(0),
    topGroupsToVoteFor: z.number().int().min(0).optional().describe('If voting is enabled, the number of top groups participants can vote for. Set to 0 or omit if not applicable or if only individuals are voted on.').default(0),
    enableIndividualVotingInGroupSession: z.boolean().optional().describe('Only applicable for "group" sessions: if true, allows voting for individuals within the top groups as well.').default(false)
  }).describe('Configuration for the session\'s interactive voting system.'),
  pointDistribution: z.object({
    enabled: z.boolean().describe('Indicates whether points or incentives are distributed based on the voting results.').default(false),
    pointsPerTopIndividual: z.number().int().min(0).optional().describe('The number of points awarded to each top individual based on voting results. These points are awarded directly to the individual.').default(0),
    pointsPerTopGroup: z.number().int().min(0).optional().describe('The number of points awarded to each top group based on voting results. These points are typically divided among group members.').default(0)
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
If a specific detail is not mentioned, infer a sensible default or mark it as not applicable based on the session type.

CRITICAL RULE FOR SUNDAY PREACHING:
- Sunday preaching sessions MUST ALWAYS use 'fixed' fine types. There is NO per-minute computation for Sunday Service.

Here are the possible session types:
- 'individual': Sessions where participants preach individually. Fines and voting typically apply to individuals.
- 'group': Sessions where participants are part of groups. Fines might apply to individuals or groups. Voting can be for top groups, top individuals within groups, or both.
- 'sunday preaching': A general preaching session. If a time limit is set and exceeded, a FIXED fine is applied regardless of how many seconds they went over.

Here are the possible fine types:
- 'fixed': A set fine amount applied once if the limit is exceeded.
- 'per-minute-overage': A fine charged per minute (and second) that a participant or group exceeds the limit.

Example descriptions and expected JSON structure:

1. Description: "An individual session where preachers get fined ₱10 for every minute they go over 15 minutes. There will be voting for the top 3 speakers, who each get 100 points."
   Expected Output:
   {
     "sessionType": "individual",
     "maxPreachingTimeMinutes": 15,
     "maxPreachingTimeSeconds": 0,
     "fineRules": [
       {
         "appliesTo": "individual",
         "type": "per-minute-overage",
         "amount": 10,
         "gracePeriodMinutes": 0
       }
     ],
     "votingConfig": {
       "enabled": true,
       "topIndividualsToVoteFor": 3,
       "topGroupsToVoteFor": 0,
       "enableIndividualVotingInGroupSession": false
     },
     "pointDistribution": {
       "enabled": true,
       "pointsPerTopIndividual": 100,
       "pointsPerTopGroup": 0
     }
   }

2. Description: "A Sunday Service session with a 20 minute limit. If they exceed it, they pay a flat ₱50 fine. No voting."
   Expected Output:
   {
     "sessionType": "sunday preaching",
     "maxPreachingTimeMinutes": 20,
     "maxPreachingTimeSeconds": 0,
     "fineRules": [
       {
         "appliesTo": "individual",
         "type": "fixed",
         "amount": 50
       }
     ],
     "votingConfig": {
       "enabled": false
     },
     "pointDistribution": {
       "enabled": false
     }
   }

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

/**
 * Generates structured session rules from a natural language description.
 *
 * @param input - An object containing the natural language description of the session rules.
 * @returns A promise that resolves to the structured session rules.
 */
export async function generateSessionRules(
  input: GenerateSessionRulesInput
): Promise<GenerateSessionRulesOutput> {
  return generateSessionRulesFlow(input);
}
