{
  description = "Runtime libraries for TLauncher on NixOS";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
        };
      };
      bunArchive = pkgs.fetchurl {
        url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip";
        hash = "sha256-NjaPrvdSeHXV/6UuU81IAhdB8qg+tiCKjdZAaNQiqRM=";
      };
      bun = pkgs.runCommand "bun-1.4.2" { nativeBuildInputs = [ pkgs.unzip pkgs.patchelf ]; } ''
        mkdir -p "$out/bin"
        unzip -p ${bunArchive} bun-linux-x64/bun > "$out/bin/bun"
        chmod +x "$out/bin/bun"
        patchelf --set-interpreter ${pkgs.stdenv.cc.bintools.dynamicLinker} \
          --set-rpath ${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]} "$out/bin/bun"
      '';
      libraries = with pkgs; [
        libX11 libXext libXrender libXtst libXi
        libXcursor libXrandr libXinerama libXxf86vm
        fontconfig freetype zlib stdenv.cc.cc.lib
        gtk3 pango atk cairo gdk-pixbuf glib
        libglvnd vulkan-loader
        openal alsa-lib libpulseaudio pipewire
      ];
    in {
      devShells.${system} = {
        default = pkgs.mkShellNoCC {
          packages = [ pkgs.bubblewrap ];
          LD_LIBRARY_PATH = "${pkgs.lib.makeLibraryPath libraries}:/run/opengl-driver/lib";
        };
        ai = pkgs.mkShellNoCC {
          packages = [ pkgs.nodejs_22 bun pkgs.git pkgs.curl pkgs.jq pkgs.bubblewrap ];
        };
      };
    };
}
