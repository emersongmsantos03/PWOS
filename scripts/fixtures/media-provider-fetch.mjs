// Loaded only by the isolated integration test; no real provider calls are allowed.
import { appendFileSync } from 'node:fs';
const originalFetch = globalThis.fetch;
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const record = (provider, since) => appendFileSync(process.env.MEDIA_TEST_CALLS, provider + ':' + since + '\n');
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return originalFetch(input, init);
  if (url.hostname === 'www.googleapis.com' && url.pathname === '/oauth2/v3/token')
    return reply({access_token:'fixture-access'});
  if (url.hostname === 'googleads.googleapis.com') {
    if (url.pathname.endsWith(':listAccessibleCustomers')) return reply({resourceNames:['customers/123']});
    const query = JSON.parse(init.body).query;
    if (query.includes('FROM customer_client')) return reply([{results:[{customerClient:{id:'123',descriptiveName:'Shared Google',currencyCode:'BRL',manager:false}}]}]);
    if (query.includes('FROM campaign ')) {
      const since = query.match(/BETWEEN '([^']+)'/)[1];
      record('google', since);
      await new Promise(resolve => setTimeout(resolve,100));
      if (since.startsWith('2020')) return reply({error:{message:'Fixture provider unavailable'}},502);
      return reply([{results:[{campaign:{id:'g1',name:'Google campaign',status:'ENABLED'},campaignBudget:{amountMicros:'10000000',period:'DAILY'},metrics:{costMicros:String(Number(since.slice(-2))*1000000),impressions:'100',clicks:'10',conversions:2}}]}]);
    }
    return reply([{results:[]}]);
  }
  if (url.hostname === 'graph.facebook.com') {
    const path=url.pathname.replace(/^\/v[^/]+\//,'');
    if (path === 'me/adaccounts') return reply({data:[{id:'act_123'}]});
    if (path === 'act_123') return reply({id:'act_123',name:'Shared Meta',currency:'BRL'});
    if (path.endsWith('/campaigns')) return reply({data:[{id:'m1',name:'Meta campaign',status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'1000'}]});
    if (path.endsWith('/insights') && url.searchParams.get('level') === 'campaign' && !url.searchParams.has('breakdowns')) {
      const since=JSON.parse(url.searchParams.get('time_range')).since;
      record('meta',since);
      await new Promise(resolve=>setTimeout(resolve,100));
      if (since.startsWith('2020')) return reply({error:{message:'Fixture provider unavailable'}},502);
      return reply({data:[{campaign_id:'m1',spend:since.slice(-2),impressions:'100',clicks:'10',reach:'80',actions:[{action_type:'lead',value:'2'}]}]});
    }
    return reply({data:[]});
  }
  throw new Error('Unexpected external request in test: '+url.origin);
};
