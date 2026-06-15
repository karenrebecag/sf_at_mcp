/**
 * Curated data dictionary for the ATFX org, exposed as an MCP resource
 * (schema://atfx) and summarized in the server instructions.
 *
 * This is intentionally NOT the full schema: Lead alone has 418 fields. Dumping
 * everything would bloat context and mislead the model. Listed here are the
 * high-signal fields and picklist values for the objects users actually query.
 * For exhaustive field lists, the salesforce_atfx_describe_object tool returns
 * the live describe of any object.
 *
 * Verified against the live org on 2026-06-15.
 */
export const SCHEMA_RESOURCE_URI = 'schema://atfx';

export const SCHEMA_MD = `# ATFX Salesforce — data dictionary (curated)

Brokerage CRM. The pipeline is **Lead → Account** (conversion). **There is NO
Opportunity object** in this org — never query it. "BDM" is the record **Owner**;
use the \`Owner.Name\` relationship (group/filter by it), never the raw OwnerId.

Country fields are **ISO-3 picklists** and differ per object:
- Lead → \`Country_of_Residence_Lead__c\`
- Account → \`Country_of_Residence_Account__c\`
- Contact → \`Country_of_Residence__c\`

Scope every query (WHERE / LIMIT): Account has ~55k+ records. Use SOQL date
literals (LAST_N_DAYS:30, THIS_MONTH, LAST_MONTH) on CreatedDate or the object's
own date fields. Watch for bulk-load spikes that distort "growth" (e.g. a single
day can hold thousands of migrated leads).

## Lead  (418 fields; 369 custom — only the useful ones below)
- **Identity:** FirstName, LastName, Name, Company, Email, Phone, MobilePhone
- **Owner / BDM:** OwnerId → \`Owner.Name\`
- **Geography:** \`Country_of_Residence_Lead__c\` (ISO-3 picklist: MEX, ARG, CHL, MYS, COL, PER, ZAF, ECU, URY, PRY…), Nationality__c, Province__c, City, State
- **Lifecycle / status:** \`Status\` picklist = [Not Used Demo | Used Demo | Interested to Open Account | Pending Submitted Application | Live | Stage 6 - Dead]; \`IsConverted\` (bool), ConvertedDate, \`Converted_Date__c\`, \`Lead_Type__c\`, \`Client_Type__c\`, \`Lead_Validity__c\`, \`KycStatus__c\`
- **Demo activity:** \`Is_Demo_Downloaded__c\`, \`Demo_Account_Number__c\`, \`Demo_Account_Balance__c\`, \`First_Demo_Trade_Date__c\`
- **Marketing / source:** LeadSource, \`Client_Source__c\`, \`Lead_Source_Fix__c\`, \`utm_source__c\`, \`utm_medium__c\`, \`utm_campaign__c\`, \`utm_term__c\`, \`utm_content__c\`, \`Latest_UTM_Source__c\`, gaconnector_* family
- **Dates / activity:** CreatedDate, \`First_Contact_Date__c\`, \`Last_Activity_Days__c\`, \`Last_Call_Date__c\`, \`Last_Assign_Date__c\`
- **Flags:** \`Is_Blacklist__c\`, \`IsSalesLead__c\`, \`Is_Test_Account__c\`, Do_Not_Call__c, Do_Not_Email__c

## Account  (79 fields; 58 custom)
- **Identity:** Name, OwnerId → \`Owner.Name\`, \`Email__c\`
- **Type:** \`Type\` = [IB | Client | Sales]; \`Client_Source__c\` = [Direct Client | Direct IB | IB Client | IB By IB]; \`Client_Type_2__c\` = [Individual | Corporate]
- **Geography:** \`Country_of_Residence_Account__c\` (ISO-3), Area_Name__c
- **Lifecycle:** \`Account_Validity__c\`, \`Activated_Date__c\`, \`Is_Test_Account__c\`
- **Funnel dates:** \`AccountCreateDate__c\`, \`First_Registrant_Date__c\`, \`First_Deposit_Date2_0__c\`, \`First_Trade_Date__c\`, \`Last_registration_date__c\`
- **Marketing:** \`Latest_UTM_Source__c\`, \`Live_UTM_Source__c\`

## Contact  (66 fields; 25 custom)
- **Identity:** Name, Email, Phone, OwnerId → \`Owner.Name\`, AccountId → \`Account.Name\`
- **Status:** \`BOS_Status__c\` (coded picklist: V, P, WR, O, T1–T6, NR, A, RW, N, F0–F3, TE)
- **Source:** ContactSource = [Auto Create | Email Message | Meeting Digest | Seller Home], \`Latest_UTM_source__c\`, \`First_Click_Source__c\`
- **Geography / dates:** \`Country_of_Residence__c\` (ISO-3), \`Registration_Date__c\`

## Common SOQL patterns
- Leads this month by BDM: \`SELECT Owner.Name, COUNT(Id) FROM Lead WHERE CreatedDate = THIS_MONTH GROUP BY Owner.Name ORDER BY COUNT(Id) DESC\`
- Leads last 30 days by country: \`SELECT Country_of_Residence_Lead__c, COUNT(Id) FROM Lead WHERE CreatedDate = LAST_N_DAYS:30 GROUP BY Country_of_Residence_Lead__c ORDER BY COUNT(Id) DESC\`
- Conversion rate: compare \`COUNT(Id)\` with \`WHERE IsConverted = true\` over the same window.
`;
