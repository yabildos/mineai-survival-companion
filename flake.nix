{
  description = "MineAI single-player Minecraft survival companion";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      bunArchive = pkgs.fetchurl {
        url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip";
        hash = "sha256-NjaPrvdSeHXV/6UuU81IAhdB8qg+tiCKjdZAaNQiqRM=";
      };
      bun =
        pkgs.runCommand "bun-1.4.2"
          {
            nativeBuildInputs = [
              pkgs.unzip
              pkgs.patchelf
            ];
          }
          ''
            mkdir -p "$out/bin"
            unzip -p ${bunArchive} bun-linux-x64/bun > "$out/bin/bun"
            chmod +x "$out/bin/bun"
            patchelf --set-interpreter ${pkgs.stdenv.cc.bintools.dynamicLinker} \
              --set-rpath ${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]} "$out/bin/bun"
          '';
      devShell = pkgs.mkShellNoCC {
        packages = [
          pkgs.nodejs_24
          bun
          pkgs.git
          pkgs.curl
          pkgs.bubblewrap
        ];
      };
    in
    {
      devShells.${system} = {
        default = devShell;
        ai = devShell;
      };
    };
}
