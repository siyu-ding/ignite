# CloudBase analytics deployment

Target environment: `ignite-d1g1f7k2pb353470e` (Shanghai, free trial).

1. Create the PostgreSQL table `public.analytics_events` and grant the
   `service_role` the required `SELECT`, `INSERT`, and `UPDATE` permissions.
2. Deploy `functions/analytics` as a Node.js cloud function named `analytics`.
3. Inject a server-side CloudBase API Key as `CLOUDBASE_APIKEY` in the function.
4. Create an HTTP access route such as `POST /analytics` pointing to the function.
5. Put the resulting full endpoint in a local `.env.local`:

```text
EXPO_PUBLIC_ANALYTICS_URL=https://YOUR_DOMAIN/analytics
```

Never store message text in event properties. Only record counts, choices, timings,
route labels, and other approved structured fields.
