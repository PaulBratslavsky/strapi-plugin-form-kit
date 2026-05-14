/**
 * Loose schema the AI is asked to emit. Deliberately permissive so small
 * local models (gemma4, llama3, etc.) can hit it without our retry loop
 * spinning on every minor deviation. The normaliser (./normalize.ts) is
 * what actually turns this into a canonical FormSchema.
 *
 * Keep this schema as forgiving as possible — every constraint here is a
 * potential retry. The strict shape is enforced *after* normalisation, by
 * FormSchemaCore.
 */
import { z } from 'zod';

const LooseOption = z.object({
  value: z.string().optional(),
  label: z.string().optional(),
});

const LooseOptionsSource = z
  .object({
    kind: z.literal('collection'),
    uid: z.string(),
    labelField: z.string(),
    valueField: z.string().optional(),
  })
  .passthrough();

const LooseField = z
  .object({
    type: z.string(),
    name: z.string().optional(),
    label: z.string().optional(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
    required: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    options: z.array(LooseOption).optional(),
    // For dropdown/radio/checkboxes — when present, server resolves to
    // concrete options at /schema read time. Mutually exclusive with
    // static `options` in practice; normaliser doesn't synthesize a
    // placeholder when this is set.
    optionsSource: LooseOptionsSource.optional(),
  })
  .passthrough();

export const LooseSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(LooseField),
  })
  .passthrough();

export type LooseSchemaInput = z.infer<typeof LooseSchema>;
