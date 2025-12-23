export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', ''), // Public URL for Strapi (e.g. from Cloudflare)
  app: {
    keys: env.array('APP_KEYS'),
  },
});
