{
  description = "Runtime libraries for TLauncher on NixOS";
  inputs.nixpkgs.url = "nixpkgs";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
        };
      };
      libraries = with pkgs; [
        libX11 libXext libXrender libXtst libXi
        libXcursor libXrandr libXinerama libXxf86vm
        fontconfig freetype zlib stdenv.cc.cc.lib
        gtk3 pango atk cairo gdk-pixbuf glib
        libglvnd vulkan-loader
      ];
    in {
      devShells.${system} = {
        default = pkgs.mkShellNoCC {
          packages = [ pkgs.bubblewrap ];
          LD_LIBRARY_PATH = "${pkgs.lib.makeLibraryPath libraries}:/run/opengl-driver/lib";
        };
        ai = pkgs.mkShellNoCC {
          packages = [ pkgs.nodejs_22 pkgs.bun pkgs.git pkgs.curl pkgs.jq pkgs.bubblewrap ];
        };
      };
    };
}
