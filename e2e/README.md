# End-to-end tests

`auth.e2e.mjs` starts the built server (`build/index.js`) as a real process and talks to it over
HTTP and stdio, with `fake-komodo.mjs` standing in for Komodo Core. It checks every way a client
can authenticate — and the behaviour that must never change: a network caller without a
credential cannot write (GHSA-gf32-w3f6-crx6), `stdio` stays unrestricted, the browser login
keeps working.

```bash
npm run test:e2e
```

The stand-in implements only the handful of Komodo endpoints these checks need and records which
user performed each write; it is not a substitute for testing against a real Komodo Core.
