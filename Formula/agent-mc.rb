class AgentMc < Formula
  desc "MCP server for Agent Mission Control — bidirectional agent <> dashboard communication"
  homepage "https://github.com/YOUR_ORG/agent-mission-control"
  # url, sha256, and version are updated automatically by the CI release workflow
  # (.github/workflows/release.yml) on each tagged release.
  # To update manually:
  #   1. Download the mcp-server tarball from the GitHub release
  #   2. Run: sha256sum agent-mc-mcp-server-<version>.tar.gz
  #   3. Replace url, sha256, and version below
  url "https://github.com/YOUR_ORG/agent-mission-control/releases/download/v0.1.0/agent-mc-mcp-server-0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"
  version "0.1.0"

  depends_on "node"

  def install
    # Install Node.js dependencies and build TypeScript
    system "npm", "install", "--production=false"
    system "npm", "run", "build"

    # Install the compiled output and package metadata into the Homebrew prefix
    libexec.install Dir["dist", "node_modules", "package.json"]

    # Create a wrapper script that invokes the MCP server entry point
    (bin / "agent-mc").write <<~SHELL
      #!/bin/bash
      exec node "#{libexec}/dist/index.js" "$@"
    SHELL
    chmod 0755, bin / "agent-mc"
  end

  test do
    # The MCP server speaks stdio -- verify the binary exits cleanly with --version
    assert_match version.to_s, shell_output("#{bin}/agent-mc --version 2>&1", 0).strip
  end
end
