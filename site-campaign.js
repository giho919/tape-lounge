/* Owned social campaign labels only. Never retain full incoming URLs or arbitrary values. */
((root) => {
  'use strict';
  const topics = ['andy_scan','kimchi_fx','session_championship','daily_blind','site_launch'];
  const paths = ['/','/domestic/','/desk/','/analysis/','/onchain/','/calendar/','/blind/','/strategists/'];
  const campaignPattern = /^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch)(_[0-9]{8})?$/;
  const sourceName = value => value === 'twitter' ? 'x' : value;
  function parse(search) {
    const params = new URLSearchParams(search);
    for (const key of ['utm_source','utm_medium','utm_campaign']) if (params.getAll(key).length !== 1) return null;
    const source = sourceName(params.get('utm_source').trim().toLowerCase());
    const medium = params.get('utm_medium').trim().toLowerCase();
    const campaign = params.get('utm_campaign').trim().toLowerCase();
    if (!['threads','x'].includes(source) || medium !== 'social' || !campaignPattern.test(campaign)) return null;
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
    if (original.pathname === '/blind/' && (daily === '1' || /^\d{4}-\d{2}-\d{2}$/.test(daily || ''))) url.searchParams.set('daily',daily);
    url.searchParams.set('utm_source',labels.source);url.searchParams.set('utm_medium','social');url.searchParams.set('utm_campaign',labels.campaign);
    if (original.pathname === '/' && original.hash === '#loungeChart') url.hash='loungeChart';
    return url.href;
  }
  const api = Object.freeze({parse,route,tag,topics:Object.freeze(topics)});
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.TapeCampaign=api;
})(typeof window === 'undefined' ? globalThis : window);
