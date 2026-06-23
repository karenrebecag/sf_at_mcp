/** ATFX org object registry — shared by MCP tools and REST routes. */

export const PRIMARY_OBJECTS = ['Lead', 'Account', 'Contact'] as const;
export type PrimaryObject = (typeof PRIMARY_OBJECTS)[number];

/** Objects that do not exist or must not be queried in this org. */
export const FORBIDDEN_OBJECTS = ['Opportunity'] as const;

const COUNTRY_FIELD: Record<PrimaryObject, string> = {
  Lead: 'Country_of_Residence_Lead__c',
  Account: 'Country_of_Residence_Account__c',
  Contact: 'Country_of_Residence__c',
};

export function isPrimaryObject(value: string): value is PrimaryObject {
  return (PRIMARY_OBJECTS as readonly string[]).includes(value);
}

export function assertSupportedObject(sobject: string): PrimaryObject {
  const name = sobject.trim();
  if ((FORBIDDEN_OBJECTS as readonly string[]).includes(name)) {
    throw new Error(
      `Object "${name}" does not exist in the ATFX org. Pipeline is Lead → Account; use Lead or Account instead.`,
    );
  }
  if (!isPrimaryObject(name)) {
    throw new Error(
      `Object "${name}" is not in the curated ATFX set (${PRIMARY_OBJECTS.join(', ')}). Use describe with mode=full only after confirming the object exists.`,
    );
  }
  return name;
}

export function countryFieldFor(sobject: PrimaryObject): string {
  return COUNTRY_FIELD[sobject];
}
