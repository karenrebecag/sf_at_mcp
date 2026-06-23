/** Deterministic Salesforce responses for local smoke tests (SF_FIXTURE_MODE=mock). */

export const FIXTURE_ORG = {
  username: 'fixture@atfx.test',
  alias: 'atfx',
  instanceUrl: 'https://fixture.my.salesforce.com',
  id: '00Dfixture0000001',
  apiVersion: '67.0',
  connectedStatus: 'Connected',
};

export const FIXTURE_LEAD_DESCRIBE = {
  name: 'Lead',
  label: 'Lead',
  fields: [
    { name: 'Id', label: 'Lead ID', type: 'id' },
    {
      name: 'Status',
      label: 'Status',
      type: 'picklist',
      picklistValues: [
        { value: 'Not Used Demo', label: 'Not Used Demo', active: true },
        { value: 'Live', label: 'Live', active: true },
      ],
    },
    {
      name: 'Country_of_Residence_Lead__c',
      label: 'Country',
      type: 'picklist',
      picklistValues: [{ value: 'MEX', label: 'Mexico', active: true }],
    },
    { name: 'Email', label: 'Email', type: 'email' },
  ],
};

export function fixtureQuery(soql: string): unknown {
  if (/COUNT\(Id\).*GROUP BY Owner\.Name/i.test(soql)) {
    return {
      records: [{ attributes: { type: 'AggregateResult' }, Name: 'BDM One', cnt: 12 }],
      totalSize: 1,
      done: true,
    };
  }
  if (/GROUP BY Status/i.test(soql)) {
    return {
      records: [{ attributes: { type: 'AggregateResult' }, Status: 'Not Used Demo', cnt: 100 }],
      totalSize: 1,
      done: true,
    };
  }
  if (/Email LIKE/i.test(soql)) {
    return {
      records: [{ Id: '00Qfixture000001', Name: 'Test Lead', Email: 'test@example.com' }],
      totalSize: 1,
      done: true,
    };
  }
  if (/WHERE Id =/i.test(soql)) {
    return {
      records: [{ Id: '00Qfixture000001', Name: 'Test Lead' }],
      totalSize: 1,
      done: true,
    };
  }
  if (/FROM Lead/i.test(soql) && !/COUNT/i.test(soql)) {
    const records = Array.from({ length: 80 }, (_, i) => ({ Id: `00Q${i}`, Name: `Lead ${i}` }));
    return {
      records,
      totalSize: 80,
      done: false,
      nextRecordsUrl: '/services/data/v67.0/query/fixture-locator',
    };
  }
  return { records: [], totalSize: 0, done: true };
}

export function fixtureQueryMore(locator: string): unknown {
  if (locator.includes('fixture-locator')) {
    return {
      records: [{ Id: '00Qpaged001', Name: 'Paged Lead' }],
      totalSize: 1,
      done: true,
    };
  }
  throw new Error(`Unknown fixture query locator: ${locator}`);
}
