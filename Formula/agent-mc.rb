class AgentMc < Formula
  desc "MCP server for Agent Mission Control — bidirectional agent ↔ dashboard communication"
  homepage "https://github.com/YOUR_ORG/agent-mission-control"
  # Replace the url and sha256 with the values from the GitHub release you want to publish.
  # 1. Create a GitHub release and upload the tarball of the mcp-server directory.
  # 2. Run: curl -sL <url> | sha256sum
  # 3. Paste the resulting hash as the sha256 value below.
  url "https://github.com/YOUR_ORG/agent-mission-control/releases/download/v0.1.0/agent-mc-mcp-server-0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256" # Update with: curl -sL <url> | sha256sum | awk '{print $1}'
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
    # The MCP server speaks stdio — verify the binary exits cleanly with --version
    # (node will print the package version and exit 0 when we ask for it)
    assert_match version.to_s, shell_output("#{bin}/agent-mc --version 2>&1", 0).strip
  end
end
