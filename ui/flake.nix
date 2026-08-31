{
  description = "Playwright development environment";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.playwright.url = "github:polwex/playwright-web-flake?ref=mcp";

  outputs = {
    self,
    flake-utils,
    nixpkgs,
    playwright,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      overlay = final: prev: {
        inherit (playwright.packages.${system}) playwright-test playwright-driver playwright-mcp;
      };
      pkgs = import nixpkgs {
        inherit system;
        overlays = [overlay];
      };
    in {
      devShells = {
        env.LD_LIBRARY_PATH = "${pkgs.lib.makeLibraryPath [pkgs.enchant]}:$LD_LIBRARY_PATH";
        default = pkgs.mkShell {
          packages = [
            pkgs.playwright-test
            pkgs.playwright-mcp
            pkgs.typescript-language-server
            pkgs.bun
          ];
          shellHook = ''
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
          '';
        };
      };
    });
}
