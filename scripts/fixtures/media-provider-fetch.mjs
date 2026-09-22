// Loaded only by the isolated integration test; no real provider calls are allowed.
import { appendFileSync } from 'node:fs';
const originalFetch = globalThis.fetch;
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const record = (provider, since) => appendFileSync(process.env.MEDIA_TEST_CALLS, provider + ':' + since + '\n');
let metaAdsAttempts = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return originalFetch(input, init);
  if ((url.hostname === 'www.googleapis.com' && url.pathname === '/oauth2/v3/token') || (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token'))
    return reply({access_token:'fixture-access'});
  if (url.hostname === 'googleads.googleapis.com') {
    if (url.pathname.endsWith(':listAccessibleCustomers')) return reply({resourceNames:['customers/123']});
    const query = JSON.parse(init.body).query;
    // Modo cota esgotada: toda consulta recebe o mesmo bloqueio diário que o Google devolve.
    if (process.env.MEDIA_TEST_GOOGLE_QUOTA === '1') {
      record('google-quota', 'x');
      return reply({error:{code:429,message:'Resource has been exhausted (e.g. check quota).',status:'RESOURCE_EXHAUSTED',details:[{errors:[{message:'Too many requests. Retry in 55973 seconds.',details:{quotaErrorDetails:{rateName:'Number of operations for Basic/Explorer access',rateScope:'DEVELOPER',retryDelay:'55973s'}}}]}]}},429);
    }
    if (query.includes('FROM customer_client')) return reply([{results:[{customerClient:{id:'123',descriptiveName:'Shared Google',currencyCode:'BRL',manager:false}}]}]);
    // Histórico diário: uma linha por dia do intervalo, com gasto igual ao dia do mês (em reais).
    if (query.startsWith('SELECT segments.date')) {
      const [, from, to] = query.match(/BETWEEN '([^']+)' AND '([^']+)'/);
      record('google-daily', from);
      await new Promise(resolve => setTimeout(resolve, 20));
      if (from.startsWith('2020')) return reply({error:{message:'Fixture provider unavailable'}},503);
      const rows = [];
      for (const day = new Date(from + 'T12:00:00Z'); day <= new Date(to + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
        const date = day.toISOString().slice(0, 10);
        rows.push({segments:{date},campaign:{id:'g1'},metrics:{costMicros:String(Number(date.slice(-2)) * 1000000),impressions:'100',clicks:'10',conversions:2}});
      }
      return reply([{results:rows}]);
    }
    // Cadastro atual das campanhas (sem período).
    if (/FROM campaign\s*$/.test(query))
      return reply([{results:[{customer:{id:'123',descriptiveName:'Shared Google',currencyCode:'BRL'},campaign:{id:'g1',name:'Google campaign',status:'ENABLED',advertisingChannelType:'SEARCH'},campaignBudget:{amountMicros:'10000000',period:'DAILY'}}]}]);
    if (query.includes('FROM account_budget')) return reply([{results:[{accountBudget:{status:'APPROVED',approvedSpendingLimitMicros:'50000000',amountServedMicros:'20000000',approvedEndTimeType:'FOREVER'}}]}]);
    if (query.includes('FROM campaign ')) {
      if (!query.includes('segments.date'))
        return reply([{results:[{campaign:{id:'g1'},campaignBudget:{totalAmountMicros:'50000000',period:'CUSTOM_PERIOD'},metrics:{costMicros:'20000000'}}]}]);
      const since = query.match(/BETWEEN '([^']+)'/)[1];
      record('google', since);
      await new Promise(resolve => setTimeout(resolve,100));
      if (since.startsWith('2020')) return reply({error:{message:'Fixture provider unavailable'}},502);
      return reply([{results:[{campaign:{id:'g1',name:'Google campaign',status:'ENABLED'},campaignBudget:{amountMicros:'10000000',period:'DAILY'},metrics:{costMicros:String(Number(since.slice(-2))*1000000),impressions:'100',clicks:'10',conversions:2}}]}]);
    }
    // Consultas de detalhes com período, registradas por data inicial.
    const detailPeriod = query.match(/BETWEEN '([^']+)'/);
    if (detailPeriod && /FROM (ad_group_ad|search_term_view|geographic_view) /.test(query)) record('google-details', detailPeriod[1]);
    return reply([{results:[]}]);
  }
  if (url.hostname === 'graph.facebook.com') {
    const path=url.pathname.replace(/^\/v[^/]+\//,'');
    const token=url.searchParams.get('access_token');
    // Simula um login cujo aplicativo do Facebook foi apagado: toda chamada com este
    // token recebe a mesma recusa que a Meta devolve nesse caso, para qualquer conta.
    if (token === 'dead-meta-token')
      return reply({error:{message:'Error validating application. Application has been deleted.',type:'OAuthException',code:190}},400);
    if (token === 'good-meta-token') {
      if (path === 'me/adaccounts') return reply({data:[{id:'act_ok'},{id:'act_bad'}]});
      if (path === 'act_ok') return reply({id:'act_ok',name:'Conta Boa',currency:'BRL'});
      // Conta com um problema permanente (ex.: permissão revogada): a conta é
      // ignorada, mas não pode derrubar a sincronização da conta saudável.
      if (path === 'act_bad') return reply({error:{message:'Unsupported get request.',code:100}},400);
      if (path === 'act_ok/campaigns') return reply({data:[{id:'c1',name:'Camp OK',objective:'TRAFFIC',status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'1000'}]});
      if (path === 'act_ok/adsets') return reply({data:[]});
      if (path === 'act_ok/ads') {
        metaAdsAttempts += 1;
        record('meta-ads-attempt', String(metaAdsAttempts));
        // A primeira tentativa falha por um erro transitório (não é um dos códigos de
        // limite de taxa já tratados); a segunda, feita pela retentativa, funciona.
        if (metaAdsAttempts === 1) return reply({error:{message:'An unknown error occurred',code:1}},500);
        return reply({data:[{id:'ad1',name:'Anúncio 1',status:'ACTIVE',effective_status:'ACTIVE',campaign_id:'c1',creative:{id:'cr1',name:'Criativo',image_url:'https://example.invalid/img.png'}}]});
      }
      if (path === 'act_ok/insights') {
        if (url.searchParams.get('level') === 'ad')
          return reply({data:[{ad_id:'ad1',spend:'5',impressions:'50',clicks:'5',actions:[{action_type:'lead',value:'1'}]}]});
        if (url.searchParams.has('breakdowns')) return reply({data:[]});
        return reply({data:[{campaign_id:'c1',spend:'20',reach:'300',impressions:'1000',clicks:'40',actions:[{action_type:'lead',value:'4'}]}]});
      }
      return reply({data:[]});
    }
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
