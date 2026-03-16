'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating clear explanations for fines incurred by participants in PreachPoint sessions.
 *
 * - generateFineExplanation - A function that triggers the fine explanation generation process.
 * - FineExplanationInput - The input type for the generateFineExplanation function.
 * - FineExplanationOutput - The return type for the generateFineExplanation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FineExplanationInputSchema = z.object({
  sessionType: z.string().describe('The type of session (e.g., Individual, Group, Sunday Preaching).'),
  participantName: z.string().describe('The name of the individual or group incurring the fine.'),
  preachingDurationMinutes: z.number().describe('The actual duration of the preaching in minutes.'),
  maxAllowedDurationMinutes: z.number().describe('The maximum allowed duration for preaching in minutes.'),
  fineRateDescription: z.string().describe('A description of how the fine is calculated (e.g., "$5 per minute overage", "fixed rate of $20").'),
  fineAmount: z.number().describe('The total calculated fine amount.'),
  overageMinutes: z.number().describe('The number of minutes over the allowed duration.'),
  rulesSummary: z.string().describe('A brief summary of the session rules relevant to fine calculation.'),
});
export type FineExplanationInput = z.infer<typeof FineExplanationInputSchema>;

const FineExplanationOutputSchema = z.object({
  explanation: z.string().describe('A clear and concise explanation for the incurred fine.'),
});
export type FineExplanationOutput = z.infer<typeof FineExplanationOutputSchema>;

export async function generateFineExplanation(input: FineExplanationInput): Promise<FineExplanationOutput> {
  return fineExplanationFlow(input);
}

const fineExplanationPrompt = ai.definePrompt({
  name: 'fineExplanationPrompt',
  input: { schema: FineExplanationInputSchema },
  output: { schema: FineExplanationOutputSchema },
  prompt: `You are an assistant specialized in explaining financial fines related to session overages.

Generate a clear and concise explanation for a fine incurred in a PreachPoint session. The explanation should detail how the fine was calculated based on session rules and recorded time overages. Be polite but firm.

Here are the details:
Session Type: {{{sessionType}}}
Participant: {{{participantName}}}
Actual Preaching Duration: {{{preachingDurationMinutes}}} minutes
Maximum Allowed Duration: {{{maxAllowedDurationMinutes}}} minutes
Time Overage: {{{overageMinutes}}} minutes
Fine Rate: {{{fineRateDescription}}}
Total Fine Amount: $ {{{fineAmount}}}
Relevant Session Rules: {{{rulesSummary}}}

Explanation:`,
});

const fineExplanationFlow = ai.defineFlow(
  {
    name: 'fineExplanationFlow',
    inputSchema: FineExplanationInputSchema,
    outputSchema: FineExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await fineExplanationPrompt(input);
    return output!;
  },
);
