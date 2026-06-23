import { CURATED_FIELDS } from './curated-fields.js';
import type { PrimaryObject } from '../objects.js';

export type DescribeMode = 'curated' | 'picklists' | 'full';

export interface DescribeField {
  name: string;
  label: string;
  type: string;
  relationshipName?: string;
  picklistValues?: Array<{ value: string; label: string; active: boolean }>;
}

export interface DescribeOptions {
  mode?: DescribeMode;
  search?: string;
  field?: string;
}

export function filterDescribeFields(
  sobject: PrimaryObject,
  fields: DescribeField[],
  options: DescribeOptions = {},
): DescribeField[] {
  const mode = options.mode ?? 'curated';
  let result = fields;

  if (mode === 'curated') {
    const allow = new Set(CURATED_FIELDS[sobject]);
    result = result.filter((f) => allow.has(f.name));
  } else if (mode === 'picklists') {
    result = result.filter((f) => f.type === 'picklist' || f.type === 'multipicklist');
  }

  if (options.field) {
    const needle = options.field.trim().toLowerCase();
    result = result.filter((f) => f.name.toLowerCase() === needle);
  }

  if (options.search) {
    const needle = options.search.trim().toLowerCase();
    result = result.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.label.toLowerCase().includes(needle),
    );
  }

  return result;
}
