/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    // Default Router Cache keeps a dynamic page's client-side RSC payload "fresh"
    // for 30s after you navigate away from it. router.refresh() (used after every
    // confirmed proposal) only invalidates the CURRENT page's entry — navigating to
    // a different page (dashboard <-> profile) within that window can still show
    // stale data even though the server already has the new state. 0 makes every
    // navigation to a dynamic page always refetch.
    staleTimes: {
      dynamic: 0,
    },
  },
};
