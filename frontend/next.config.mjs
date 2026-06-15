/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // can run `node server.js` without node_modules — small, fast container.
  output: "standalone",
};

export default nextConfig;
