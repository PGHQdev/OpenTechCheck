// One-off generator: creates synthetic fixtures for a batch of new fingerprints.
// For each slug in SPECS, writes fixtures/<slug>/synthetic.bundle.json and runs
// the real detection engine to produce synthetic.expected.json, so the expected
// list always matches engine output.
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { detect, type SignalBundle } from '../packages/core/src/index'
import { compile } from '../packages/fingerprints/src/compile'

const ROOT = join(import.meta.dir, '..')
const REGISTRY = join(ROOT, 'packages/fingerprints/src/registry')
const FIXTURES = join(ROOT, 'fixtures')

// Minimal synthetic bundles, one per new fingerprint. Only the signals needed
// to trigger the fingerprint (and nothing else) are included.
const SPECS: Record<string, SignalBundle> = {
  'adobe-analytics': {
    url: 'https://example.com/',
    scripts: ['https://example.sc.omtrdc.net/opt.js'],
    cookies: { s_vi: '[CS]v1|2A5B7C9D00000000-4000000000000000' },
    js: { 's.account': 'myreportsuite' },
  },
  chartbeat: {
    url: 'https://example.com/',
    html: '<html><head><script>var _sf_async_config = {};</script><script src="https://static.chartbeat.com/js/chartbeat.js"></script></head></html>',
    scripts: ['https://static.chartbeat.com/js/chartbeat.js'],
  },
  contentsquare: {
    url: 'https://example.com/',
    scripts: ['https://t.contentsquare.net/uxa/5e7176b7f36c9e42.js'],
  },
  fullstory: {
    url: 'https://example.com/',
    html: "<html><head><script>window['_fs_host'] = 'fullstory.com';</script></head><script src=\"https://edge.fullstory.com/s/fs.js\"></script></html>",
    scripts: ['https://edge.fullstory.com/s/fs.js'],
  },
  logrocket: {
    url: 'https://example.com/',
    html: '<html><head><script>window._lr_env = "production";</script></head><script src="https://cdn.logrocket.com/LogRocket.min.js"></script></html>',
    scripts: ['https://cdn.logrocket.com/LogRocket.min.js'],
  },
  'lucky-orange': {
    url: 'https://example.com/',
    scripts: ['https://tools.luckyorange.com/core/lo.js?site-id=12345'],
    cookies: { __lo_uid: '123456789' },
  },
  mouseflow: {
    url: 'https://example.com/',
    html: '<html><head><script>var _mfq = _mfq || [];</script></head><script src="https://cdn.mouseflow.com/projects/12345.js"></script></html>',
    scripts: ['https://cdn.mouseflow.com/projects/12345.js'],
  },
  parsely: {
    url: 'https://example.com/',
    scripts: ['https://cdn.parsely.com/keys/example.com/p.js'],
  },
  'quantum-metric': {
    url: 'https://example.com/',
    scripts: ['https://cdn.quantummetric.com/qm/5e7176b7.js'],
    js: { QuantumMetricAPI: '[object Object]' },
  },
  'simple-analytics': {
    url: 'https://example.com/',
    scripts: ['https://scripts.simpleanalyticscdn.com/latest.js'],
  },
  smartlook: {
    url: 'https://example.com/',
    scripts: ['https://web.smartlook.com/recorder.js'],
    js: { smartlook: 'function smartlook() {}' },
  },
  snowplow: {
    url: 'https://example.com/',
    scripts: ['https://cdn.example.com/sp.js'],
    js: { GlobalSnowplowNamespace: '["snowplow"]' },
  },
  umami: {
    url: 'https://example.com/',
    html: '<html><head><script async defer data-website-id="abc123" src="/umami.js"></script></head></html>',
    scripts: ['/umami.js'],
  },
  vwo: {
    url: 'https://example.com/',
    html: '<html><head><script>var _vis_opt_account_id = 12345;</script></head><script src="https://dev.visualwebsiteoptimizer.com/lib/12345.js"></script></html>',
    scripts: ['https://dev.visualwebsiteoptimizer.com/lib/12345.js'],
    cookies: { _vwo_uuid: 'DDB14C0F1A2B3C4D' },
  },
  cloudinary: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg" alt="sample"></body></html>',
  },
  imgix: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://example.imgix.net/image.jpg?w=400" alt="sample"></body></html>',
  },
  keycdn: {
    url: 'https://example.com/',
    headers: { 'x-cdn': ['KeyCDN'] },
  },
  stackpath: {
    url: 'https://example.com/',
    headers: { 'x-sp-edge': ['HIT'] },
  },
  gcore: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://xyz.gcdn.co/images/banner.png" alt="banner"></body></html>',
    headers: { server: ['gcdn'] },
  },
  imagekit: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://ik.imagekit.io/demo/tr:w-400/sample.jpg" alt="sample"></body></html>',
  },
  umbraco: {
    url: 'https://example.com/',
    html: '<html><head><link href="/umbraco/assets/css/site.css" rel="stylesheet"></head></html>',
  },
  sitecore: {
    url: 'https://example.com/',
    cookies: { SC_ANALYTICS_GLOBAL_COOKIE: 'abc123def456' },
  },
  'optimizely-cms': {
    url: 'https://example.com/',
    html: '<html><head><link rel="stylesheet" href="/EPiServer/Shell/11.21.0/episerver.css"></head></html>',
  },
  storyblok: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://a.storyblok.com/f/1234/800x600/image.png" alt="image"></body></html>',
  },
  'builder-io': {
    url: 'https://example.com/',
    scripts: ['https://cdn.builder.io/js/builder-1.0.0.js'],
  },
  contentstack: {
    url: 'https://example.com/',
    html: '<html><body><img src="https://images.contentstack.io/v3/assets/blt1234/image.jpg" alt="image"></body></html>',
  },
  framer: {
    url: 'https://example.com/',
    html: '<html><head><link rel="canonical" href="https://example.framer.website/"></head></html>',
  },
  grav: {
    url: 'https://example.com/',
    meta: { generator: ['GravCMS'] },
  },
  shopware: {
    url: 'https://shop.example.com/',
    html: '<html><head><meta name="description" content="Powered by Shopware"></head></html>',
  },
  vtex: {
    url: 'https://www.example.com/',
    html: '<html><body><img src="https://example.vtexassets.com/arquivos/logo.png" alt="logo"></body></html>',
    cookies: { VtexIdclientAutCookie: 'eyJhbGciOiJIUzI1NiJ9' },
  },
  'big-cartel': {
    url: 'https://example.bigcartel.com/',
    html: '<html><body><a href="https://example.bigcartel.com/product/t-shirt">Buy</a></body></html>',
  },
  gumroad: {
    url: 'https://example.com/',
    scripts: ['https://gumroad.com/js/gumroad.js'],
  },
  snipcart: {
    url: 'https://example.com/',
    scripts: ['https://cdn.snipcart.com/themes/v3.0.0/default/snipcart.js'],
    js: { Snipcart: '[object Object]' },
  },
  'lemon-squeezy': {
    url: 'https://example.com/',
    scripts: ['https://app.lemonsqueezy.com/js/checkout.js'],
  },
  render: {
    url: 'https://example.onrender.com/',
    html: '<html><head><link rel="stylesheet" href="https://example.onrender.com/styles.css"></head></html>',
  },
  railway: {
    url: 'https://example.up.railway.app/',
    html: '<html><head><link rel="canonical" href="https://example.up.railway.app/"></head></html>',
  },
  surge: {
    url: 'https://example.surge.sh/',
    html: '<html><head><link rel="canonical" href="https://example.surge.sh/"></head></html>',
  },
  digitalocean: {
    url: 'https://example.ondigitalocean.app/',
    html: '<html><head><link rel="canonical" href="https://example.ondigitalocean.app/"></head></html>',
  },
  pantheon: {
    url: 'https://live-example.pantheonsite.io/',
    html: '<html><head><link rel="canonical" href="https://live-example.pantheonsite.io/"></head></html>',
  },
  qwik: {
    url: 'https://example.com/',
    html: '<html q:container=""><head></head><body></body></html>',
    scripts: ['https://example.com/build/qwikloader.js'],
  },
  inferno: {
    url: 'https://example.com/',
    js: { 'Inferno.version': '8.2.3' },
  },
  'petite-vue': {
    url: 'https://example.com/',
    html: '<html><body><div v-scope="{ count: 0 }"></div></body></html>',
    scripts: ['/js/petite-vue.iife.js'],
  },
  aurelia: {
    url: 'https://example.com/',
    html: '<html><body aurelia-app="main"></body></html>',
  },
  java: {
    url: 'https://example.com/',
    cookies: { JSESSIONID: 'A1B2C3D4E5F6G7H8' },
  },
  moment: {
    url: 'https://example.com/',
    js: { 'moment.version': '2.29.4' },
  },
  dayjs: {
    url: 'https://example.com/',
    js: { dayjs: 'function dayjs() { [native code] }' },
  },
  'date-fns': {
    url: 'https://example.com/',
    scripts: ['https://cdn.jsdelivr.net/npm/date-fns@2.29.3/index.js'],
  },
  underscore: {
    url: 'https://example.com/',
    scripts: ['/assets/underscore-min.js'],
  },
  zepto: {
    url: 'https://example.com/',
    scripts: ['/js/zepto.min.js'],
    js: { Zepto: 'function() { return [] }' },
  },
  requirejs: {
    url: 'https://example.com/',
    js: { 'requirejs.version': '2.3.6' },
  },
  systemjs: {
    url: 'https://example.com/',
    scripts: ['/js/systemjs.min.js'],
    js: { 'System.version': '6.14.1' },
  },
  leaflet: {
    url: 'https://example.com/',
    scripts: ['/js/leaflet.js'],
    js: { 'L.version': '1.9.4' },
  },
  'mapbox-gl': {
    url: 'https://example.com/',
    scripts: ['https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'],
    js: { 'mapboxgl.version': '3.0.1' },
  },
  videojs: {
    url: 'https://example.com/',
    scripts: ['/js/video.js'],
    js: { 'videojs.version': '8.6.0' },
  },
  photoswipe: {
    url: 'https://example.com/',
    html: '<html><body><div class="pswp__ui pswp__ui--hidden"></div></body></html>',
    scripts: ['/js/photoswipe.min.js'],
  },
  fullcalendar: {
    url: 'https://example.com/',
    scripts: ['/js/fullcalendar/index.global.min.js'],
  },
  dojo: {
    url: 'https://example.com/',
    js: { 'dojo.version': '1.17.3' },
  },
  aos: {
    url: 'https://example.com/',
    html: '<html><body><div data-aos="fade-up"></div></body></html>',
  },
  fancybox: {
    url: 'https://example.com/',
    html: '<html><body><a href="img.jpg" data-fancybox="gallery"><img src="thumb.jpg"></a></body></html>',
  },
  simplebar: {
    url: 'https://example.com/',
    html: '<html><body><div data-simplebar></div></body></html>',
  },
  pixijs: {
    url: 'https://example.com/',
    js: { 'PIXI.VERSION': '7.4.0' },
  },
  echarts: {
    url: 'https://example.com/',
    js: { 'echarts.version': '5.4.3' },
  },
  highcharts: {
    url: 'https://example.com/',
    js: { 'Highcharts.version': '11.2.0' },
  },
  amcharts: {
    url: 'https://example.com/',
    scripts: ['/amcharts4/core.js'],
    js: { am4core: '[object Object]' },
  },
  plotly: {
    url: 'https://example.com/',
    js: { 'Plotly.version': '2.27.0' },
  },
  apexcharts: {
    url: 'https://example.com/',
    js: { 'ApexCharts.version': '3.45.1' },
  },
  sweetalert2: {
    url: 'https://example.com/',
    js: { 'Swal.version': '11.10.1' },
  },
  'google-ads': {
    url: 'https://example.com/',
    html: "<html><head><script>gtag('event', 'conversion', { send_to: 'AW-123456789' });</script></head><script src=\"https://www.googleadservices.com/pagead/conversion.js\"></script></html>",
    scripts: ['https://www.googleadservices.com/pagead/conversion.js'],
  },
  'tiktok-pixel': {
    url: 'https://example.com/',
    scripts: ['https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=ABC123'],
    js: { ttq: '[object Object]' },
  },
  'pinterest-tag': {
    url: 'https://example.com/',
    scripts: ['https://ct.pinterest.com/v3/?tid=2612345678901'],
    js: { pintrk: 'function pintrk() {}' },
  },
  'twitter-pixel': {
    url: 'https://example.com/',
    scripts: ['https://static.ads-twitter.com/uwt.js'],
    js: { twq: 'function twq() {}' },
  },
  'snap-pixel': {
    url: 'https://example.com/',
    scripts: ['https://sc-static.net/scevent.min.js'],
    js: { snaptr: 'function snaptr() {}' },
  },
  'reddit-pixel': {
    url: 'https://example.com/',
    scripts: ['https://www.redditstatic.com/ads/pixel.js'],
    js: { rdt: 'function rdt() {}' },
  },
  braze: {
    url: 'https://example.com/',
    scripts: ['https://js.appboycdn.com/web-sdk/4.8/appboy.min.js'],
    js: { appboy: '[object Object]' },
  },
  'customer-io': {
    url: 'https://example.com/',
    scripts: ['https://assets.customer.io/assets/track.js'],
    js: { _cio: '[object Object]' },
  },
  iterable: {
    url: 'https://example.com/',
    scripts: ['https://js.iterable.com/analytics.js'],
  },
  activecampaign: {
    url: 'https://example.com/',
    html: '<html><body><form action="https://xyz.activehosted.com/proc.php" method="post"></form></body></html>',
    scripts: ['https://trackcmp.net/visit/pr.js'],
  },
  convertkit: {
    url: 'https://example.com/',
    scripts: ['https://f.convertkit.com/ckjs/ck.5.js'],
  },
  omnisend: {
    url: 'https://example.com/',
    scripts: ['https://cdn.omnisend.com/inshop/tracker.js'],
  },
  marketo: {
    url: 'https://example.com/',
    scripts: ['https://munchkin.marketo.net/munchkin.js'],
    js: { Munchkin: 'function Munchkin() {}' },
  },
  eloqua: {
    url: 'https://example.com/',
    scripts: ['https://img.en25.com/i/elqCfg.min.js'],
    js: { _elqQ: '[object Array]' },
  },
  pardot: {
    url: 'https://example.com/',
    scripts: ['https://pi.pardot.com/pd.js'],
  },
  drift: {
    url: 'https://example.com/',
    scripts: ['https://js.drift.com/include/abc123/abc123.js'],
    js: { driftt: '[object Object]' },
  },
  livechat: {
    url: 'https://example.com/',
    scripts: ['https://cdn.livechatinc.com/tracking.js'],
    js: { LC_API: '[object Object]' },
  },
  freshworks: {
    url: 'https://example.com/',
    scripts: ['https://widget.freshdesk.com/widgets/abc123.js'],
    js: { fcWidget: '[object Object]' },
  },
  sharethis: {
    url: 'https://example.com/',
    scripts: ['https://platform-api.sharethis.com/js/sharethis.js'],
  },
  optimizely: {
    url: 'https://example.com/',
    html: '<html><head><script>window.optimizely = window.optimizely || [];</script></head><script src="https://cdn.optimizely.com/js/12345678.js"></script></html>',
    scripts: ['https://cdn.optimizely.com/js/12345678.js'],
  },
  wasm: {
    url: 'https://example.com/',
    html: '<html><head><link rel="preload" href="/app.wasm" as="fetch" type="application/wasm"></head></html>',
    scripts: ['/wasm/module.wasm'],
  },
  'twitter-cards': {
    url: 'https://example.com/',
    meta: { 'twitter:card': ['summary_large_image'] },
  },
  'json-ld': {
    url: 'https://example.com/',
    html: '<html><head><script type="application/ld+json">{"@context":"https://schema.org"}</script></head></html>',
  },
  'adobe-typekit': {
    url: 'https://example.com/',
    html: '<html><head><link rel="stylesheet" href="https://use.typekit.net/abc1def.css"></head></html>',
  },
  firebase: {
    url: 'https://example.web.app/',
    html: '<html><head><link rel="canonical" href="https://example.web.app/"></head></html>',
    js: { 'firebase.SDK_VERSION': '10.7.1' },
  },
  supabase: {
    url: 'https://example.com/',
    html: '<html><body><script>fetch("https://xyzcompany.supabase.co/rest/v1/todos")</script></body></html>',
  },
  algolia: {
    url: 'https://example.com/',
    scripts: ['https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch.umd.js'],
    js: { algoliasearch: 'function algoliasearch() {}' },
  },
  onesignal: {
    url: 'https://example.com/',
    scripts: ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'],
    js: { OneSignal: '[object Object]' },
  },
  'socket-io': {
    url: 'https://example.com/',
    scripts: ['/socket.io/socket.io.js'],
  },
  'datadog-rum': {
    url: 'https://example.com/',
    scripts: ['https://www.datadoghq-browser-agent.com/datadog-rum-v5.js'],
    js: { DD_RUM: '[object Object]' },
  },
  bugsnag: {
    url: 'https://example.com/',
    scripts: ['https://d2wy8f7a9ursn2.cloudfront.net/v7/bugsnag.min.js'],
    js: { Bugsnag: '[object Object]' },
  },
  disqus: {
    url: 'https://example.com/',
    html: '<html><body><div id="disqus_thread"></div></body></html>',
    scripts: ['https://example.disqus.com/embed.js'],
  },
  'google-adsense': {
    url: 'https://example.com/',
    html: '<html><body><ins class="adsbygoogle"></ins></body></html>',
    scripts: ['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'],
  },
  adyen: {
    url: 'https://shop.example.com/',
    scripts: ['https://checkoutshopper-live.adyen.com/checkoutshopper/sdk/5.40.0/adyen.js'],
  },
  'checkout-com': {
    url: 'https://example.com/',
    scripts: ['https://cdn.checkout.com/js/checkout.js'],
  },
  'authorize-net': {
    url: 'https://example.com/',
    scripts: ['https://js.authorize.net/v1/Accept.js'],
  },
  mollie: {
    url: 'https://example.com/',
    scripts: ['https://js.mollie.com/v1/mollie.js'],
  },
  paddle: {
    url: 'https://example.com/',
    scripts: ['https://cdn.paddle.com/paddle/paddle.js'],
    js: { Paddle: '[object Object]' },
  },
  chargebee: {
    url: 'https://example.com/',
    scripts: ['https://js.chargebee.com/v2/chargebee.js'],
  },
  'apple-pay': {
    url: 'https://shop.example.com/',
    js: { ApplePaySession: 'function ApplePaySession() { [native code] }' },
  },
  'google-pay': {
    url: 'https://shop.example.com/',
    js: { 'google.payments.api.PaymentsClient': '[object Object]' },
  },
  datadome: {
    url: 'https://example.com/',
    headers: { 'x-datadome': ['protected'] },
    cookies: { datadome: 'ABC123def456' },
  },
  imperva: {
    url: 'https://example.com/',
    headers: { 'x-iinfo': ['10-1-100-1abc'] },
  },
  tomcat: {
    url: 'https://example.com/',
    headers: { server: ['Apache-Coyote/1.1'] },
  },
  kong: {
    url: 'https://api.example.com/',
    headers: { 'x-kong-proxy-latency': ['2'], via: ['kong/3.4.0'] },
  },
  jetty: {
    url: 'https://example.com/',
    headers: { server: ['Jetty(9.4.51.v20230217)'] },
  },
  kestrel: {
    url: 'https://example.com/',
    headers: { server: ['Kestrel'] },
  },
  ensighten: {
    url: 'https://example.com/',
    scripts: ['https://nexus.ensighten.com/example/prod/serverComponent.php'],
  },
  'commanders-act': {
    url: 'https://example.com/',
    scripts: ['https://cdn.tagcommander.com/1234/tc_example.js'],
  },
  'chakra-ui': {
    url: 'https://example.com/',
    html: '<html><body><button class="chakra-button css-1a2b3c">Buy now</button></body></html>',
  },
  mantine: {
    url: 'https://example.com/',
    html: '<html><body><button class="mantine-Button-root mantine-1a2b3c">Buy now</button></body></html>',
  },
  materialize: {
    url: 'https://example.com/',
    html: '<html><body><a class="btn-floating btn-large waves-effect waves-light"><i class="material-icons">add</i></a></body></html>',
    scripts: ['/js/materialize.min.js'],
  },
  uikit: {
    url: 'https://example.com/',
    html: '<html><body><div class="uk-grid" uk-grid></div></body></html>',
    scripts: ['/js/uikit.min.js'],
  },
  'semantic-ui': {
    url: 'https://example.com/',
    html: '<html><body><div class="ui stackable menu"></div></body></html>',
    scripts: ['/semantic/semantic.min.js'],
  },
  vuetify: {
    url: 'https://example.com/',
    html: '<html><body><div id="app" class="v-application"></div></body></html>',
  },
  vimeo: {
    url: 'https://example.com/',
    html: '<html><body><iframe src="https://player.vimeo.com/video/123456789"></iframe></body></html>',
    scripts: ['https://player.vimeo.com/api/player.js'],
  },
  wistia: {
    url: 'https://example.com/',
    scripts: ['https://fast.wistia.com/assets/external/E-v1.js'],
    js: { Wistia: '[object Object]' },
  },
  brightcove: {
    url: 'https://example.com/',
    scripts: ['https://players.brightcove.net/123456789/default_default/index.min.js'],
  },
  'jw-player': {
    url: 'https://example.com/',
    scripts: ['/jwplayer/jwplayer.js'],
    js: { jwplayer: 'function jwplayer() {}' },
  },
  dailymotion: {
    url: 'https://example.com/',
    html: '<html><body><iframe src="https://www.dailymotion.com/embed/video/x8abcdef"></iframe></body></html>',
  },
  codeigniter: {
    url: 'https://example.com/',
    cookies: { ci_session: 'abc123def456789' },
  },
  cakephp: {
    url: 'https://example.com/',
    cookies: { CAKEPHP: 'def456abc123789' },
  },
  meteor: {
    url: 'https://example.com/',
    html: '<html><head><script type="text/javascript">window.__meteor_runtime_config__ = {"ROOT_URL":"https://example.com"};</script></head></html>',
  },
  blazor: {
    url: 'https://example.com/',
    scripts: ['/_framework/blazor.web.js'],
  },
  livewire: {
    url: 'https://example.com/',
    html: '<html><body><div wire:id="abc123" wire:initial-data="{}"></div></body></html>',
  },
}

const { fingerprints, errors } = compile(REGISTRY)
if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

let written = 0
for (const [slug, bundle] of Object.entries(SPECS)) {
  const dir = join(FIXTURES, slug)
  const exists = readdirSync(FIXTURES, { withFileTypes: true }).some((e) => e.isDirectory() && e.name === slug)
  if (exists) {
    console.log(`skip ${slug}: fixture already exists`)
    continue
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'synthetic.bundle.json'), JSON.stringify(bundle, null, 2) + '\n')
  const detects = detect(bundle, fingerprints).map((d) => d.slug).sort()
  writeFileSync(join(dir, 'synthetic.expected.json'), JSON.stringify({ detects }, null, 2) + '\n')
  console.log(`${slug}: ${detects.join(', ')}`)
  written++
}
console.log(`wrote ${written} fixtures (${fingerprints.length} fingerprints compiled)`)
