/* Owned social campaign labels only. Never retain full incoming URLs or arbitrary values. */
((root) => {
  'use strict';
  const topics = ['andy_scan','kimchi_fx','session_championship','daily_blind','site_launch'];
  const socialSources = ['threads','x','instagram'];
  const blindPaths = new Set(['/blind/','/en/tools/blind/','/zh/tools/blind/','/ja/tools/blind/']);
  const paths = ['/','/domestic/','/desk/','/analysis/','/onchain/','/calendar/','/strategists/',...blindPaths];
  const campaignPattern = /^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch)(_[0-9]{8})?$/;
  const sourceName = value => value === 'twitter' ? 'x' : value;
  function parse(search) {
    const params = new URLSearchParams(search);
    for (const key of ['utm_source','utm_medium','utm_campaign']) if (params.getAll(key).length !== 1) return null;
    const source = sourceName(params.get('utm_source').trim().toLowerCase());
    const medium = params.get('utm_medium').trim().toLowerCase();
    let campaign = params.get('utm_campaign').trim().toLowerCase();
    // Keep already-published blind-chart links attributable after the topic was
    // standardized to daily_blind; the database only receives the canonical label.
    campaign = campaign.replace(/^blind_chart_game(?=_|$)/, 'daily_blind');
    const isSocial = socialSources.includes(source) && medium === 'social' && campaignPattern.test(campaign);
    const isDirectShare = source === 'share' && medium === 'referral' && ['decision_game','daily_blind'].includes(campaign);
    if (!isSocial && !isDirectShare) return null;
    return {source,campaign};
  }
  function route(search) {
    const campaign = parse(search);
    return campaign ? {rpc:'record_site_campaign_activity',fields:{p_campaign_source:campaign.source,p_campaign_name:campaign.campaign}}
      : {rpc:'record_site_activity',fields:{}};
  }
  function tag(target, source, campaign) {
    const original = new URL(target);
    if (original.origin !== 'https://tapelounge.com' || original.username || original.password || !paths.includes(original.pathname)) throw new Error('Only public Tape Lounge tools can be tagged');
    const labels = parse(new URLSearchParams({utm_source:source,utm_medium:'social',utm_campaign:campaign}));
    if (!labels) throw new Error('Unknown campaign labels');
    const url = new URL(original.pathname, 'https://tapelounge.com');
    const chart = original.searchParams.get('chart'), tf = original.searchParams.get('tf'), daily = original.searchParams.get('daily');
    if (['BTC','ETH','BTC.D','NASDAQ'].includes(chart)) url.searchParams.set('chart',chart);
    if (['1m','15m','1h','4h','1d','1w','1M'].includes(tf)) url.searchParams.set('tf',tf);
    if (blindPaths.has(original.pathname) && (daily === '1' || /^\d{4}-\d{2}-\d{2}$/.test(daily || ''))) url.searchParams.set('daily',daily);
    url.searchParams.set('utm_source',labels.source);url.searchParams.set('utm_medium','social');url.searchParams.set('utm_campaign',labels.campaign);
    if (original.pathname === '/' && original.hash === '#loungeChart') url.hash='loungeChart';
    return url.href;
  }
  function tagDailyBlindShare(target) {
    const original = new URL(target);
    const day = original.searchParams.get('daily');
    const dayTime = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00.000Z`) : NaN;
    const validDay = Number.isFinite(dayTime) && new Date(dayTime).toISOString().slice(0,10) === day;
    const version = original.searchParams.get('v');
    if (original.origin !== 'https://tapelounge.com' || original.username || original.password || !blindPaths.has(original.pathname) || !validDay || (version && version !== '2')) {
      throw new Error('Only a valid daily blind-chart round can be shared');
    }
    const url = new URL(original.pathname, 'https://tapelounge.com');
    url.searchParams.set('daily',day);
    if (version === '2') url.searchParams.set('v','2');
    url.searchParams.set('utm_source','share');
    url.searchParams.set('utm_medium','referral');
    url.searchParams.set('utm_campaign','daily_blind');
    return url.href;
  }
  const api = Object.freeze({parse,route,tag,tagDailyBlindShare,topics:Object.freeze(topics)});
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.TapeCampaign=api;
})(typeof window === 'undefined' ? globalThis : window);
