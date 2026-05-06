import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/about",
        destination: "/profile/lucas",
        permanent: true,
      },
      {
        source: "/analytics",
        destination: "/profile/lucas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
