import { MemoryCache } from '../core/cache/memory.js';
import {
  filterDescribeFields,
  type DescribeField,
  type DescribeOptions,
} from '../core/describe/filter.js';
import { assertSupportedObject } from '../core/objects.js';
import { fetchRawDescribe } from './salesforce-data.js';

const DESCRIBE_TTL_MS = Number(process.env.DESCRIBE_CACHE_TTL_MS ?? 3_600_000);
const rawDescribeCache = new MemoryCache<Awaited<ReturnType<typeof fetchRawDescribe>>>(
  DESCRIBE_TTL_MS,
);

export async function fetchObjectDescribe(sobject: string, options: DescribeOptions = {}) {
  const mode = options.mode ?? 'curated';
  const name = sobject.trim();
  if (mode !== 'full') assertSupportedObject(name);

  const cacheKey = `describe:${name}`;
  let cached = false;
  let raw = rawDescribeCache.get(cacheKey);
  if (!raw) {
    raw = await fetchRawDescribe(name);
    rawDescribeCache.set(cacheKey, raw);
  } else {
    cached = true;
  }

  const allFields: DescribeField[] = (raw.fields ?? []).map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    ...(f.relationshipName ? { relationshipName: f.relationshipName } : {}),
    ...(f.picklistValues?.length
      ? {
          picklistValues: f.picklistValues.map((p) => ({
            value: p.value,
            label: p.label,
            active: p.active,
          })),
        }
      : {}),
  }));

  const fields =
    mode === 'full'
      ? applySearchFilters(allFields, options)
      : filterDescribeFields(assertSupportedObject(name), allFields, options);

  return {
    name: raw.name,
    label: raw.label,
    mode,
    fieldCount: fields.length,
    cached,
    fields,
  };
}

/** Test helper — clears the describe cache between runs. */
export function clearDescribeCache(): void {
  rawDescribeCache.clear();
}

function applySearchFilters(fields: DescribeField[], options: DescribeOptions): DescribeField[] {
  let result = fields;
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
