import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  basePath: "/cmdt",
  webpack: (config) => {
    // scte35 is only used for types in cmdt-shared's Scte35Marker;
    // it doesn't need to be bundled into the viewer
    config.resolve.alias["scte35"] = false;
    return config;
  },
};

export default nextConfig;
