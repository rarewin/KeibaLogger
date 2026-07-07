import type { NextConfig } from "next";
import os from "os";

// Automatically discover all local IPv4 addresses (e.g. "192.168.X.X", "10.X.X.X") at server startup
const getLocalIpAddresses = (): string[] => {
  const ips: string[] = ["localhost", "localhost:3000"];
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    const list = interfaces[name];
    if (list) {
      for (const iface of list) {
        // Skip loopbacks (127.0.0.1) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
          ips.push(`${iface.address}:3000`);
        }
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: getLocalIpAddresses(),
};

export default nextConfig;
