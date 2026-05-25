import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Fall back to the root package.json version when NEXT_PUBLIC_CMDT_VERSION is
// not provided by the release workflow. Keeps dev and PR builds from rendering
// "v" with nothing after it. Release builds set the env var explicitly and win.
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
const cmdtVersion = process.env.NEXT_PUBLIC_CMDT_VERSION ?? rootPkg.version;

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  basePath: "/cmdt",
  env: {
    NEXT_PUBLIC_CMDT_VERSION: cmdtVersion,
  },
  webpack: (config) => {
    // scte35 is only used for types in cmdt-shared's Scte35Marker;
    // it doesn't need to be bundled into the viewer
    config.resolve.alias["scte35"] = false;
    return config;
  },
};

export default nextConfig;
