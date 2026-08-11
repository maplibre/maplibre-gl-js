/** @type {import('next').NextConfig} */
const nextConfig = {
    // Emit a plain static site so the bundler test harness can serve the
    // build output directly, the same way it serves the other examples.
    output: 'export'
};

export default nextConfig;
